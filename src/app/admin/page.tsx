import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { ReindexButton } from "@/components/admin/reindex-button";

const deleteSchema = z.object({
  eventId: z.string().min(1),
});

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/eventos");
  const { error } = await searchParams;

  const [events, venues] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { venue: true },
    }),
    prisma.venue.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  async function deleteEvent(formData: FormData) {
    "use server";
    await requireAdmin();

    const parsed = deleteSchema.safeParse({
      eventId: String(formData.get("eventId") ?? ""),
    });
    if (!parsed.success) return;

    const { eventId } = parsed.data;
    const ordersCount = await prisma.order.count({ where: { eventId } });
    if (ordersCount > 0) {
      redirect("/admin?error=HAS_ORDERS");
    }

    await prisma.event.delete({ where: { id: eventId } });
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Admin</h1>
          {error === "HAS_ORDERS" ? (
            <p className="mt-2 text-sm font-medium text-destructive">
              Um dos eventos selecionados tem pedidos e não pode ser excluído.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-2xl">
            <Link href="/admin/eventos/novo">Novo evento</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-2xl">
            <Link href="/admin/locais/novo">Novo local</Link>
          </Button>
          <ReindexButton />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold tracking-tight">Eventos</div>
              <div className="text-sm text-muted-foreground">{events.length} itens</div>
            </div>
            <Button asChild variant="ghost" className="rounded-2xl">
              <Link href="/eventos">Ver catálogo</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/admin/eventos/${e.id}`} className="font-medium hover:underline">
                        {e.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{e.venue.city}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.status === "PUBLISHED" ? "default" : "secondary"}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateTime(e.startAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="ghost" className="rounded-xl">
                          <Link href={`/admin/eventos/${e.id}`}>Abrir</Link>
                        </Button>
                        <form action={deleteEvent}>
                          <input type="hidden" name="eventId" value={e.id} />
                          <Button type="submit" variant="destructive" className="rounded-xl">
                            Excluir
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold tracking-tight">Locais</div>
              <div className="text-sm text-muted-foreground">{venues.length} itens</div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link href={`/admin/locais/${v.id}`} className="font-medium hover:underline">
                        {v.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{v.city}</TableCell>
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

