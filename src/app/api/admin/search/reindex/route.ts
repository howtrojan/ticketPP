import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENTS_INDEX, getOpenSearch } from "@/lib/opensearch";

export async function POST() {
  await requireAdmin();

  const os = getOpenSearch();
  if (!os) return NextResponse.json({ error: "NO_OPENSEARCH" }, { status: 503 });

  const exists = await os.indices.exists({ index: EVENTS_INDEX });
  const indexExists = (exists as unknown as { body: boolean }).body;
  if (!indexExists) {
    await os.indices.create({
      index: EVENTS_INDEX,
      body: {
        settings: {
          index: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            slug: { type: "keyword" },
            status: { type: "keyword" },
            title: { type: "text" },
            description: { type: "text" },
            venueName: { type: "text" },
            city: { type: "keyword" },
            startAt: { type: "date" },
          },
        },
      },
    });
  }

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    include: { venue: true },
    orderBy: { startAt: "asc" },
  });

  const body: NonNullable<Parameters<typeof os.bulk>[0]["body"]> = [];
  for (const e of events) {
    body.push({ index: { _index: EVENTS_INDEX, _id: e.id } });
    body.push({
      id: e.id,
      slug: e.slug,
      status: e.status,
      title: e.title,
      description: e.description,
      venueName: e.venue.name,
      city: e.venue.city.toLowerCase(),
      startAt: e.startAt,
    });
  }

  if (body.length) {
    const bulk = await os.bulk({ body, refresh: true });
    const hasErrors = Boolean((bulk.body as unknown as { errors?: boolean } | undefined)?.errors);
    await prisma.searchIndexDocument.updateMany({
      where: { type: "EVENT" },
      data: { indexedAt: new Date(), lastError: hasErrors ? "BULK_ERRORS" : null },
    });
    return NextResponse.json({ ok: true, indexed: events.length, errors: hasErrors });
  }

  return NextResponse.json({ ok: true, indexed: 0, errors: false });
}
