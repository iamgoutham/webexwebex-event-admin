import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  loadFosterLinksFromPublic,
  takeNextFosterRoundRobinIndex,
} from "@/lib/findameeting-fosterlinks";
import { logFindameetingRequest } from "@/lib/findameeting-log";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  isPhoneMatchedInWebexHostTables,
  lookupJoinCandidatesByPhone,
  type JoinCandidate,
} from "@/lib/public-join";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(1),
});

const normDigits = (s: string) => s.replace(/[^0-9]/g, "");

// POST /api/public/findameeting
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await logFindameetingRequest({
      phoneEntered: "<invalid payload>",
      outcome: "invalid_payload",
    });
    return NextResponse.json(
      { error: "Please enter a phone number." },
      { status: 400 },
    );
  }

  const phoneEntered = parsed.data.phone.trim();
  const digits = normDigits(phoneEntered);

  if (digits.length < 10) {
    await logFindameetingRequest({ phoneEntered, outcome: "invalid_short_phone" });
    return NextResponse.json(
      { error: "Enter a phone number with at least 10 digits (including area / country code)." },
      { status: 400 },
    );
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    await logFindameetingRequest({ phoneEntered, outcome: "db_unconfigured" });
    return NextResponse.json(
      { error: "Downstream database is not configured." },
      { status: 500 },
    );
  }

  // Same map + phone matching + Webex link rules as POST /api/public/join
  // (`lookupJoinCandidatesByPhone` / `finalizeCandidates`).
  let candidates: JoinCandidate[];
  try {
    candidates = await lookupJoinCandidatesByPhone(postgres, phoneEntered);
  } catch (e) {
    const note = e instanceof Error ? e.message : "join lookup failed";
    await logFindameetingRequest({
      phoneEntered,
      outcome: "map_lookup_error",
      note,
    });
    return NextResponse.json(
      { error: "Could not verify your number. Try again later." },
      { status: 500 },
    );
  }

  const matchedParticipant = candidates.length > 0;
  const matchedHost =
    !matchedParticipant &&
    (await isPhoneMatchedInWebexHostTables(postgres, phoneEntered));

  if (!matchedParticipant && !matchedHost) {
    await logFindameetingRequest({ phoneEntered, outcome: "not_in_maps" });
    return NextResponse.json(
      {
        error:
          "We could not find that number among registered participants or hosts.",
      },
      { status: 404 },
    );
  }

  const fosterLinks = await loadFosterLinksFromPublic();
  if (fosterLinks.length === 0) {
    await logFindameetingRequest({ phoneEntered, outcome: "no_foster_links" });
    return NextResponse.json(
      { error: "Meeting links are not configured. Add lines to public/fosterlinks.txt." },
      { status: 500 },
    );
  }

  const index = await takeNextFosterRoundRobinIndex(fosterLinks.length);
  const link = fosterLinks[index]!;
  await logFindameetingRequest({
    phoneEntered,
    outcome: "success",
    note: matchedHost
      ? `foster_index=${index};via=host`
      : `foster_index=${index}`,
  });
  return NextResponse.json({ link });
}
