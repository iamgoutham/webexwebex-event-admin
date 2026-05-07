import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { fetchEmailsInProcessedExceptTables } from "@/lib/postgres-participant-except-emails";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

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

  const searchTerms =
    searchTrimmed.length > 0
      ? searchTrimmed.split(/\s+/).filter((t) => t.length > 0)
      : [];
  const postgres = getPostgresPrisma();
  if (!postgres) {
    return NextResponse.json(
      { error: "Downstream Postgres is not configured." },
      { status: 503 },
    );
  }

  if (tenantId) {
    return NextResponse.json(
      { error: "tenantId filter is not supported for direct Postgres participant lookups." },
      { status: 400 },
    );
  }

  type RawParticipant = {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    center: string | null;
    state: string | null;
    phone: string | null;
  };

  const [nonIndiaRows, gpRows, indiaRows, indiaStudentRows, hostRows] =
    await Promise.all([
      postgres.nonIndiaParticipant.findMany({
        select: {
          prtcpntEmailId: true,
          prtcpntName: true,
          chinmayaCenterName: true,
          prtcpntAddrState: true,
          prtcpntPhoneNo: true,
        },
      }),
      postgres.$queryRaw<RawParticipant[]>`
        SELECT
          lower(btrim(prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(prtcpnt_name::text), '') AS "firstName",
          NULL::text AS "lastName",
          NULLIF(btrim(prtcpnt_name::text), '') AS name,
          NULLIF(btrim(chinmaya_center_name::text), '') AS center,
          NULLIF(btrim(prtcpnt_addr_state::text), '') AS state,
          NULLIF(btrim(prtcpnt_phone_no::text), '') AS phone
        FROM mission.webex_participants_non_india_gp
      `.catch(() => []),
      postgres.indiaParticipant.findMany({
        select: {
          indPrtcpntEmailId: true,
          indPrtcpntName: true,
          indChinmayaCenterName: true,
          indPrtcpntAddrState: true,
          indPrtcpntPhoneNo: true,
        },
      }),
      postgres.$queryRaw<RawParticipant[]>`
        SELECT
          lower(btrim(ind_prtcpnt_email_id::text)) AS email,
          NULLIF(btrim(ind_prtcpnt_name::text), '') AS "firstName",
          NULL::text AS "lastName",
          NULLIF(btrim(ind_prtcpnt_name::text), '') AS name,
          NULLIF(btrim(ind_chinmaya_center_name::text), '') AS center,
          NULLIF(btrim(ind_prtcpnt_addr_state::text), '') AS state,
          NULLIF(btrim(ind_prtcpnt_phone_no::text), '') AS phone
        FROM vrindavan.webex_participants_india_students
      `.catch(() => []),
      postgres.$queryRaw<{ email: string | null }[]>`
        SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india
        UNION
        SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india_gp
        UNION
        SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india_dattap
        UNION
        SELECT DISTINCT lower(btrim(host_email_id::text)) AS email
        FROM vrindavan.webex_hosts_india
      `.catch(() => []),
    ]);

  const combined: RawParticipant[] = [
    ...nonIndiaRows.map((r) => ({
      email: r.prtcpntEmailId,
      firstName: r.prtcpntName,
      lastName: null,
      name: r.prtcpntName,
      center: r.chinmayaCenterName,
      state: r.prtcpntAddrState,
      phone: r.prtcpntPhoneNo,
    })),
    ...gpRows,
    ...indiaRows.map((r) => ({
      email: r.indPrtcpntEmailId,
      firstName: r.indPrtcpntName,
      lastName: null,
      name: r.indPrtcpntName,
      center: r.indChinmayaCenterName,
      state: r.indPrtcpntAddrState,
      phone: r.indPrtcpntPhoneNo,
    })),
    ...indiaStudentRows,
  ];

  const byEmail = new Map<string, RawParticipant>();
  for (const row of combined) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, row);
      continue;
    }
    byEmail.set(email, {
      email,
      firstName: prev.firstName || row.firstName,
      lastName: prev.lastName || row.lastName,
      name: prev.name || row.name,
      center: prev.center || row.center,
      state: prev.state || row.state,
      phone: prev.phone || row.phone,
    });
  }

  const hostEmailSet = new Set(
    hostRows
      .map((h) => h.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  const normalizedStateFilter = stateParam ? normalizeUsState(stateParam) : null;
  const participantsBase = [...byEmail.entries()].map(([email, row], index) => ({
    id: `pg-${index + 1}-${email}`,
    email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    center: row.center,
    state: normalizeUsState(row.state),
    phone: row.phone,
    optedOut: false,
    tenantId: null,
    createdAt: null,
    isParticipant: true as const,
    isHost: hostEmailSet.has(email),
  }));

  const matchesSearch = (row: (typeof participantsBase)[number]) => {
    if (searchTerms.length === 0) return true;
    const haystack = [
      row.email,
      row.name ?? "",
      row.firstName ?? "",
      row.lastName ?? "",
      row.center ?? "",
      row.phone ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return searchTerms.every((t) => haystack.includes(t.toLowerCase()));
  };

  let participants = participantsBase.filter((p) => {
    if (normalizedStateFilter && p.state !== normalizedStateFilter) return false;
    if (optedOutFilter === "true") return false;
    return matchesSearch(p);
  });

  participants.sort((a, b) => a.email.localeCompare(b.email));

  const total = participants.length;
  const totalOptedOut = 0;
  if (!unlimited && limit != null) {
    const start = (page - 1) * limit;
    participants = participants.slice(start, start + limit);
  }

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
  const totalAll = participantsBase.length;
  const totalActiveAll = participantsBase.length;

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
