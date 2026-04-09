import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sectorSchema = z.object({
  name: z.string().min(2),
  kind: z.enum(["GENERAL_ADMISSION", "SEATED"]),
  capacity: z.coerce.number().int().min(1).max(50000),
});

const seatsSchema = z.object({
  sectorId: z.string().min(1),
  rows: z.string().min(1),
  seatsPerRow: z.coerce.number().int().min(1).max(200),
});

export default async function LocalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin");
  await requireAdmin();

  const { id } = await params;
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: { sectors: { include: { seats: true } } },
  });
  if (!venue) redirect("/admin");
  const venueId = venue.id;

  async function createSector(formData: FormData) {
    "use server";
    await requireAdmin();
    const raw = {
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? "GENERAL_ADMISSION"),
      capacity: String(formData.get("capacity") ?? "0"),
    };
    const parsed = sectorSchema.safeParse(raw);
    if (!parsed.success) return;
    await prisma.sector.create({
      data: {
        venueId,
        name: parsed.data.name,
        kind: parsed.data.kind,
        capacity: parsed.data.capacity,
        sortOrder: 10,
      },
    });
    redirect(`/admin/locais/${venueId}`);
  }

  async function generateSeats(formData: FormData) {
    "use server";
    await requireAdmin();

    const raw = {
      sectorId: String(formData.get("sectorId") ?? ""),
      rows: String(formData.get("rows") ?? ""),
      seatsPerRow: String(formData.get("seatsPerRow") ?? ""),
    };
    const parsed = seatsSchema.safeParse(raw);
    if (!parsed.success) return;

    const sector = await prisma.sector.findUnique({
      where: { id: parsed.data.sectorId },
      include: { seats: true },
    });
    if (!sector || sector.venueId !== venueId) return;
    if (sector.kind !== "SEATED") return;
    if (sector.seats.length > 0) return;

    const rows = parsed.data.rows
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const data: { sectorId: string; label: string; row: string; number: number }[] = [];
    for (const row of rows) {
      for (let i = 1; i <= parsed.data.seatsPerRow; i++) {
        data.push({ sectorId: sector.id, label: `${row}${i}`, row, number: i });
      }
    }
    await prisma.seat.createMany({ data });
    await prisma.sector.update({
      where: { id: sector.id },
      data: { capacity: data.length },
    });
    redirect(`/admin/locais/${venueId}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{venue.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {venue.city}
            {venue.state ? ` · ${venue.state}` : ""}
          </p>
        </div>
        <Button asChild variant="secondary" className="rounded-2xl">
          <a href="/admin">Voltar</a>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-base font-semibold tracking-tight">Adicionar setor</div>
            <div className="text-sm text-muted-foreground">Pista (GA) ou assentos (SEATED).</div>
          </CardHeader>
          <CardContent>
            <form action={createSector} className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Nome</div>
                <Input name="name" placeholder="Ex.: Plateia" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Tipo</div>
                  <select
                    name="kind"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    defaultValue="GENERAL_ADMISSION"
                  >
                    <option value="GENERAL_ADMISSION">Pista / Geral</option>
                    <option value="SEATED">Assentos</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Capacidade</div>
                  <Input name="capacity" inputMode="numeric" placeholder="Ex.: 500" required />
                </div>
              </div>
              <Button type="submit" className="rounded-2xl">
                Criar setor
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="text-base font-semibold tracking-tight">Gerar assentos</div>
            <div className="text-sm text-muted-foreground">Apenas para setores do tipo SEATED sem assentos.</div>
          </CardHeader>
          <CardContent>
            <form action={generateSeats} className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Setor</div>
                <select
                  name="sectorId"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {venue.sectors
                    .filter((s) => s.kind === "SEATED")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.seats.length} assentos)
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Filas</div>
                  <Input name="rows" placeholder="A,B,C,D,E" defaultValue="A,B,C,D,E,F" required />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Assentos por fila</div>
                  <Input name="seatsPerRow" inputMode="numeric" placeholder="20" defaultValue="20" required />
                </div>
              </div>
              <Button type="submit" className="rounded-2xl">
                Gerar assentos
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader className="space-y-1">
          <div className="text-base font-semibold tracking-tight">Setores</div>
          <div className="text-sm text-muted-foreground">{venue.sectors.length} itens</div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Capacidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venue.sectors
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name}
                      {s.kind === "SEATED" ? (
                        <div className="text-xs text-muted-foreground">{s.seats.length} assentos</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Pista/Geral</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.capacity}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
