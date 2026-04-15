import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { lookupJoinCandidatesByPhone } from "@/lib/public-join";

const schema = z.object({
  phone: z.string().min(3),
});

// POST /api/public/join
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ candidates: [] });
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    return NextResponse.json({ error: "Downstream database is not configured." }, { status: 500 });
  }

  const candidates = await lookupJoinCandidatesByPhone(
    postgres,
    parsed.data.phone,
  );
  return NextResponse.json({ candidates });
}
