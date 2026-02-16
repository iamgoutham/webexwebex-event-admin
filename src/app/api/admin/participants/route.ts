import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/admin/participants — List participants with counts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const search = searchParams.get("search") ?? "";
  const tenantId = searchParams.get("tenantId") ?? undefined;
  const optedOutFilter = searchParams.get("optedOut");

  // Build where clause
  const where: Record<string, unknown> = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (optedOutFilter === "true") {
    where.optedOut = true;
  } else if (optedOutFilter === "false") {
    where.optedOut = false;
  }

  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const [participants, total, totalOptedOut] = await Promise.all([
    prisma.participant.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        optedOut: true,
        tenantId: true,
        createdAt: true,
      },
    }),
    prisma.participant.count({ where }),
    prisma.participant.count({ where: { ...where, optedOut: true } }),
  ]);

  // Also get aggregate counts
  const [totalAll, totalActiveAll] = await Promise.all([
    prisma.participant.count(),
    prisma.participant.count({ where: { optedOut: false } }),
  ]);

  return NextResponse.json({
    participants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      totalParticipants: totalAll,
      activeParticipants: totalActiveAll,
      optedOutInView: totalOptedOut,
    },
  });
}
