import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
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
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-[-220px] h-[420px] bg-gradient-to-b from-foreground/10 via-foreground/5 to-transparent blur-2xl" />
      <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-14">
        <div className="grid gap-8 rounded-3xl border bg-card/40 p-8 shadow-sm backdrop-blur md:grid-cols-12 md:items-end md:gap-10 md:p-10">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              MVP pronto para ticketing real
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Venda ingressos com uma experiência premium, rápida e segura.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Busca instantânea, reserva por 7 minutos, checkout com Stripe e controle de concorrência
              para evitar overselling.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-2xl">
                <Link href="/eventos">
                  Ver eventos <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-2xl">
                <Link href="/admin">Criar evento</Link>
              </Button>
            </div>
          </div>
          <div className="md:col-span-5">
            <EventSearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">Em destaque</h2>
            <p className="mt-1 text-sm text-muted-foreground">Eventos com alta procura e curadoria.</p>
          </div>
          <Button asChild variant="ghost" className="rounded-2xl">
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
