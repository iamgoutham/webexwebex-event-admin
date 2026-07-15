"use server";

import { z } from "zod";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import {
  executeCertificateLookup,
  type CertificateCandidate,
} from "@/lib/certificate-lookup";

const schema = z.object({
  phone: z.string().min(3),
});

export type { CertificateCandidate };

export type CertificateLookupActionResult =
  | { ok: true; candidates: CertificateCandidate[] }
  | { ok: false; error: string };

/**
 * Server-side certificate lookup for the `/certificate` page — no API secret in
 * the browser. Returns a one-week presigned download link per stored certificate.
 */
export async function certificateLookupAction(
  phone: string,
): Promise<CertificateLookupActionResult> {
  const parsed = schema.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const result = await executeCertificateLookup(
    getPostgresPrisma(),
    parsed.data.phone,
  );
  if (!result.ok) {
    return { ok: false, error: result.body.error };
  }

  return { ok: true, candidates: result.body.candidates };
}
