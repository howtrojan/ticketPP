import { prisma } from "@/lib/db";
import { EventCard } from "@/components/event-card";
import { EventSearchBar } from "@/components/event-search-bar";
import { Badge } from "@/components/ui/badge";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const city = sp.city?.trim() || "";

  const items = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(city ? { venue: { city: { contains: city, mode: "insensitive" } } } : undefined),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { venue: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined),
    },
    orderBy: { startAt: "asc" },
    take: 60,
    include: { venue: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Eventos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Descubra experiências ao vivo com visual premium e compra sem fricção.
          </p>
        </div>
        <EventSearchBar defaultValue={q} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {q ? <Badge variant="secondary" className="rounded-full px-3 py-1">Busca: {q}</Badge> : null}
        {city ? <Badge variant="secondary" className="rounded-full px-3 py-1">Cidade: {city}</Badge> : null}
        <Badge variant="outline" className="rounded-full px-3 py-1">{items.length} resultados</Badge>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => (
          <EventCard
            key={e.id}
            event={{
              slug: e.slug,
              title: e.title,
              startAt: e.startAt,
              coverImageUrl: e.coverImageUrl,
              venue: { name: e.venue.name, city: e.venue.city, state: e.venue.state },
            }}
          />
        ))}
      </div>
    </div>
  );
}
