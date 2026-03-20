import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
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

// GET /api/hosts/participants — List participants in the current user's state (from Host table)
export async function GET() {
  const session = await requireAuth();
  const userEmail = session.user.email?.trim().toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ participants: [] });
  }

  const host = await prisma.host.findFirst({
    where: { email: userEmail },
    select: { state: true },
  });
  const userState = normalizeUsState(host?.state);

  if (!userState) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await prisma.participant.findMany({
    where: { state: userState },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      center: true,
      state: true,
      tenantId: true,
      tenant: { select: { name: true } },
    },
  });

  // Emails that also exist in Host are shown but marked pickable: false.
  const emails = participants
    .map((p) => p.email?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e));

  const hostEmails =
    emails.length > 0
      ? await prisma.host.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
      : [];

  const hostEmailSet = new Set(
    hostEmails
      .map((h) => h.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  const exceptEmailSet = await fetchEmailsInProcessedExceptTables();

  const list = participants.map((p) => {
    const emailLower = p.email?.trim().toLowerCase() ?? "";
    const displayName =
      p.lastName && p.firstName
        ? `${p.lastName}, ${p.firstName}`
        : p.firstName ?? p.email;
    const centerName = p.center ?? p.tenant?.name ?? "—";
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
      id: p.id,
      email: p.email,
      name: displayName,
      center: centerName,
      state: p.state ?? "",
      /** false = listed for visibility but cannot be added to exception request */
      pickable,
      nonPickableReason,
    };
  });

  return NextResponse.json({ participants: list });
}
