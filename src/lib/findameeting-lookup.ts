import { logFindameetingRequest } from "@/lib/findameeting-log";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { lookupJoinCandidatesByPhoneFromParticipantSheetSet } from "@/lib/public-join";
import {
  loadFosterLinksFromPostgres,
  takeNextFosterRoundRobinIndex,
} from "@/lib/findameeting-fosterlinks";

export type FindameetingExecuteResult =
  | { success: true; link: string; fosterLink: string | null }
  | {
      success: false;
      status: number;
      error: string;
      hint?: string;
    };

/**
 * Find-a-meeting: require a non-empty phone and look up meeting assignment from
 * mission.participant_data_sheet_set only.
 * Used by the public API and the on-site server action (no token in the browser).
 */
export async function executeFindameetingLookup(
  phoneEntered: string,
): Promise<FindameetingExecuteResult> {
  const phone = phoneEntered.replace(/\r|\n|\t/g, " ").trim();
  if (!phone) {
    await logFindameetingRequest({
      phoneEntered: "",
      outcome: "missing_phone",
    });
    return {
      success: false,
      status: 400,
      error: "Enter your WhatsApp phone number.",
    };
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "db_unconfigured",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error: "Downstream database is not configured.",
    };
  }

  const fosterLinks = await loadFosterLinksFromPostgres();
  if (fosterLinks.length === 0) {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "no_foster_links",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error:
        "Meeting links are not configured in mission.dyn_alloc_webex_list.webex_meeting_link.",
    };
  }
  const fosterIndex = await takeNextFosterRoundRobinIndex(fosterLinks.length);
  const fosterLink = fosterLinks[fosterIndex]!;

  let candidates:
    | Awaited<ReturnType<typeof lookupJoinCandidatesByPhoneFromParticipantSheetSet>>
    | null = null;
  try {
    candidates = await lookupJoinCandidatesByPhoneFromParticipantSheetSet(
      postgres,
      phone,
    );
  } catch {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "map_lookup_error",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error: "Unable to look up meeting assignment right now.",
    };
  }

  const link = candidates[0]?.joinLink;
  if (!link) {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "not_in_maps",
      note: `source=foster; foster_index=${fosterIndex}; phone=${phone}`,
    });
    return { success: true, link: fosterLink, fosterLink };
  }

  await logFindameetingRequest({
    phoneEntered: phone,
    outcome: "success",
    note: `source=mission.participant_data_sheet_set; foster_index=${fosterIndex}; phone=${phone}`,
  });
  return { success: true, link, fosterLink };
}
