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
 * `CMSG_`, `CMS_`, `CMSI_`, or `CMSJ_`. Portal `User.shortId` is often a bare hash — prefix
 * with `CMS_` when missing. Preserves an existing allowed prefix (normalized).
 */
export function formatHostShortIdForMeetingException(
  raw: string | null | undefined,
): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(CMSG|CMSI|CMSJ|CMS)_(.+)$/i);
  if (m) {
    const tag = m[1].toUpperCase();
    const prefix =
      tag === "CMSG" || tag === "CMS" || tag === "CMSI" || tag === "CMSJ"
        ? tag
        : "CMS";
    return `${prefix}_${m[2]}`;
  }
  return `CMS_${s}`;
}

/**
 * All string forms that may appear in `host_unq_shortid` / map tables for the same
 * logical Webex host (with or without `CMSG_` / `CMS_` / `CMSI_` / `CMSJ_` prefix).
 */
export function webexHostShortIdLookupCandidates(
  raw: string | null | undefined,
): string[] {
  const t = (raw ?? "").trim();
  if (!t) return [];
  const out = new Set<string>();
  out.add(t);
  out.add(formatHostShortIdForMeetingException(t));
  const m = t.match(/^(CMSG|CMSI|CMSJ|CMS)_(.+)$/i);
  if (m?.[2]?.trim()) out.add(m[2].trim());
  return [...out];
}
