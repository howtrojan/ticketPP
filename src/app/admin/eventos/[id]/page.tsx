import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney } from "@/lib/format";

const lotSchema = z.object({
  sectorId: z.string().min(1),
  name: z.string().min(2).max(120),
  priceCents: z.coerce.number().int().min(100),
  quantity: z.coerce.number().int().min(1).max(50000),
});

export default async function AdminEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin");
  await requireAdmin();

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: { include: { sectors: { include: { seats: true } } } },
      lots: true,
    },
  });
  if (!event) redirect("/admin");
  const eventId = event.id;
  const venueId = event.venueId;

  const ticketStats = await prisma.ticket.groupBy({
    by: ["status"],
    where: { eventId: event.id },
    _count: { _all: true },
  });
  const statsMap = new Map(ticketStats.map((s) => [s.status, s._count._all]));

  async function createLotAndTickets(formData: FormData) {
    "use server";
    await requireAdmin();

    const raw = {
      sectorId: String(formData.get("sectorId") ?? ""),
      name: String(formData.get("name") ?? ""),
      priceCents: String(formData.get("priceCents") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
    };
    const parsed = lotSchema.safeParse(raw);
    if (!parsed.success) return;

    const sector = await prisma.sector.findUnique({
      where: { id: parsed.data.sectorId },
      include: { seats: true },
    });
    if (!sector || sector.venueId !== venueId) return;

    const lot = await prisma.ticketLot.create({
      data: {
        eventId,
        sectorId: sector.id,
        name: parsed.data.name,
        priceCents: parsed.data.priceCents,
        currency: "BRL",
        quantity: parsed.data.quantity,
      },
    });

    if (sector.kind === "SEATED") {
      const seats = sector.seats.slice(0, parsed.data.quantity);
      await prisma.ticket.createMany({
        data: seats.map((seat) => ({
          eventId,
          sectorId: sector.id,
          lotId: lot.id,
          seatId: seat.id,
          priceCents: lot.priceCents,
          currency: lot.currency,
        })),
        skipDuplicates: true,
      });
    } else {
      await prisma.ticket.createMany({
        data: Array.from({ length: parsed.data.quantity }).map(() => ({
          eventId,
          sectorId: sector.id,
          lotId: lot.id,
          priceCents: lot.priceCents,
          currency: lot.currency,
        })),
      });
    }

    redirect(`/admin/eventos/${eventId}`);
  }

  async function publishEvent() {
    "use server";
    await requireAdmin();
    await prisma.event.update({ where: { id: eventId }, data: { status: "PUBLISHED" } });
    redirect(`/admin/eventos/${eventId}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{event.title}</h1>
            <Badge variant={event.status === "PUBLISHED" ? "default" : "secondary"}>{event.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(event.startAt)} • {event.venue.name} • {event.venue.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status !== "PUBLISHED" ? (
            <form action={publishEvent}>
              <Button type="submit" className="rounded-2xl">
                Publicar
              </Button>
            </form>
          ) : null}
          <Button asChild variant="secondary" className="rounded-2xl">
            <a href="/admin">Voltar</a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Disponíveis</div>
            <div className="text-2xl font-semibold">{statsMap.get("AVAILABLE") ?? 0}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Vendidos</div>
            <div className="text-2xl font-semibold">{statsMap.get("SOLD") ?? 0}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Lotes</div>
            <div className="text-2xl font-semibold">{event.lots.length}</div>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-base font-semibold tracking-tight">Criar lote + ingressos</div>
            <div className="text-sm text-muted-foreground">
              Para SEATED, gera tickets por assento; para GA, gera quantidade.
            </div>
          </CardHeader>
          <CardContent>
            <form action={createLotAndTickets} className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Setor</div>
                <select
                  name="sectorId"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  required
                >
                  {event.venue.sectors
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} • {s.kind} • cap {s.capacity}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Nome do lote</div>
                  <Input name="name" placeholder="Lote 1" required />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Quantidade</div>
                  <Input name="quantity" inputMode="numeric" placeholder="1000" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Preço (centavos)</div>
                <Input name="priceCents" inputMode="numeric" placeholder="19900" required />
                <div className="text-xs text-muted-foreground">Ex.: 19900 = {formatMoney(19900, "BRL")}</div>
              </div>
              <Button type="submit" className="rounded-2xl">
                Criar lote
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-1">
            <div className="text-base font-semibold tracking-tight">Lotes</div>
            <div className="text-sm text-muted-foreground">Configure preços e capacidade por setor.</div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.lots.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.venue.sectors.find((s) => s.id === l.sectorId)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(l.priceCents, l.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
