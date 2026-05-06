"use server";

import { z } from "zod";
import { executePublicJoinLookup } from "@/lib/public-join-lookup";

const schema = z.object({
  phone: z.string().min(3),
});

export type JoinCandidate = { name: string; joinLink: string };

export type JoinLookupActionResult =
  | { ok: true; candidates: JoinCandidate[] }
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
