import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { EventSearchBar } from "@/components/event-search-bar";

export default async function Home() {
  const featured = await prisma.event.findMany({
    where: { status: "PUBLISHED", startAt: { gte: new Date(Date.now() - 1000 * 60 * 60) } },
    orderBy: { startAt: "asc" },
    take: 6,
    include: { venue: true },
  });

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[-240px] h-[520px] bg-radial from-primary/30 via-primary/10 to-transparent blur-3xl" />
      <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-14">
        <div className="grid gap-8 rounded-[2rem] border border-border/70 bg-linear-to-br from-card/95 via-card/86 to-card/72 p-8 shadow-[0_36px_70px_-46px_rgba(19,13,35,0.85)] backdrop-blur md:grid-cols-12 md:items-end md:gap-10 md:p-12">
          <div className="md:col-span-7">           
            
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/eventos">
                  Ver eventos <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/admin">Criar evento</Link>
              </Button>
            </div>
          </div>
          <div className="space-y-4 md:col-span-5">
            <EventSearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">Eventos em destaque</h2>
            <p className="mt-1 text-sm text-muted-foreground">Seleção com maior procura e forte potencial de venda.</p>
          </div>
          <Button asChild variant="ghost">
            <Link href="/eventos">Ver catálogo</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((e) => (
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
      </section>
    </div>
  );
}
