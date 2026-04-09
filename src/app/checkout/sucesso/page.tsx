import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export default async function CheckoutSucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const orderId = sp.orderId;
  if (!orderId) redirect("/conta");

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      event: { include: { venue: true } },
      items: { include: { ticket: { include: { seat: true, sector: true } } } },
    },
  });

  if (!order) redirect("/conta");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Compra confirmada
          </div>
          <div className="text-sm text-muted-foreground">
            Pedido {order.id} • {order.event.title}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-card/40 p-4">
            <div className="text-sm font-semibold">Ingressos</div>
            <div className="mt-2 space-y-2">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    {i.ticket.sector.name}
                    {i.ticket.seat?.label ? ` • ${i.ticket.seat.label}` : ""}
                  </div>
                  <div className="text-sm font-semibold">{formatMoney(i.unitPriceCents, order.currency)}</div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatMoney(order.totalCents, order.currency)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-2xl">
              <Link href="/conta">Ver meus pedidos</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-2xl">
              <Link href={`/eventos/${order.event.slug}`}>Voltar ao evento</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

