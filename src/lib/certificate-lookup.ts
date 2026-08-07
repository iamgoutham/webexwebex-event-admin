import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";
import { s3Bucket, s3Client } from "@/lib/s3";

/**
 * Presigned download links for participant PDF certificates.
 *
 * Mirrors the `/join` phone-lookup pattern (see `public-join.ts`), but resolves the
 * S3 location stored on `mission.participant_data_sheet_set.certificate_s3_location`
 * and mints a presigned GET URL valid for one week.
 *
 * Participants may also look themselves up by registered email (some forget which
 * number they registered with), and may correct their registered name exactly once.
 * The corrected name is written back to the sheet; an external job re-renders the
 * PDF at `certificates/<prtcpnt_entry_id>.pdf`.
 */

/** SigV4 presigned URLs cannot outlive 7 days — one week is exactly the ceiling. */
export const CERTIFICATE_LINK_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

/** Where participants are sent once their single name correction is spent. */
export const CERTIFICATE_SUPPORT_EMAIL = "cgs@chinmayavrindavan.org";

/** Distinct participants shown after duplicate registrations are collapsed. */
const MAX_CANDIDATES = 50;

/**
 * Raw rows pulled before de-duplication. One shared phone matches 424 rows, so this
 * is deliberately wider than MAX_CANDIDATES; rows holding a certificate are ordered
 * first, so they survive the window even for the busiest numbers.
 */
const RAW_ROW_LIMIT = 400;

export type CertificateLookupMode = "phone" | "email";

export type CertificateCandidate = {
  /** Unique registration id (`prtcpnt_entry_id`); also the certificate filename stem. */
  entryId: string;
  /** Registered name; empty string when the sheet has no name on record. */
  name: string;
  /** Presigned S3 GET URL, or null when no certificate has been generated yet. */
  downloadUrl: string | null;
  /** ISO expiry of downloadUrl; null when there is no link. */
  expiresAt: string | null;
  /** True once the one allowed name correction has been used. */
  nameChangeUsed: boolean;
  /**
   * True when the name was corrected but the stored PDF still predates that change,
   * i.e. the external job has not re-rendered it yet.
   */
  regenerationPending: boolean;
};

type SheetRow = {
  entry_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  s3_location: string | null;
  name_change_count: number;
  name_changed_at: Date | null;
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

  try {
    return await getSignedUrl(s3Client, command, {
      expiresIn: CERTIFICATE_LINK_TTL_SECONDS,
    });
  } catch {
    // Missing credentials or a bad key must not take down the whole lookup —
    // the row simply shows as "no certificate available yet".
    return null;
  }
}

/**
 * True when the stored PDF is older than the name correction, meaning the external
 * generator has not caught up yet. Best-effort: on any S3 error we assume it is fine
 * rather than hiding a certificate the participant can legitimately download.
 */
async function isRegenerationPending(
  s3Location: string,
  nameChangedAt: Date | null,
): Promise<boolean> {
  if (!nameChangedAt) return false;
  const parsed = parseS3Location(s3Location);
  if (!parsed) return false;

  try {
    const head = await s3Client.send(
      new HeadObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    );
    if (!head.LastModified) return false;
    return head.LastModified.getTime() < nameChangedAt.getTime();
  } catch {
    return false;
  }
}

/** WHERE fragment matching a participant by phone digits or by registered email. */
function contactMatchSql(mode: CertificateLookupMode, contact: string): Prisma.Sql | null {
  if (mode === "email") {
    const email = contact.trim().toLowerCase();
    if (!email || !email.includes("@")) return null;
    return Prisma.sql`lower(btrim(COALESCE(s.prtcpnt_email_id, ''))) = ${email}`;
  }

  const digits = normalizeDigits(contact);
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  const normalized = Prisma.sql`regexp_replace(btrim(COALESCE(s.prtcpnt_phone_no, '')), '[^0-9]', '', 'g')`;
  return Prisma.sql`(${normalized} = ${digits} OR right(${normalized}, 10) = ${last10})`;
}

/**
 * Registrations matching the contact. Rows without a certificate are included on
 * purpose: a participant whose name is missing has no certificate yet, and must be
 * able to find their registration in order to supply one.
 */
async function findRowsByContact(
  postgres: PostgresPrismaClient,
  mode: CertificateLookupMode,
  contact: string,
): Promise<SheetRow[]> {
  const match = contactMatchSql(mode, contact);
  if (!match) return [];

  try {
    const rows = await postgres.$queryRaw<SheetRow[]>(Prisma.sql`
      SELECT
        s.prtcpnt_entry_id::text                             AS entry_id,
        COALESCE(NULLIF(btrim(s.prtcpnt_name), ''), '')      AS name,
        NULLIF(btrim(s.prtcpnt_email_id), '')                AS email,
        NULLIF(btrim(s.prtcpnt_phone_no), '')                AS phone,
        NULLIF(btrim(s.certificate_s3_location), '')         AS s3_location,
        COALESCE(s.name_change_count, 0)::int                AS name_change_count,
        s.name_changed_at                                    AS name_changed_at
      FROM mission.participant_data_sheet_set s
      WHERE ${match}
      ORDER BY
        (NULLIF(btrim(s.certificate_s3_location), '') IS NULL),
        s.prtcpnt_name NULLS LAST,
        s.prtcpnt_entry_id
      LIMIT ${RAW_ROW_LIMIT}
    `);
    return rows;
  } catch {
    return [];
  }
}

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Collapse rows that describe the same participant registered more than once:
 * same name + same email, or same name + same phone. Grouping is transitive, so
 * rows linked through either key end up in one group.
 *
 * Rows with no name are never merged — two unknown names are not evidence of the
 * same person, and merging them would cost one of them the chance to supply a name.
 *
 * The surviving row is the one holding a certificate, so a collapsed duplicate can
 * never hide a downloadable PDF.
 */
function dedupeRows(rows: SheetRow[]): SheetRow[] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const name = normalizeName(row.name ?? "");
    if (!name) return; // unnamed rows stay distinct

    const digits = normalizeDigits(row.phone ?? "");
    const email = (row.email ?? "").trim().toLowerCase();

    const keys: string[] = [];
    if (digits.length >= 10) keys.push(`${name}|p|${digits.slice(-10)}`);
    if (email) keys.push(`${name}|e|${email}`);

    for (const key of keys) {
      const previous = seen.get(key);
      if (previous === undefined) seen.set(key, i);
      else union(previous, i);
    }
  });

  // Prefer the row that actually has a certificate; ties keep the first seen.
  const best = new Map<number, number>();
  rows.forEach((row, i) => {
    const group = find(i);
    const incumbent = best.get(group);
    if (incumbent === undefined) {
      best.set(group, i);
      return;
    }
    if (!rows[incumbent].s3_location && row.s3_location) best.set(group, i);
  });

  const chosen = new Set(best.values());
  return rows.filter((_, i) => chosen.has(i));
}

/**
 * Look up registrations by phone or email and attach a freshly minted one-week
 * download link to every row that already has a generated certificate.
 */
export async function lookupCertificateCandidates(
  postgres: PostgresPrismaClient,
  mode: CertificateLookupMode,
  contact: string,
): Promise<CertificateCandidate[]> {
  const rows = dedupeRows(
    await findRowsByContact(postgres, mode, contact),
  ).slice(0, MAX_CANDIDATES);

  return Promise.all(
    rows.map(async (row) => {
      const location = row.s3_location?.trim() || null;
      const nameChangedAt =
        row.name_changed_at instanceof Date ? row.name_changed_at : null;

      const [downloadUrl, regenerationPending] = location
        ? await Promise.all([
            generateCertificateDownloadUrl(location),
            isRegenerationPending(location, nameChangedAt),
          ])
        : [null, Boolean(nameChangedAt)];

      return {
        entryId: row.entry_id,
        name: row.name ?? "",
        downloadUrl,
        expiresAt: downloadUrl
          ? new Date(Date.now() + CERTIFICATE_LINK_TTL_SECONDS * 1000).toISOString()
          : null,
        nameChangeUsed: Number(row.name_change_count ?? 0) > 0,
        regenerationPending,
      } satisfies CertificateCandidate;
    }),
  );
}

export type CertificateLookupResult =
  | { ok: true; body: { candidates: CertificateCandidate[] } }
  | { ok: false; status: number; body: { error: string } };

/** Shared by `/api/public/certificate` and the `/certificate` server action. */
export async function executeCertificateLookup(
  postgres: PostgresPrismaClient | null,
  mode: CertificateLookupMode,
  contact: string,
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

  const candidates = await lookupCertificateCandidates(postgres, mode, contact);
  return { ok: true, body: { candidates } };
}

export type NameCorrectionResult =
  | { ok: true }
  | { ok: false; error: string; alreadyUsed?: boolean };

/**
 * Record a participant's single allowed name correction.
 *
 * The UPDATE re-verifies the contact and the unused-allowance guard in its own
 * WHERE clause, so it is safe against a guessed `entryId` and against double
 * submits: a second concurrent call matches zero rows instead of incrementing
 * twice. `orig_prtcpnt_name` preserves whatever was originally registered.
 */
export async function applyNameCorrection(
  postgres: PostgresPrismaClient | null,
  mode: CertificateLookupMode,
  contact: string,
  entryId: string,
  newName: string,
): Promise<NameCorrectionResult> {
  if (!postgres) {
    return { ok: false, error: "Downstream database is not configured." };
  }

  const match = contactMatchSql(mode, contact);
  if (!match) {
    return { ok: false, error: "Enter a valid phone number or email." };
  }

  const name = newName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "Enter your full name (2–100 characters)." };
  }

  const id = entryId.trim();
  if (!id) return { ok: false, error: "Select the registration to correct." };

  let updated = 0;
  try {
    updated = await postgres.$executeRaw(Prisma.sql`
      UPDATE mission.participant_data_sheet_set s
      SET orig_prtcpnt_name = COALESCE(s.orig_prtcpnt_name, s.prtcpnt_name),
          prtcpnt_name      = ${name},
          name_change_count = COALESCE(s.name_change_count, 0) + 1,
          name_changed_at   = now()
      WHERE s.prtcpnt_entry_id = ${id}
        AND COALESCE(s.name_change_count, 0) = 0
        AND ${match}
    `);
  } catch {
    return { ok: false, error: "Could not save the name. Please try again." };
  }

  if (updated === 0) {
    // Either the allowance is spent, or the entry does not belong to this contact.
    return {
      ok: false,
      alreadyUsed: true,
      error: `This registration's one-time name change has already been used. Please email ${CERTIFICATE_SUPPORT_EMAIL} for further changes.`,
    };
  }

  return { ok: true };
}
