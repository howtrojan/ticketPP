import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { holdKey } from "@/lib/holds";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "NO_WEBHOOK_SECRET" }, { status: 500 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 400 });

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ ok: true });

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) return NextResponse.json({ ok: true });
      if (order.status === "PAID") return NextResponse.json({ ok: true });

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "PAID" },
        });

        await tx.payment.updateMany({
          where: { orderId, provider: "STRIPE", providerPaymentIntentId: session.id },
          data: {
            status: "SUCCEEDED",
            raw: session as unknown as Prisma.JsonObject,
          },
        });

        const ticketIds = order.items.map((i) => i.ticketId);
        await tx.ticket.updateMany({
          where: { id: { in: ticketIds }, status: "AVAILABLE" },
          data: { status: "SOLD", soldAt: new Date() },
        });
      });

      try {
        const redis = getRedis();
        const keys = order.items.map((i) => holdKey(i.ticketId));
        if (keys.length) await redis.del(keys);
      } catch {}

      return NextResponse.json({ ok: true });
    } catch (e) {
      logger.error({ err: e, orderId }, "stripe.webhook.order_finalize_failed");
      return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ ok: true });

    await prisma.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
