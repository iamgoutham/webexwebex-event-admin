import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";

const gridSchema = z.object({
  rows: z.number().int().min(5).max(9),
  cols: z.number().int().min(5).max(9),
});

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth();
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = gridSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      gridRows: parsed.data.rows,
      gridCols: parsed.data.cols,
    },
    select: { gridRows: true, gridCols: true },
  });

  return NextResponse.json({ grid: user });
}
