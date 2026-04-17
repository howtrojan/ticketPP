import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const schema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10).max(5000),
  startAt: z.string().min(1),
  venueId: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});

export default async function NovoEventoPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin/eventos/novo");
  if (session.user.role !== "ADMIN") redirect("/eventos");

  const venues = await prisma.venue.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  async function createEvent(formData: FormData) {
    "use server";
    const { userId } = await requireAdmin();

    const raw = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      startAt: String(formData.get("startAt") ?? ""),
      venueId: String(formData.get("venueId") ?? ""),
      coverImageUrl: String(formData.get("coverImageUrl") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "PUBLISHED"),
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return;

    const startAt = new Date(parsed.data.startAt);
    const slug = slugify(parsed.data.title);
    const event = await prisma.event.create({
      data: {
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        startAt,
        status: parsed.data.status,
        coverImageUrl: parsed.data.coverImageUrl ?? null,
        venueId: parsed.data.venueId,
        createdById: userId,
      },
    });
    await prisma.searchIndexDocument.create({ data: { type: "EVENT", eventId: event.id } });
    redirect(`/admin/eventos/${event.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardHeader className="space-y-1">
          <div className="text-base font-semibold tracking-tight">Novo evento</div>
          <div className="text-sm text-muted-foreground">Crie o evento e depois configure lotes e ingressos.</div>
        </CardHeader>
        <CardContent>
          <form action={createEvent} className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Título</div>
              <Input name="title" placeholder="Ex.: Neon Nights Festival" required />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Descrição</div>
              <Textarea name="description" placeholder="Descreva o evento..." rows={6} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Data e hora</div>
                <Input name="startAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Local</div>
                <select
                  name="venueId"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  required
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} • {v.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Capa (URL)</div>
                <Input name="coverImageUrl" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Status</div>
                <select
                  name="status"
                  defaultValue="PUBLISHED"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="PUBLISHED">Publicado</option>
                  <option value="DRAFT">Rascunho</option>
                </select>
              </div>
            </div>
            <Button type="submit" className="rounded-2xl">
              Criar evento
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
