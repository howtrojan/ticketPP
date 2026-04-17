import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { TicketPicker } from "@/components/ticket-picker";
import { Badge } from "@/components/ui/badge";

export default async function EventoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      venue: { include: { sectors: { include: { seats: true } } } },
      lots: true,
      tickets: { include: { seat: true } },
    },
  });

  if (!event || event.status !== "PUBLISHED") notFound();

  const heldTicketIds = new Set<string>();
  try {
    const { getRedis } = await import("@/lib/redis");
    const { holdKey } = await import("@/lib/holds");
    const redis = getRedis();
    const holdCandidates = event.tickets.filter((t) => t.status === "AVAILABLE");
    const keys = holdCandidates.map((t) => holdKey(t.id));
    const values = keys.length ? await redis.mget(keys) : [];
    for (let i = 0; i < values.length; i++) {
      if (values[i]) heldTicketIds.add(holdCandidates[i].id);
    }
  } catch {
    // Sem Redis, tratamos como sem holds ativos para manter a página responsiva.
  }

  const seatTicketBySector = new Map<string, Map<string, (typeof event.tickets)[number]>>();
  const lotsBySector = new Map<
    string,
    { id: string; name: string; priceCents: number; currency: string }[]
  >();
  const sectorStats = new Map<string, { available: number; held: number; sold: number; minPrice: number | null }>();

  for (const ticket of event.tickets) {
    if (ticket.seatId) {
      let bySeat = seatTicketBySector.get(ticket.sectorId);
      if (!bySeat) {
        bySeat = new Map<string, (typeof event.tickets)[number]>();
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

  for (const lot of event.lots) {
    const bucket = lotsBySector.get(lot.sectorId);
    const mapped = { id: lot.id, name: lot.name, priceCents: lot.priceCents, currency: lot.currency };
    if (bucket) bucket.push(mapped);
    else lotsBySector.set(lot.sectorId, [mapped]);
  }

  const sectors = event.venue.sectors
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const stats = sectorStats.get(s.id) ?? { available: 0, held: 0, sold: 0, minPrice: null };

      return {
        id: s.id,
        name: s.name,
        kind: s.kind as "GENERAL_ADMISSION" | "SEATED",
        capacity: s.capacity,
        available: stats.available,
        held: stats.held,
        sold: stats.sold,
        minPrice: stats.minPrice,
        lots: lotsBySector.get(s.id) ?? [],
        seats:
          s.kind === "SEATED"
            ? s.seats.map((seat) => {
                const ticket = seatTicketBySector.get(s.id)?.get(seat.id) ?? null;
                const state: "AVAILABLE" | "HELD" | "SOLD" | "UNAVAILABLE" =
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

  const payload = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    coverImageUrl: event.coverImageUrl,
    venue: {
      name: event.venue.name,
      city: event.venue.city,
      state: event.venue.state,
    },
    sectors,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-6 md:grid-cols-12 md:items-start">
        <div className="md:col-span-7">
          <div className="relative overflow-hidden rounded-3xl border bg-muted">
            <div className="relative aspect-[16/9] w-full">
              {event.coverImageUrl ? (
                <Image
                  src={event.coverImageUrl}
                  alt={event.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                  priority
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/15 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{event.title}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDateTime(event.startAt)}
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue.city}
                  {event.venue.state ? ` · ${event.venue.state}` : ""}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Sobre</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
          </div>
        </div>

        <div className="md:col-span-5">
          <TicketPicker event={payload} />
        </div>
      </div>
    </div>
  );
}
