import bcrypt from "bcryptjs";
import { PrismaClient, SectorKind, EventStatus, TicketStatus } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function main() {
  const adminEmail = "admin@local.test";
  const adminPassword = "admin123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
  });

  const venue1 = await prisma.venue.upsert({
    where: { id: "seed-venue-1" },
    update: {},
    create: {
      id: "seed-venue-1",
      name: "Arena Aurora",
      city: "São Paulo",
      state: "SP",
      country: "BR",
      addressLine1: "Av. das Estrelas, 1000",
    },
  });

  const venue2 = await prisma.venue.upsert({
    where: { id: "seed-venue-2" },
    update: {},
    create: {
      id: "seed-venue-2",
      name: "Teatro Mirante",
      city: "Rio de Janeiro",
      state: "RJ",
      country: "BR",
      addressLine1: "Rua do Mirante, 50",
    },
  });

  const spPista = await prisma.sector.upsert({
    where: { venueId_name: { venueId: venue1.id, name: "Pista Premium" } },
    update: {},
    create: {
      venueId: venue1.id,
      name: "Pista Premium",
      kind: SectorKind.GENERAL_ADMISSION,
      capacity: 2500,
      sortOrder: 10,
    },
  });

  const spCamarote = await prisma.sector.upsert({
    where: { venueId_name: { venueId: venue1.id, name: "Camarote" } },
    update: {},
    create: {
      venueId: venue1.id,
      name: "Camarote",
      kind: SectorKind.GENERAL_ADMISSION,
      capacity: 600,
      sortOrder: 20,
    },
  });

  const rjPlateia = await prisma.sector.upsert({
    where: { venueId_name: { venueId: venue2.id, name: "Plateia" } },
    update: {},
    create: {
      venueId: venue2.id,
      name: "Plateia",
      kind: SectorKind.SEATED,
      capacity: 240,
      sortOrder: 10,
    },
  });

  const rjBalcao = await prisma.sector.upsert({
    where: { venueId_name: { venueId: venue2.id, name: "Balcão" } },
    update: {},
    create: {
      venueId: venue2.id,
      name: "Balcão",
      kind: SectorKind.SEATED,
      capacity: 120,
      sortOrder: 20,
    },
  });

  async function ensureSeats(sectorId: string, rows: string[], seatsPerRow: number) {
    const existing = await prisma.seat.count({ where: { sectorId } });
    if (existing > 0) return;

    const data: { sectorId: string; label: string; row: string; number: number }[] = [];
    for (const row of rows) {
      for (let i = 1; i <= seatsPerRow; i++) {
        data.push({ sectorId, label: `${row}${i}`, row, number: i });
      }
    }
    await prisma.seat.createMany({ data });
  }

  await ensureSeats(rjPlateia.id, ["A", "B", "C", "D", "E", "F"], 20);
  await ensureSeats(rjBalcao.id, ["G", "H", "I"], 20);

  const now = new Date();
  const eventsSeed = [
    {
      title: "Neon Nights Festival",
      description:
        "Uma experiência premium com som imersivo, luzes e uma curadoria de artistas que vira madrugada.",
      venueId: venue1.id,
      startAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 10),
      coverImageUrl: null,
      sectors: [
        { sectorId: spPista.id, name: "Lote 1", priceCents: 17900, quantity: 1500 },
        { sectorId: spPista.id, name: "Lote 2", priceCents: 21900, quantity: 1000 },
        { sectorId: spCamarote.id, name: "Camarote", priceCents: 39900, quantity: 600 },
      ],
    },
    {
      title: "Orquestra do Amanhã",
      description: "Concerto intimista com repertório contemporâneo e clássicos revisitados.",
      venueId: venue2.id,
      startAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 21),
      coverImageUrl: null,
      sectors: [
        { sectorId: rjPlateia.id, name: "Plateia", priceCents: 14900, quantity: 240 },
        { sectorId: rjBalcao.id, name: "Balcão", priceCents: 9900, quantity: 120 },
      ],
    },
  ];

  for (const e of eventsSeed) {
    const slug = slugify(e.title);
    const event = await prisma.event.upsert({
      where: { slug },
      update: {
        title: e.title,
        description: e.description,
        venueId: e.venueId,
        startAt: e.startAt,
        status: EventStatus.PUBLISHED,
        coverImageUrl: e.coverImageUrl,
      },
      create: {
        slug,
        title: e.title,
        description: e.description,
        venueId: e.venueId,
        startAt: e.startAt,
        status: EventStatus.PUBLISHED,
        coverImageUrl: e.coverImageUrl,
        createdById: admin.id,
      },
    });

    const existingLots = await prisma.ticketLot.findMany({ where: { eventId: event.id } });
    const lotsByName = new Map(existingLots.map((l) => [l.name, l]));

    for (const s of e.sectors) {
      const lot =
        lotsByName.get(s.name) ??
        (await prisma.ticketLot.create({
          data: {
            eventId: event.id,
            sectorId: s.sectorId,
            name: s.name,
            priceCents: s.priceCents,
            currency: "BRL",
            quantity: s.quantity,
          },
        }));

      const sector = await prisma.sector.findUniqueOrThrow({
        where: { id: s.sectorId },
        include: { seats: true },
      });

      const existingTickets = await prisma.ticket.count({
        where: { eventId: event.id, sectorId: sector.id, lotId: lot.id },
      });

      if (existingTickets > 0) continue;

      if (sector.kind === SectorKind.SEATED) {
        const seatTickets = sector.seats.slice(0, s.quantity).map((seat) => ({
          eventId: event.id,
          sectorId: sector.id,
          lotId: lot.id,
          seatId: seat.id,
          status: TicketStatus.AVAILABLE,
          priceCents: s.priceCents,
          currency: "BRL",
        }));
        await prisma.ticket.createMany({ data: seatTickets });
      } else {
        const gaTickets = Array.from({ length: s.quantity }).map(() => ({
          eventId: event.id,
          sectorId: sector.id,
          lotId: lot.id,
          status: TicketStatus.AVAILABLE,
          priceCents: s.priceCents,
          currency: "BRL",
        }));
        await prisma.ticket.createMany({ data: gaTickets });
      }

      await prisma.searchIndexDocument.upsert({
        where: { type_eventId: { type: "EVENT", eventId: event.id } },
        update: { lastError: null },
        create: { type: "EVENT", eventId: event.id },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
