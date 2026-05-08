"use server";

import { executeFindameetingLookup } from "@/lib/findameeting-lookup";

export type FindameetingActionResult =
  | { ok: true; link: string; fosterLink: string | null }
  | { ok: false; error: string };

/** Server-side lookup for the /findameeting page — no shared secret in the browser. */
export async function findMeetingLinkAction(
  phone: string,
): Promise<FindameetingActionResult> {
  const result = await executeFindameetingLookup(phone.trim());
  if (result.success) {
    return { ok: true, link: result.link, fosterLink: result.fosterLink };
  }
  return { ok: false, error: result.error };
}
