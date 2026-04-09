import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2).max(2).optional(),
});

export default async function NovoLocalPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/admin/locais/novo");
  await requireAdmin();

  async function createVenue(formData: FormData) {
    "use server";
    await requireAdmin();

    const raw = {
      name: String(formData.get("name") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? "").trim() || undefined,
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return;

    const venue = await prisma.venue.create({
      data: { name: parsed.data.name, city: parsed.data.city, state: parsed.data.state ?? null },
    });
    redirect(`/admin/locais/${venue.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader className="space-y-1">
          <div className="text-base font-semibold tracking-tight">Novo local</div>
          <div className="text-sm text-muted-foreground">Crie um local e depois configure setores e assentos.</div>
        </CardHeader>
        <CardContent>
          <form action={createVenue} className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Nome</div>
              <Input name="name" placeholder="Ex.: Arena Aurora" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Cidade</div>
                <Input name="city" placeholder="São Paulo" required />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">UF</div>
                <Input name="state" placeholder="SP" maxLength={2} />
              </div>
            </div>
            <Button type="submit" className="rounded-2xl">
              Criar local
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

