import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guards";
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

// GET /api/hosts/participants — List participants in the current user's state (from Host table)
export async function GET() {
  const session = await requireAuth();
  const userEmail = session.user.email?.trim().toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ participants: [] });
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    return NextResponse.json({ participants: [] });
  }

  const hostStateRows = await postgres.$queryRaw<{ state: string | null }[]>`
    SELECT NULLIF(btrim(host_addr_state::text), '') AS state
    FROM mission.webex_hosts_non_india
    WHERE lower(btrim(host_email_id::text)) = ${userEmail}
    UNION
    SELECT NULLIF(btrim(host_addr_state::text), '') AS state
    FROM mission.webex_hosts_non_india_gp
    WHERE lower(btrim(host_email_id::text)) = ${userEmail}
    UNION
    SELECT NULLIF(btrim(host_addr_state::text), '') AS state
    FROM mission.webex_hosts_non_india_dattap
    WHERE lower(btrim(host_email_id::text)) = ${userEmail}
    UNION
    SELECT NULLIF(btrim(host_addr_state::text), '') AS state
    FROM vrindavan.webex_hosts_india
    WHERE lower(btrim(host_email_id::text)) = ${userEmail}
  `.catch(() => []);
  const userState = normalizeUsState(hostStateRows[0]?.state);

  if (!userState) {
    return NextResponse.json({ participants: [] });
  }

  type RawParticipant = {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    center: string | null;
    state: string | null;
  };
  const [nonIndiaRows, gpRows, indiaRows, indiaStudentRows] = await Promise.all([
    postgres.nonIndiaParticipant.findMany({
      select: {
        prtcpntEmailId: true,
        prtcpntName: true,
        chinmayaCenterName: true,
        prtcpntAddrState: true,
      },
    }),
    postgres.$queryRaw<RawParticipant[]>`
      SELECT
        lower(btrim(prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(prtcpnt_name::text), '') AS "firstName",
        NULL::text AS "lastName",
        NULLIF(btrim(prtcpnt_name::text), '') AS name,
        NULLIF(btrim(chinmaya_center_name::text), '') AS center,
        NULLIF(btrim(prtcpnt_addr_state::text), '') AS state
      FROM mission.webex_participants_non_india_gp
    `.catch(() => []),
    postgres.indiaParticipant.findMany({
      select: {
        indPrtcpntEmailId: true,
        indPrtcpntName: true,
        indChinmayaCenterName: true,
        indPrtcpntAddrState: true,
      },
    }),
    postgres.$queryRaw<RawParticipant[]>`
      SELECT
        lower(btrim(ind_prtcpnt_email_id::text)) AS email,
        NULLIF(btrim(ind_prtcpnt_name::text), '') AS "firstName",
        NULL::text AS "lastName",
        NULLIF(btrim(ind_prtcpnt_name::text), '') AS name,
        NULLIF(btrim(ind_chinmaya_center_name::text), '') AS center,
        NULLIF(btrim(ind_prtcpnt_addr_state::text), '') AS state
      FROM vrindavan.webex_participants_india_students
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
    })),
    ...gpRows,
    ...indiaRows.map((r) => ({
      email: r.indPrtcpntEmailId,
      firstName: r.indPrtcpntName,
      lastName: null,
      name: r.indPrtcpntName,
      center: r.indChinmayaCenterName,
      state: r.indPrtcpntAddrState,
    })),
    ...indiaStudentRows,
  ];

  const byEmail = new Map<string, RawParticipant>();
  for (const row of combined) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const normalizedState = normalizeUsState(row.state);
    if (!normalizedState || normalizedState !== userState) continue;
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
    });
  }

  // Emails that also exist in Host are shown but marked pickable: false.
  const hostEmails = await postgres.$queryRaw<{ email: string | null }[]>`
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
  `.catch(() => []);

  const hostEmailSet = new Set(
    hostEmails
      .map((h) => h.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  const exceptEmailSet = await fetchEmailsInProcessedExceptTables();

  const list = [...byEmail.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([email, p], index) => {
    const emailLower = email;
    let displayName =
      p.lastName && p.firstName
        ? `${p.lastName}, ${p.firstName}`
        : p.firstName ?? email;
    const regAlias = p.name?.trim();
    if (regAlias) {
      displayName = `${displayName} (${regAlias})`;
    }
    const centerName = p.center ?? "—";
    const isAlsoHost = Boolean(emailLower) && hostEmailSet.has(emailLower);
    const inExceptTable = Boolean(emailLower) && exceptEmailSet.has(emailLower);
    const pickable = Boolean(emailLower) && !isAlsoHost && !inExceptTable;
    const nonPickableReason =
      !pickable && emailLower
        ? isAlsoHost
          ? "host"
          : inExceptTable
            ? "except"
            : undefined
        : undefined;

    return {
      id: `pg-${index + 1}-${email}`,
      email,
      name: displayName,
      center: centerName,
      state: normalizeUsState(p.state) ?? "",
      /** false = listed for visibility but cannot be added to exception request */
      pickable,
      nonPickableReason,
    };
  });

  return NextResponse.json({ participants: list });
}
