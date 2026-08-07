"use server";

import { z } from "zod";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  applyNameCorrection,
  executeCertificateLookup,
  type CertificateCandidate,
  type CertificateLookupMode,
} from "@/lib/certificate-lookup";

const lookupSchema = z.object({
  mode: z.enum(["phone", "email"]),
  contact: z.string().min(3),
});

const correctionSchema = z.object({
  mode: z.enum(["phone", "email"]),
  contact: z.string().min(3),
  entryId: z.string().min(1),
  name: z.string().min(2).max(100),
});

export type CertificateLookupActionResult =
  | { ok: true; candidates: CertificateCandidate[] }
  | { ok: false; error: string };

export type NameCorrectionActionResult =
  | { ok: true; candidates: CertificateCandidate[]; updated: number }
  | { ok: false; error: string };

/**
 * Server-side certificate lookup for the `/certificate` page — no API secret in
 * the browser. Returns a one-week presigned download link per generated certificate.
 */
export async function certificateLookupAction(
  mode: CertificateLookupMode,
  contact: string,
): Promise<CertificateLookupActionResult> {
  const parsed = lookupSchema.safeParse({ mode, contact: contact.trim() });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        mode === "email"
          ? "Enter the email address you registered with."
          : "Enter a valid phone number.",
    };
  }

  const result = await executeCertificateLookup(
    getPostgresPrisma(),
    parsed.data.mode,
    parsed.data.contact,
  );
  if (!result.ok) {
    return { ok: false, error: result.body.error };
  }

  return { ok: true, candidates: result.body.candidates };
}

/**
 * Apply the participant's single allowed name correction, then re-run the lookup so
 * the caller sees the updated registration without a second round trip.
 */
export async function correctNameAction(
  mode: CertificateLookupMode,
  contact: string,
  entryId: string,
  name: string,
): Promise<NameCorrectionActionResult> {
  const parsed = correctionSchema.safeParse({
    mode,
    contact: contact.trim(),
    entryId: entryId.trim(),
    name: name.trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter your full name (2–100 characters)." };
  }

  const postgres = getPostgresPrisma();
  const applied = await applyNameCorrection(
    postgres,
    parsed.data.mode,
    parsed.data.contact,
    parsed.data.entryId,
    parsed.data.name,
  );
  if (!applied.ok) {
    return { ok: false, error: applied.error };
  }

  const refreshed = await executeCertificateLookup(
    postgres,
    parsed.data.mode,
    parsed.data.contact,
  );
  return {
    ok: true,
    candidates: refreshed.ok ? refreshed.body.candidates : [],
    updated: applied.updated,
  };
}
