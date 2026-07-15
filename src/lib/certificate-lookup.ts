import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";
import { s3Bucket, s3Client } from "@/lib/s3";

/**
 * Presigned download links for participant PDF certificates.
 *
 * Mirrors the `/join` phone-lookup pattern (see `public-join.ts`), but instead of
 * a Webex meeting link it resolves the S3 location stored on
 * `mission.participant_data_sheet_set.certificate_s3_location` and mints a
 * presigned GET URL that is valid for one week.
 */

/** SigV4 presigned URLs cannot outlive 7 days — one week is exactly the ceiling. */
export const CERTIFICATE_LINK_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

export type CertificateCandidate = {
  name: string;
  /** Presigned S3 GET URL; downloads the PDF. Valid for CERTIFICATE_LINK_TTL_SECONDS. */
  downloadUrl: string;
  /** ISO timestamp when downloadUrl stops working and a new link must be generated. */
  expiresAt: string;
};

type SheetCertificateRow = {
  name: string | null;
  s3_location: string | null;
  matched_phone: string | null;
};

const normalizeDigits = (value: string) => value.replace(/[^0-9]/g, "");

/** Split an `s3://bucket/key` URI (or bare key) into bucket + key. */
function parseS3Location(
  location: string,
): { bucket: string; key: string } | null {
  const trimmed = location.trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith("s3://")) {
    const withoutScheme = trimmed.slice("s3://".length);
    const slash = withoutScheme.indexOf("/");
    if (slash <= 0) return null;
    const bucket = withoutScheme.slice(0, slash);
    const key = withoutScheme.slice(slash + 1).replace(/^\/+/, "");
    if (!bucket || !key) return null;
    return { bucket, key };
  }

  // Bare object key — fall back to the configured bucket.
  const key = trimmed.replace(/^\/+/, "");
  if (!s3Bucket || !key) return null;
  return { bucket: s3Bucket, key };
}

/** A sensible download filename derived from the key, always ending in `.pdf`. */
function downloadFilename(key: string): string {
  const base = key.split("/").pop()?.trim() || "certificate.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * Mint a one-week presigned GET URL that downloads the certificate as a PDF.
 * Returns null when the stored location can't be resolved to a bucket + key.
 */
export async function generateCertificateDownloadUrl(
  s3Location: string,
): Promise<string | null> {
  const parsed = parseS3Location(s3Location);
  if (!parsed) return null;

  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key,
    ResponseContentType: "application/pdf",
    ResponseContentDisposition: `attachment; filename="${downloadFilename(
      parsed.key,
    )}"`,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: CERTIFICATE_LINK_TTL_SECONDS,
  });
}

/**
 * Raw rows on `mission.participant_data_sheet_set` whose participant phone matches
 * `phoneRaw` and that have a stored certificate location. Same digit / last-10
 * matching rules as the join lookup.
 */
async function findCertificateRowsByPhone(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<SheetCertificateRow[]> {
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  if (digits.length < 10) return [];

  try {
    return await postgres.$queryRaw<SheetCertificateRow[]>`
      SELECT
        COALESCE(NULLIF(btrim(to_jsonb(s)->>'prtcpnt_name'), ''), '') AS name,
        NULLIF(btrim(to_jsonb(s)->>'certificate_s3_location'), '') AS s3_location,
        to_jsonb(s)->>'prtcpnt_phone_no' AS matched_phone
      FROM mission.participant_data_sheet_set s
      WHERE (
        regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
        OR right(regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
      )
      AND NULLIF(btrim(to_jsonb(s)->>'certificate_s3_location'), '') IS NOT NULL
    `;
  } catch {
    return [];
  }
}

/**
 * Look up a participant by phone and return a certificate download candidate for
 * each distinct stored certificate, each with a freshly minted one-week link.
 */
export async function lookupCertificateCandidatesByPhone(
  postgres: PostgresPrismaClient,
  phoneRaw: string,
): Promise<CertificateCandidate[]> {
  const rows = await findCertificateRowsByPhone(postgres, phoneRaw);

  // Dedupe on the stored location so the same certificate isn't listed twice.
  const byLocation = new Map<string, string>(); // location -> name
  for (const row of rows) {
    const location = row.s3_location?.trim();
    if (!location) continue;
    if (!byLocation.has(location)) {
      byLocation.set(location, (row.name ?? "").trim());
    }
  }

  const expiresAt = new Date(
    Date.now() + CERTIFICATE_LINK_TTL_SECONDS * 1000,
  ).toISOString();

  const candidates = await Promise.all(
    [...byLocation.entries()].map(async ([location, name]) => {
      const downloadUrl = await generateCertificateDownloadUrl(location);
      if (!downloadUrl) return null;
      return { name, downloadUrl, expiresAt } satisfies CertificateCandidate;
    }),
  );

  return candidates
    .filter((c): c is CertificateCandidate => c !== null)
    .sort((a, b) => (a.name || "￿").localeCompare(b.name || "￿"));
}

export type CertificateLookupResult =
  | { ok: true; body: { candidates: CertificateCandidate[] } }
  | { ok: false; status: number; body: { error: string } };

/** Shared by `/api/public/certificate` and the `/certificate` server action. */
export async function executeCertificateLookup(
  postgres: PostgresPrismaClient | null,
  phone: string,
): Promise<CertificateLookupResult> {
  if (!postgres) {
    return {
      ok: false,
      status: 500,
      body: { error: "Downstream database is not configured." },
    };
  }
  if (!s3Bucket) {
    return {
      ok: false,
      status: 500,
      body: { error: "S3 bucket is not configured." },
    };
  }

  const candidates = await lookupCertificateCandidatesByPhone(postgres, phone);
  return { ok: true, body: { candidates } };
}
