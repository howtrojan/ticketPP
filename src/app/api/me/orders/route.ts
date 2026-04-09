import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { userId } = await requireUser();

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      event: { include: { venue: true } },
      items: { include: { ticket: { include: { seat: true, sector: true } } } },
      payments: true,
    },
  });

  return NextResponse.json({
    items: orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      createdAt: o.createdAt,
      event: {
        slug: o.event.slug,
        title: o.event.title,
        startAt: o.event.startAt,
        venue: { name: o.event.venue.name, city: o.event.venue.city, state: o.event.venue.state },
      },
      items: o.items.map((i) => ({
        id: i.id,
        ticketId: i.ticketId,
        sector: i.ticket.sector.name,
        seatLabel: i.ticket.seat?.label ?? null,
        unitPriceCents: i.unitPriceCents,
      })),
      payments: o.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        status: p.status,
        createdAt: p.createdAt,
      })),
    })),
  });
}

