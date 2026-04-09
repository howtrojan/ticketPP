import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HOLD_TTL_SECONDS, createHold, getHold, releaseHold } from "@/lib/holds";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth";

const postSchema = z
  .object({
    ticketId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),
    sectorId: z.string().min(1).optional(),
    lotId: z.string().min(1).optional(),
  })
  .refine((v) => v.ticketId || (v.eventId && v.sectorId), {
    message: "ticketId ou (eventId + sectorId) é obrigatório",
  });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get("ticketId");
  if (!ticketId) return NextResponse.json({ error: "MISSING_TICKET_ID" }, { status: 400 });

  const { userId } = await requireUser();

  const hold = await getHold(ticketId).catch(() => null);
  if (!hold) return NextResponse.json({ status: "NO_REDIS" }, { status: 503 });
  if (!hold.userId || hold.ttlSeconds <= 0) return NextResponse.json({ status: "FREE" });

  return NextResponse.json({
    status: "HELD",
    ownedByUser: hold.userId === userId,
    ttlSeconds: hold.ttlSeconds,
  });
}

export async function POST(req: Request) {
  const { userId } = await requireUser();

  const ip = req.headers.get("x-forwarded-for") ?? "ip:unknown";
  const rl = await rateLimit({ key: `hold:${userId}:${ip}`, limit: 60, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { ticketId, eventId, sectorId, lotId } = parsed.data;

  async function tryHoldTicket(id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, status: true, eventId: true, sectorId: true, priceCents: true, currency: true },
    });

    if (!ticket) return { ok: false as const, reason: "NOT_FOUND" as const };
    if (ticket.status !== "AVAILABLE") return { ok: false as const, reason: "SOLD" as const };

    const ok = await createHold(ticket.id, userId);
    if (!ok) return { ok: false as const, reason: "ALREADY_HELD" as const };

    const expiresAt = new Date(Date.now() + HOLD_TTL_SECONDS * 1000);
    await prisma.holdReservation.create({
      data: {
        userId,
        ticketId: ticket.id,
        status: "ACTIVE",
        expiresAt,
      },
    });

    return { ok: true as const, ticket };
  }

  if (ticketId) {
    const res = await tryHoldTicket(ticketId);
    if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 409 });
    return NextResponse.json({ ok: true, ticket: res.ticket, ttlSeconds: HOLD_TTL_SECONDS });
  }

  const candidates = await prisma.ticket.findMany({
    where: {
      eventId,
      sectorId,
      status: "AVAILABLE",
      ...(lotId ? { lotId } : undefined),
    },
    select: { id: true },
    take: 25,
  });

  for (const c of candidates) {
    const res = await tryHoldTicket(c.id);
    if (res.ok) return NextResponse.json({ ok: true, ticket: res.ticket, ttlSeconds: HOLD_TTL_SECONDS });
  }

  return NextResponse.json({ error: "NO_AVAILABLE_TICKETS" }, { status: 409 });
}

export async function DELETE(req: Request) {
  const { userId } = await requireUser();

  const body = await req.json().catch(() => null);
  const parsed = z.object({ ticketId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const ok = await releaseHold(parsed.data.ticketId, userId).catch(() => null);
  if (ok === null) return NextResponse.json({ error: "NO_REDIS" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "NOT_OWNER" }, { status: 403 });

  await prisma.holdReservation.updateMany({
    where: { ticketId: parsed.data.ticketId, userId, status: "ACTIVE" },
    data: { status: "CANCELLED", releasedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

