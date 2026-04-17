import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { holdKey } from "@/lib/holds";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      venue: { include: { sectors: { include: { seats: true } } } },
      lots: true,
    },
  });

  if (!event || event.status !== "PUBLISHED")
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const ticketRows = await prisma.ticket.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      sectorId: true,
      lotId: true,
      seatId: true,
      status: true,
      priceCents: true,
      currency: true,
      seat: { select: { label: true, row: true, number: true } },
    },
  });

  const heldTicketIds = new Set<string>();
  try {
    const redis = getRedis();
    const holdCandidates = ticketRows.filter((t) => t.status === "AVAILABLE");
    const keys = holdCandidates.map((t) => holdKey(t.id));
    const values = keys.length ? await redis.mget(keys) : [];
    for (let i = 0; i < values.length; i++) {
      if (values[i]) heldTicketIds.add(holdCandidates[i].id);
    }
  } catch {
    // Sem Redis, tratamos como sem holds ativos para manter o endpoint rápido.
  }

  const seatTicketBySector = new Map<string, Map<string, (typeof ticketRows)[number]>>();
  const sectorStats = new Map<string, { available: number; held: number; sold: number; minPrice: number | null }>();

  for (const ticket of ticketRows) {
    if (ticket.seatId) {
      let bySeat = seatTicketBySector.get(ticket.sectorId);
      if (!bySeat) {
        bySeat = new Map<string, (typeof ticketRows)[number]>();
        seatTicketBySector.set(ticket.sectorId, bySeat);
      }
      bySeat.set(ticket.seatId, ticket);
    }

    const stats = sectorStats.get(ticket.sectorId) ?? { available: 0, held: 0, sold: 0, minPrice: null };
    if (ticket.status === "SOLD") {
      stats.sold += 1;
    } else {
      if (heldTicketIds.has(ticket.id)) stats.held += 1;
      else stats.available += 1;
      stats.minPrice = stats.minPrice === null ? ticket.priceCents : Math.min(stats.minPrice, ticket.priceCents);
    }
    sectorStats.set(ticket.sectorId, stats);
  }

  const sectors = event.venue.sectors.map((s) => {
    const stats = sectorStats.get(s.id) ?? { available: 0, held: 0, sold: 0, minPrice: null };

    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      capacity: s.capacity,
      available: stats.available,
      held: stats.held,
      sold: stats.sold,
      minPrice: stats.minPrice,
      seats:
        s.kind === "SEATED"
          ? s.seats.map((seat) => {
              const ticket = seatTicketBySector.get(s.id)?.get(seat.id) ?? null;
              const state =
                !ticket
                  ? "UNAVAILABLE"
                  : ticket.status === "SOLD"
                    ? "SOLD"
                    : heldTicketIds.has(ticket.id)
                      ? "HELD"
                      : "AVAILABLE";
              return {
                id: seat.id,
                label: seat.label,
                row: seat.row,
                number: seat.number,
                state,
                ticketId: ticket?.id ?? null,
                priceCents: ticket?.priceCents ?? null,
              };
            })
          : null,
    };
  });

  return NextResponse.json({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    coverImageUrl: event.coverImageUrl,
    venue: {
      id: event.venue.id,
      name: event.venue.name,
      city: event.venue.city,
      state: event.venue.state,
      country: event.venue.country,
    },
    sectors,
    lots: event.lots.map((l) => ({
      id: l.id,
      sectorId: l.sectorId,
      name: l.name,
      priceCents: l.priceCents,
      currency: l.currency,
      quantity: l.quantity,
    })),
  });
}
