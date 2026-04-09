import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOpenSearch, EVENTS_INDEX } from "@/lib/opensearch";

const querySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  take: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });

  const { q, city, take, cursor } = parsed.data;

  const os = getOpenSearch();
  if (os && q?.trim()) {
    const res = await os.search({
      index: EVENTS_INDEX,
      size: take,
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: q,
                  fields: ["title^3", "description", "venueName^2", "city^2"],
                  fuzziness: "AUTO",
                },
              },
            ],
            filter: [
              { term: { status: "PUBLISHED" } },
              ...(city ? [{ term: { city: city.toLowerCase() } }] : []),
            ],
          },
        },
        sort: [{ startAt: "asc" }],
      },
    });

    const body = res.body as unknown as { hits?: { hits?: { _source?: unknown }[] } };
    const hits = body.hits?.hits ?? [];
    const items = hits.map((h) => h._source);
    return NextResponse.json({ items, nextCursor: null });
  }

  const items = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(city
        ? { venue: { city: { contains: city, mode: "insensitive" } } }
        : undefined),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { venue: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined),
    },
    include: { venue: true },
    orderBy: { startAt: "asc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : undefined),
  });

  const next = items.length > take ? items[items.length - 1] : null;
  const sliced = next ? items.slice(0, -1) : items;

  return NextResponse.json({
    items: sliced.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      startAt: e.startAt,
      coverImageUrl: e.coverImageUrl,
      venue: { name: e.venue.name, city: e.venue.city, state: e.venue.state },
    })),
    nextCursor: next?.id ?? null,
  });
}
