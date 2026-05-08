import { logFindameetingRequest } from "@/lib/findameeting-log";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { lookupJoinCandidatesByPhoneFromParticipantSheetSet } from "@/lib/public-join";

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

  let fosterLink: string | null = null;
  try {
    const rows = await postgres.$queryRawUnsafe<Array<{ link: string | null }>>(
      "SELECT mission.func_inst_reg($1, $2, $3)::text AS link",
      phone,
      "",
      "",
    );
    fosterLink = rows[0]?.link?.trim() || null;
  } catch {
    fosterLink = null;
  }

  if (!fosterLink) {
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "no_foster_links",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error: "Alternate meeting link is not available right now.",
    };
  }

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
      note: `source=func_inst_reg; phone=${phone}`,
    });
    return { success: true, link: fosterLink, fosterLink };
  }

  await logFindameetingRequest({
    phoneEntered: phone,
    outcome: "success",
    note: `source=mission.participant_data_sheet_set; alternate=func_inst_reg; phone=${phone}`,
  });
  return { success: true, link, fosterLink };
}
