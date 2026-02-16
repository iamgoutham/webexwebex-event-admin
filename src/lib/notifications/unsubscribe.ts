import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// HMAC-based unsubscribe tokens
// ---------------------------------------------------------------------------
//
// Participants can unsubscribe from emails by clicking a link with a signed
// token. The token is an HMAC-SHA256 of their email, so no database lookup is
// needed to verify the token — just re-compute the HMAC and compare.
//
// Token format:  base64url(HMAC-SHA256(email))
// Verification:  re-compute the HMAC from the email in the database and
//                compare with the token using timing-safe equality.
// ---------------------------------------------------------------------------

const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_SECRET ?? process.env.NEXTAUTH_SECRET ?? "change-me";

/**
 * Generate an unsubscribe token for a participant email.
 */
export function generateUnsubscribeToken(email: string): string {
  const hmac = createHmac("sha256", UNSUBSCRIBE_SECRET);
  hmac.update(email.trim().toLowerCase());
  return hmac.digest("base64url");
}

/**
 * Verify an unsubscribe token matches a given email.
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string,
): boolean {
  const expected = generateUnsubscribeToken(email);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8"),
    );
  } catch {
    // Buffers of different lengths will throw
    return false;
  }
}

/**
 * Process an unsubscribe request.
 *
 * 1. Find the participant by looking up all participants with this token
 *    (we iterate because the token is derived from the email, and there may
 *     be duplicate participant rows across tenants).
 * 2. Set `optedOut = true` on all matching rows.
 *
 * Returns the email if successful, null otherwise.
 */
export async function processUnsubscribe(
  token: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  // We need to find which participant email maps to this token.
  // Since the token is HMAC(email), we can't reverse it — so we look up
  // all distinct participant emails and check each one.
  //
  // For 100K participants this could be slow, so instead we encode the email
  // into the URL path along with the token. The token is:
  //   /api/unsubscribe/{base64url(email)}:{hmac}
  //
  // Parse the combined token
  const separatorIdx = token.lastIndexOf(":");
  if (separatorIdx === -1) {
    return { success: false, error: "Invalid token format" };
  }

  const emailB64 = token.slice(0, separatorIdx);
  const hmacPart = token.slice(separatorIdx + 1);

  let email: string;
  try {
    email = Buffer.from(emailB64, "base64url").toString("utf8");
  } catch {
    return { success: false, error: "Invalid token encoding" };
  }

  // Verify the HMAC
  if (!verifyUnsubscribeToken(email, hmacPart)) {
    return { success: false, error: "Invalid or expired token" };
  }

  // Mark all participant rows for this email as opted out
  const result = await prisma.participant.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { optedOut: true },
  });

  if (result.count === 0) {
    return { success: false, error: "Participant not found" };
  }

  return { success: true, email };
}

/**
 * Build a full unsubscribe token string for use in URLs.
 * Format: base64url(email):hmac
 */
export function buildUnsubscribeToken(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const emailB64 = Buffer.from(normalizedEmail).toString("base64url");
  const hmac = generateUnsubscribeToken(normalizedEmail);
  return `${emailB64}:${hmac}`;
}
