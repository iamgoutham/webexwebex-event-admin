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

const normDigits = (s: string) => s.replace(/[^0-9]/g, "");

export type FindameetingExecuteResult =
  | { success: true; link: string }
  | {
      success: false;
      status: number;
      error: string;
      hint?: string;
    };

/**
 * Find-a-meeting: validate phone → Postgres maps → round-robin foster link.
 * Used by the public API and the on-site server action (no token in the browser).
 */
export async function executeFindameetingLookup(
  phoneEntered: string,
): Promise<FindameetingExecuteResult> {
  const digits = normDigits(phoneEntered);

  if (digits.length < 10) {
    await logFindameetingRequest({ phoneEntered, outcome: "invalid_short_phone" });
    return {
      success: false,
      status: 400,
      error:
        "Enter a phone number with at least 10 digits (including area / country code).",
    };
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    await logFindameetingRequest({ phoneEntered, outcome: "db_unconfigured" });
    return {
      success: false,
      status: 500,
      error: "Downstream database is not configured.",
    };
  }

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
    return {
      success: false,
      status: 500,
      error: "Could not verify your number. Try again later.",
    };
  }

  const matchedParticipant = candidates.length > 0;
  const matchedHost =
    !matchedParticipant &&
    (await isPhoneMatchedInWebexHostTables(postgres, phoneEntered));

  if (!matchedParticipant && !matchedHost) {
    await logFindameetingRequest({ phoneEntered, outcome: "not_in_maps" });
    return {
      success: false,
      status: 404,
      error:
        "We could not find that number among registered participants or hosts.",
    };
  }

  const fosterLinks = await loadFosterLinksFromPublic();
  if (fosterLinks.length === 0) {
    await logFindameetingRequest({ phoneEntered, outcome: "no_foster_links" });
    return {
      success: false,
      status: 500,
      error:
        "Meeting links are not configured. Add lines to public/fosterlinks.txt.",
    };
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
  return { success: true, link };
}
