import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  lookupJoinCandidatesByPhone,
  lookupJoinCandidatesByPhoneWithDebug,
} from "@/lib/public-join";

export type PublicJoinLookupResult =
  | { ok: true; body: unknown }
  | {
      ok: false;
      status: number;
      body: unknown;
    };

/** Shared by `/api/public/join` and the `/join` server action. */
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
    const result = await lookupJoinCandidatesByPhoneWithDebug(postgres, phone);
    return { ok: true, body: result };
  }

  const candidates = await lookupJoinCandidatesByPhone(postgres, phone);
  return { ok: true, body: { candidates } };
}
