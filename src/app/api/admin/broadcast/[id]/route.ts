import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/admin/broadcast/[id] — Get broadcast details
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const broadcast = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      sender: { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  });

  if (!broadcast) {
    return NextResponse.json(
      { error: "Broadcast not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ broadcast });
}
