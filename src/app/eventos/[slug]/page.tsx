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
      tickets: { include: { seat: true, sector: true } },
    },
  });

  if (!event || event.status !== "PUBLISHED") notFound();

  const seatsBySector: Record<
    string,
    {
      id: string;
      label: string;
      row: string | null;
      number: number | null;
      state: "AVAILABLE" | "HELD" | "SOLD" | "UNAVAILABLE";
      ticketId: string | null;
      priceCents: number | null;
    }[]
  > = {};

  let heldTicketIds = new Set<string>();
  try {
    const { getRedis } = await import("@/lib/redis");
    const { holdKey } = await import("@/lib/holds");
    const redis = getRedis();
    const keys = event.tickets.map((t) => holdKey(t.id));
    const values = keys.length ? await redis.mget(keys) : [];
    heldTicketIds = new Set(event.tickets.filter((_t, idx) => !!values[idx]).map((t) => t.id));
  } catch {
    heldTicketIds = new Set();
  }

  for (const sector of event.venue.sectors) {
    if (sector.kind !== "SEATED") continue;
    const sectorTickets = event.tickets.filter((t) => t.sectorId === sector.id);
    seatsBySector[sector.id] = sector.seats.map((seat) => {
      const ticket = sectorTickets.find((t) => t.seatId === seat.id) ?? null;
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
    });
  }

  const sectors = event.venue.sectors
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const sectorTickets = event.tickets.filter((t) => t.sectorId === s.id);
      const available = sectorTickets.filter((t) => t.status === "AVAILABLE" && !heldTicketIds.has(t.id)).length;
      const held = sectorTickets.filter((t) => t.status === "AVAILABLE" && heldTicketIds.has(t.id)).length;
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
        lots: event.lots
          .filter((l) => l.sectorId === s.id)
          .map((l) => ({ id: l.id, name: l.name, priceCents: l.priceCents, currency: l.currency })),
        seats: seatsBySector[s.id] ?? null,
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
