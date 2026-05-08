"use server";

import { z } from "zod";
import {
  executeHelpdeskJoinLookup,
  executePublicJoinLookup,
} from "@/lib/public-join-lookup";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

const schema = z.object({
  phone: z.string().min(3),
});

export type JoinCandidate = { name: string; joinLink: string };

export type JoinLookupActionResult =
  | { ok: true; candidates: JoinCandidate[] }
  | { ok: false; error: string };

export type AlternateMeetingLinkActionResult =
  | { ok: true; link: string | null }
  | { ok: false; error: string };

/** Server-side join lookup for the /join page — no API secret in the browser. */
export async function joinLookupAction(
  phone: string,
): Promise<JoinLookupActionResult> {
  const parsed = schema.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const result = await executePublicJoinLookup(parsed.data.phone, false);
  if (!result.ok) {
    const err =
      typeof result.body === "object" &&
      result.body !== null &&
      "error" in result.body
        ? String((result.body as { error: unknown }).error)
        : "Lookup failed.";
    return { ok: false, error: err };
  }

  const body = result.body as { candidates?: JoinCandidate[] };
  return {
    ok: true,
    candidates: Array.isArray(body.candidates) ? body.candidates : [],
  };
}

/** Helpdesk lookup: single-table lookup on mission.participant_data_sheet_set. */
export async function helpJoinLookupAction(
  phone: string,
): Promise<JoinLookupActionResult> {
  const parsed = schema.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const result = await executeHelpdeskJoinLookup(parsed.data.phone);
  if (!result.ok) {
    const err =
      typeof result.body === "object" &&
      result.body !== null &&
      "error" in result.body
        ? String((result.body as { error: unknown }).error)
        : "Lookup failed.";
    return { ok: false, error: err };
  }

  const body = result.body as { candidates?: JoinCandidate[] };
  return {
    ok: true,
    candidates: Array.isArray(body.candidates) ? body.candidates : [],
  };
}

/**
 * Helpdesk alternate link from Postgres stored function:
 * mission.func_inst_reg(reg_ph_no varchar(20), reg_name varchar(60), reg_eml varchar(50))
 */
export async function helpdeskAlternateLinkAction(
  phone: string,
  regName = "",
  regEmail = "",
): Promise<AlternateMeetingLinkActionResult> {
  const parsed = schema.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    return { ok: false, error: "Downstream database is not configured." };
  }

  try {
    const rows = await postgres.$queryRawUnsafe<Array<{ link: string | null }>>(
      "SELECT mission.func_inst_reg($1, $2, $3)::text AS link",
      parsed.data.phone,
      regName ?? "",
      regEmail ?? "",
    );
    const link = rows[0]?.link?.trim() || null;
    return { ok: true, link };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stored function lookup failed.",
    };
  }
}
