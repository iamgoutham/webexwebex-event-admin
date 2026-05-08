"use server";

import { z } from "zod";
import { executeHelpdeskJoinLookup } from "@/lib/public-join-lookup";
import { loadFosterLinksFromPostgres } from "@/lib/findameeting-fosterlinks";

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

/** Helpdesk alternate link from mission.dyn_alloc_webex_list (cached). */
export async function helpdeskAlternateLinkAction(
  phone: string,
  regName = "",
  regEmail = "",
): Promise<AlternateMeetingLinkActionResult> {
  const parsed = schema.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  void phone;
  void regName;
  void regEmail;

  try {
    const links = await loadFosterLinksFromPostgres();
    const link =
      links.length > 0
        ? links[Math.floor(Math.random() * links.length)] ?? null
        : null;
    return { ok: true, link };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Alternate link lookup failed.",
    };
  }
}
