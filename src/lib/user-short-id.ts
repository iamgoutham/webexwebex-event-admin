import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateShortIdFromEmail } from "@/lib/short-id";

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const normalizeSiteHost = (siteUrl?: string | null): string => {
  const raw = (siteUrl ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    if (raw.includes("://")) {
      return new URL(raw).host.toLowerCase();
    }
  } catch {
    // Fall through to string normalization.
  }
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
};

const shortIdPrefixForSiteUrl = (siteUrl?: string | null): string | null => {
  const host = normalizeSiteHost(siteUrl);
  if (!host) return null;
  if (host === "chinmaya75.webex.com") return "CMSG";
  if (host === "chinmaya-amrit.webex.com") return "CMSD";
  return null;
};

const withSitePrefix = (
  rawShortId: string,
  siteUrl?: string | null,
): string => {
  const shortId = rawShortId.trim();
  if (!shortId) return shortId;
  const requiredPrefix = shortIdPrefixForSiteUrl(siteUrl);
  if (!requiredPrefix) return shortId;
  const prefixed = shortId.match(/^(CMSG|CMSD|CMSI|CMSJ|CMS)_(.+)$/i);
  if (prefixed) return `${requiredPrefix}_${prefixed[2]}`;
  return `${requiredPrefix}_${shortId}`;
};

const WEBEX_HOST_SHORT_ID_PREFIX_RE = /^(CMSG|CMSD|CMSI|CMSJ|CMS)_/i;

/**
 * Host short id for UI: license-sheet `SHORTID` and some DB values omit the site
 * prefix (e.g. `xolpd5`). Applies {@link withSitePrefix} from the license Webex
 * site URL when known; otherwise prefixes bare ids with `CMSG_` (primary site).
 */
export function displayWebexHostShortId(
  raw: string | null | undefined,
  licenseSiteUrl?: string | null,
): string {
  const t = (raw ?? "").trim();
  if (!t || t === "Pending") return t || "Pending";
  const s = withSitePrefix(t, licenseSiteUrl);
  if (WEBEX_HOST_SHORT_ID_PREFIX_RE.test(s)) return s;
  return `CMSG_${s.replace(WEBEX_HOST_SHORT_ID_PREFIX_RE, "")}`;
}

export const ensureUserShortId = async (
  userId: string,
  email?: string | null,
  current?: string | null,
  siteUrl?: string | null,
): Promise<string> => {
  if (current) {
    const normalizedCurrent = withSitePrefix(current, siteUrl);
    if (normalizedCurrent === current) {
      return current;
    }
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { shortId: normalizedCurrent },
        select: { shortId: true },
      });
      if (!updated.shortId) {
        throw new Error("ShortId generation returned empty value");
      }
      return updated.shortId;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(`ShortId collision while applying prefix for: ${email ?? userId}`);
      }
      throw error;
    }
  }

  if (!email) {
    throw new Error("Email is required to derive shortId.");
  }

  const shortId = withSitePrefix(generateShortIdFromEmail(email), siteUrl);

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { shortId },
      select: { shortId: true },
    });
    if (!updated.shortId) {
      throw new Error("ShortId generation returned empty value");
    }
    return updated.shortId;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error(`ShortId collision for email: ${email}`);
    }
    throw error;
  }
};
