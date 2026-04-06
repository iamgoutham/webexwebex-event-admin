import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";
import { fetchEmailsInProcessedExceptTables } from "@/lib/postgres-participant-except-emails";

const US_STATE_MAP: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

function normalizeUsState(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (lettersOnly.length === 2 && US_STATE_MAP[lettersOnly]) {
    return US_STATE_MAP[lettersOnly];
  }
  return trimmed;
}

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
  const limitParam = searchParams.get("limit");
  const unlimited = limitParam === "all";
  const maxPageSize = 500;
  const limit = unlimited
    ? null
    : Math.min(
        maxPageSize,
        Math.max(1, parseInt(limitParam ?? "50", 10)),
      );
  const searchTrimmed = (searchParams.get("search") ?? "").trim();
  const tenantId = searchParams.get("tenantId") ?? undefined;
  const optedOutFilter = searchParams.get("optedOut");
  const stateParam = searchParams.get("state");
  const markProcessedExceptPickability =
    searchParams.get("markProcessedExceptPickability") === "true" ||
    searchParams.get("markProcessedExceptPickability") === "1";

  const matchTermClause = (term: string): Prisma.ParticipantWhereInput => ({
    OR: [
      { email: { contains: term } },
      { name: { contains: term } },
      { firstName: { contains: term } },
      { lastName: { contains: term } },
      { center: { contains: term } },
      { phone: { contains: term } },
    ],
  });

  const searchTerms =
    searchTrimmed.length > 0
      ? searchTrimmed.split(/\s+/).filter((t) => t.length > 0)
      : [];

  const where: Prisma.ParticipantWhereInput = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (stateParam) {
    const normalizedState = normalizeUsState(stateParam);
    if (normalizedState) {
      where.state = normalizedState;
    }
  }

  if (optedOutFilter === "true") {
    where.optedOut = true;
  } else if (optedOutFilter === "false") {
    where.optedOut = false;
  }

  if (searchTerms.length === 1) {
    Object.assign(where, matchTermClause(searchTerms[0]!));
  } else if (searchTerms.length > 1) {
    const termClauses = searchTerms.map(matchTermClause);
    const baseEntries = Object.entries({ ...where }).filter(
      ([, v]) => v !== undefined,
    );
    Object.keys(where).forEach((k) => {
      delete (where as Record<string, unknown>)[k];
    });
    if (baseEntries.length === 0) {
      Object.assign(where, { AND: termClauses });
    } else {
      Object.assign(where, {
        AND: [
          ...baseEntries.map(
            ([k, v]) => ({ [k]: v }) as Prisma.ParticipantWhereInput,
          ),
          ...termClauses,
        ],
      });
    }
  }

  const findArgs: Parameters<typeof prisma.participant.findMany>[0] = {
    where,
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      center: true,
      state: true,
      phone: true,
      optedOut: true,
      tenantId: true,
      createdAt: true,
    },
  };

  if (!unlimited && limit != null) {
    findArgs.skip = (page - 1) * limit;
    findArgs.take = limit;
  }

  const [participantsRaw, total, totalOptedOut] = await Promise.all([
    prisma.participant.findMany(findArgs),
    prisma.participant.count({ where }),
    prisma.participant.count({ where: { ...where, optedOut: true } }),
  ]);

  const emailsForHostCheck = [
    ...new Set(
      participantsRaw
        .map((p) => p.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
  const hostRows =
    emailsForHostCheck.length > 0
      ? await prisma.host.findMany({
          where: { email: { in: emailsForHostCheck } },
          select: { email: true },
        })
      : [];
  const hostEmailSet = new Set(
    hostRows
      .map((h) => h.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  /** Every row is a synced participant; isHost = same email exists in Host table (broadcast/sheet). */
  let participants = participantsRaw.map((p) => {
    const e = p.email?.trim().toLowerCase();
    const isHost = Boolean(e && hostEmailSet.has(e));
    return {
      ...p,
      isParticipant: true as const,
      isHost,
    };
  });

  if (markProcessedExceptPickability) {
    const exceptSet = await fetchEmailsInProcessedExceptTables();

    participants = participants.map((p) => {
      const e = p.email?.trim().toLowerCase();
      if (!e) {
        return { ...p, pickable: true };
      }
      const isAlsoHost = p.isHost;
      const inExceptTable = exceptSet.has(e);
      const pickable = !isAlsoHost && !inExceptTable;
      const nonPickableReason = !pickable
        ? isAlsoHost
          ? "host"
          : "except"
        : undefined;
      return { ...p, pickable, nonPickableReason };
    });
  }

  // Also get aggregate counts
  const [totalAll, totalActiveAll] = await Promise.all([
    prisma.participant.count(),
    prisma.participant.count({ where: { optedOut: false } }),
  ]);

  return NextResponse.json({
    participants,
    pagination: {
      page: unlimited ? 1 : page,
      limit: unlimited ? total : limit,
      total,
      totalPages:
        unlimited || !limit
          ? 1
          : Math.max(1, Math.ceil(total / limit)),
    },
    stats: {
      totalParticipants: totalAll,
      activeParticipants: totalActiveAll,
      optedOutInView: totalOptedOut,
    },
  });
}
