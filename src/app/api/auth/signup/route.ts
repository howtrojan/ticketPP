import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "ip:unknown";
  const rl = await rateLimit({ key: `signup:${ip}`, limit: 10, windowSeconds: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name?.trim() || null,
        passwordHash,
      },
      select: { id: true, email: true },
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
