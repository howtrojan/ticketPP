import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function ContaPage() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/auth/login?callbackUrl=/conta");

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      event: { include: { venue: true } },
      items: { include: { ticket: { include: { seat: true, sector: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Minha conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedidos, ingressos e status de pagamento.</p>
        </div>
        <Button asChild variant="secondary" className="rounded-2xl">
          <Link href="/eventos">Comprar ingressos</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {orders.map((o) => (
          <Card key={o.id} className="overflow-hidden">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">{o.event.title}</div>
                <Badge variant={o.status === "PAID" ? "default" : "secondary"}>{o.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateTime(o.event.startAt)} • {o.event.venue.city}
                {o.event.venue.state ? ` · ${o.event.venue.state}` : ""}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-2xl border bg-card/40 p-4">
                {o.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      {i.ticket.sector.name}
                      {i.ticket.seat?.label ? ` • ${i.ticket.seat.label}` : ""}
                    </div>
                    <div className="font-semibold">{formatMoney(i.unitPriceCents, o.currency)}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{formatMoney(o.totalCents, o.currency)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost" className="rounded-2xl">
                  <Link href={`/eventos/${o.event.slug}`}>Ver evento</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!orders.length ? (
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="text-base font-semibold tracking-tight">Nenhum pedido ainda</div>
              <div className="text-sm text-muted-foreground">
                Explore o catálogo e compre seus ingressos em poucos cliques.
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-2xl">
                <Link href="/eventos">Ver eventos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

