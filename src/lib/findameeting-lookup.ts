import { loadFosterLinksFromPostgres } from "@/lib/findameeting-fosterlinks";
import { logFindameetingRequest } from "@/lib/findameeting-log";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  lookupJoinCandidatesByPhoneFromParticipantSheetSet,
  participantSheetPhoneDebugSnapshot,
  type ParticipantSheetPhoneDebugSnapshot,
} from "@/lib/public-join";

/** Extra API decision fields appended when calling with `{ debug: true }`. */
export type FindameetingDebugExtras = {
  sheetLookupCaughtError?: string;
  sheetPrimaryCandidateLink: string | null;
  usedFuncInstRegForPrimaryLink: boolean;
  funcInstRegReturnedLink: boolean;
  dynAllocPoolCount: number;
};

export type FindameetingExecuteResult =
  | {
      success: true;
      link: string;
      fosterLink: string | null;
      debug?: ParticipantSheetPhoneDebugSnapshot & FindameetingDebugExtras;
    }
  | {
      success: false;
      status: number;
      error: string;
      hint?: string;
      debug?: ParticipantSheetPhoneDebugSnapshot & FindameetingDebugExtras;
    };

function pickDynAllocFosterLink(links: string[]): string | null {
  if (links.length === 0) return null;
  return links[Math.floor(Math.random() * links.length)] ?? null;
}

/**
 * Find-a-meeting: look up phone in mission.participant_data_sheet_set first.
 * If no match → mission.func_inst_reg; use that URL for both link and fosterLink.
 * If match → assignment link from the sheet + fosterLink from mission.dyn_alloc_webex_list
 * (via loadFosterLinksFromPostgres, cached).
 * Used by the public API and the on-site server action (no token in the browser).
 * Pass `{ debug: true }` to attach a participant-sheet snapshot (counts, samples, per-query errors).
 */
export async function executeFindameetingLookup(
  phoneEntered: string,
  options?: { debug?: boolean },
): Promise<FindameetingExecuteResult> {
  const wantDebug = Boolean(options?.debug);
  let debugMerged:
    | (ParticipantSheetPhoneDebugSnapshot & FindameetingDebugExtras)
    | undefined;

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
  const dynLinksForDebug = wantDebug ? await loadFosterLinksFromPostgres() : [];
  if (wantDebug && postgres) {
    const snap = await participantSheetPhoneDebugSnapshot(postgres, phone);
    debugMerged = {
      ...snap,
      sheetPrimaryCandidateLink: snap.finalizedCandidates[0]?.joinLink ?? null,
      usedFuncInstRegForPrimaryLink: false,
      funcInstRegReturnedLink: false,
      dynAllocPoolCount: dynLinksForDebug.length,
    };
  }

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
      debug: debugMerged,
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
  } catch (sheetErr) {
    if (wantDebug && debugMerged) {
      debugMerged.sheetLookupCaughtError =
        sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
    }
    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "map_lookup_error",
      note: `phone=${phone}`,
    });
    return {
      success: false,
      status: 500,
      error: "Unable to look up meeting assignment right now.",
      debug: debugMerged,
    };
  }

  const sheetLink = candidates[0]?.joinLink ?? null;

  if (wantDebug && debugMerged) {
    debugMerged.sheetPrimaryCandidateLink = sheetLink;
    debugMerged.usedFuncInstRegForPrimaryLink = false;
    debugMerged.funcInstRegReturnedLink = false;
  }

  if (!sheetLink) {
    let instLink: string | null = null;
    try {
      const rows =
        await postgres.$queryRawUnsafe<Array<{ link: string | null }>>(
          "SELECT mission.func_inst_reg($1, $2, $3)::text AS link",
          phone,
          "",
          "",
        );
      instLink = rows[0]?.link?.trim() || null;
    } catch {
      instLink = null;
    }

    if (wantDebug && debugMerged) {
      debugMerged.usedFuncInstRegForPrimaryLink = true;
      debugMerged.funcInstRegReturnedLink = Boolean(instLink);
    }

    if (!instLink) {
      await logFindameetingRequest({
        phoneEntered: phone,
        outcome: "not_found_no_inst_reg",
        note: `phone=${phone}`,
      });
      return {
        success: false,
        status: 500,
        error: "Meeting link is not available right now.",
        debug: debugMerged,
      };
    }

    await logFindameetingRequest({
      phoneEntered: phone,
      outcome: "not_in_sheet_inst_reg",
      note: `source=mission.func_inst_reg; phone=${phone}`,
    });
    return {
      success: true,
      link: instLink,
      fosterLink: instLink,
      debug: debugMerged,
    };
  }

  const dynLinks =
    dynLinksForDebug.length > 0 ? dynLinksForDebug : await loadFosterLinksFromPostgres();
  const fosterLink = pickDynAllocFosterLink(dynLinks);

  if (wantDebug && debugMerged) {
    debugMerged.dynAllocPoolCount = dynLinks.length;
  }

  await logFindameetingRequest({
    phoneEntered: phone,
    outcome: "success",
    note: `source=mission.participant_data_sheet_set; foster=dyn_alloc; phone=${phone}`,
  });
  return { success: true, link: sheetLink, fosterLink, debug: debugMerged };
}
