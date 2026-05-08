import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  lookupJoinCandidatesByPhoneFromParticipantSheetSet,
  participantSheetPhoneDebugSnapshot,
} from "@/lib/public-join";

export type PublicJoinLookupResult =
  | { ok: true; body: unknown }
  | {
      ok: false;
      status: number;
      body: unknown;
    };

/**
 * Shared by `/api/public/join` and the `/join` server action.
 * Uses mission.participant_data_sheet_set only (same rules as Helpdesk).
 */
export async function executePublicJoinLookup(
  phone: string,
  debug: boolean,
): Promise<PublicJoinLookupResult> {
  const postgres = getPostgresPrisma();
  if (!postgres) {
    return {
      ok: false,
      status: 500,
      body: { error: "Downstream database is not configured." },
    };
  }

  if (debug) {
    const snapshot = await participantSheetPhoneDebugSnapshot(postgres, phone);
    return {
      ok: true,
      body: {
        candidates: snapshot.finalizedCandidates,
        debug: snapshot,
      },
    };
  }

  const candidates = await lookupJoinCandidatesByPhoneFromParticipantSheetSet(
    postgres,
    phone,
  );
  return { ok: true, body: { candidates } };
}

/** Shared by Helpdesk embedded lookup: single-table source only. */
export async function executeHelpdeskJoinLookup(
  phone: string,
): Promise<PublicJoinLookupResult> {
  const postgres = getPostgresPrisma();
  if (!postgres) {
    return {
      ok: false,
      status: 500,
      body: { error: "Downstream database is not configured." },
    };
  }

  const candidates = await lookupJoinCandidatesByPhoneFromParticipantSheetSet(
    postgres,
    phone,
  );
  return { ok: true, body: { candidates } };
}
