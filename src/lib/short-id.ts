import { randomBytes } from "crypto";

const SHORT_ID_BYTES = 6;

export const generateShortId = () => randomBytes(SHORT_ID_BYTES).toString("hex");

export const generateShortIdFromEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Meeting exception sheet / Postgres expect a Webex-style host short id with prefix
 * `CMS_`, `CMSI_`, or `CMSJ_`. Portal `User.shortId` is often a bare hash — prefix
 * with `CMS_` when missing. Preserves an existing allowed prefix (normalized).
 */
export function formatHostShortIdForMeetingException(
  raw: string | null | undefined,
): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(CMS|CMSI|CMSJ)_(.+)$/i);
  if (m) {
    const tag = m[1].toUpperCase();
    const prefix =
      tag === "CMS" || tag === "CMSI" || tag === "CMSJ" ? tag : "CMS";
    return `${prefix}_${m[2]}`;
  }
  return `CMS_${s}`;
}
