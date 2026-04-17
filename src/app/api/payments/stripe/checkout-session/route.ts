import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { getRedis } from "@/lib/redis";
import { holdKey, HOLD_TTL_SECONDS } from "@/lib/holds";

const schema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1).max(8),
});

export async function POST(req: Request) {
  const { userId } = await requireUser();

  const ip = req.headers.get("x-forwarded-for") ?? "ip:unknown";
  const rl = await rateLimit({ key: `checkout:${userId}:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const uniqueTicketIds = Array.from(new Set(parsed.data.ticketIds));
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: uniqueTicketIds } },
    include: {
      event: { include: { venue: true } },
      sector: true,
      seat: true,
    },
  });

  if (tickets.length !== uniqueTicketIds.length)
    return NextResponse.json({ error: "TICKET_NOT_FOUND" }, { status: 404 });

  const eventId = tickets[0].eventId;
  if (tickets.some((t) => t.eventId !== eventId))
    return NextResponse.json({ error: "MULTI_EVENT_NOT_SUPPORTED" }, { status: 400 });

  if (tickets.some((t) => t.status !== "AVAILABLE"))
    return NextResponse.json({ error: "TICKET_UNAVAILABLE" }, { status: 409 });

  let holdsOk = false;
  try {
    const redis = getRedis();
    const keys = uniqueTicketIds.map((id) => holdKey(id));
    const values = await redis.mget(keys);
    holdsOk = values.every((v) => v === userId);
  } catch {
    return NextResponse.json({ error: "NO_REDIS" }, { status: 503 });
  }

  if (!holdsOk) return NextResponse.json({ error: "HOLD_REQUIRED" }, { status: 409 });

  const currency = tickets[0].currency;
  const totalCents = tickets.reduce((sum, t) => sum + t.priceCents, 0);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          eventId,
          status: "PENDING_PAYMENT",
          currency,
          totalCents,
          expiresAt: new Date(Date.now() + HOLD_TTL_SECONDS * 1000),
          items: {
            create: tickets.map((t) => ({
              ticketId: t.id,
              unitPriceCents: t.priceCents,
              currency: t.currency,
              seatLabel: t.seat?.label ?? null,
              sectorName: t.sector.name,
            })),
          },
        },
        include: { event: { include: { venue: true } }, items: true },
      });

      await tx.holdReservation.updateMany({
        where: { userId, ticketId: { in: uniqueTicketIds }, status: "ACTIVE" },
        data: { status: "CONVERTED", releasedAt: new Date() },
      });

      return created;
    });

    const stripe = getStripe();
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? `order:${order.id}`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: tickets.map((t) => ({
          quantity: 1,
          price_data: {
            currency: t.currency.toLowerCase(),
            unit_amount: t.priceCents,
            product_data: {
              name: `${t.event.title} • ${t.sector.name}${t.seat?.label ? ` • ${t.seat.label}` : ""}`,
              description: `${t.event.venue.name} • ${t.event.venue.city}`,
              images: t.event.coverImageUrl ? [t.event.coverImageUrl] : undefined,
            },
          },
        })),
        metadata: {
          orderId: order.id,
          userId,
        },
        success_url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/checkout/sucesso?orderId=${order.id}`,
        cancel_url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/checkout?orderId=${order.id}`,
      },
      { idempotencyKey },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentIntentId: session.payment_intent?.toString() ?? null },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "STRIPE",
        providerPaymentIntentId: session.id,
        status: "REQUIRES_PAYMENT_METHOD",
        amountCents: order.totalCents,
        currency: order.currency,
        raw: session as unknown as Prisma.JsonObject,
      },
    });

    return NextResponse.json({ ok: true, url: session.url, orderId: order.id });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") return NextResponse.json({ error: "TICKET_IN_ORDER" }, { status: 409 });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
