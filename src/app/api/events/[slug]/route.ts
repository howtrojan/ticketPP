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

  let heldBy: (string | null)[] = [];
  try {
    const redis = getRedis();
    const keys = ticketRows.map((t) => holdKey(t.id));
    heldBy = keys.length ? await redis.mget(keys) : [];
  } catch {
    heldBy = [];
  }

  const tickets = ticketRows.map((t, idx) => ({
    id: t.id,
    sectorId: t.sectorId,
    lotId: t.lotId,
    seatId: t.seatId,
    seat: t.seat,
    status: t.status,
    hold: heldBy[idx] ? { userId: heldBy[idx], key: holdKey(t.id) } : null,
    priceCents: t.priceCents,
    currency: t.currency,
  }));

  const sectors = event.venue.sectors.map((s) => {
    const sectorTickets = tickets.filter((t) => t.sectorId === s.id);
    const available = sectorTickets.filter((t) => t.status === "AVAILABLE" && !t.hold).length;
    const held = sectorTickets.filter((t) => t.status === "AVAILABLE" && !!t.hold).length;
    const sold = sectorTickets.filter((t) => t.status === "SOLD").length;
    const minPrice = sectorTickets.length
      ? Math.min(...sectorTickets.filter((t) => t.status !== "SOLD").map((t) => t.priceCents))
      : null;

    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      capacity: s.capacity,
      available,
      held,
      sold,
      minPrice,
      seats:
        s.kind === "SEATED"
          ? s.seats.map((seat) => {
              const ticket = sectorTickets.find((t) => t.seatId === seat.id) ?? null;
              const state =
                !ticket
                  ? "UNAVAILABLE"
                  : ticket.status === "SOLD"
                    ? "SOLD"
                    : ticket.hold
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
