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

/**
 * Distinct participants shown after duplicate registrations are collapsed.
 * Group registrations are large — one school phone covers 71 people and one school
 * email 64 — and anyone cut off here could never reach their certificate, so this
 * sits well above the real maximum rather than at a tidy round number.
 */
const MAX_CANDIDATES = 200;

/**
 * Raw rows pulled before de-duplication: the busiest phone has 126 rows and the
 * busiest email 108. Rows holding a certificate are ordered first, so they survive
 * the window even if a contact ever outgrows it.
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
   * True while the corrected certificate is still coming: either a regeneration is
   * queued or running, or the stored PDF simply predates the name change.
   */
  regenerationPending: boolean;
  /** Status of the latest queued regeneration, or null when none was ever queued. */
  regenStatus: RegenStatus | null;
};

type SheetRow = {
  entry_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  s3_location: string | null;
  name_change_count: number;
  name_changed_at: Date | null;
  regen_status: RegenStatus | null;
};

/** Status of the most recent `mission.certificate_regen_queue` row for a registration. */
export type RegenStatus = "pending" | "processing" | "done" | "failed";

const REGEN_ACTIVE: ReadonlySet<string> = new Set(["pending", "processing"]);

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
        s.name_changed_at                                    AS name_changed_at,
        q.status                                             AS regen_status
      FROM mission.participant_data_sheet_set s
      LEFT JOIN LATERAL (
        SELECT r.status
        FROM mission.certificate_regen_queue r
        WHERE r.prtcpnt_entry_id = s.prtcpnt_entry_id
        ORDER BY r.id DESC
        LIMIT 1
      ) q ON TRUE
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

      const regenStatus = row.regen_status ?? null;
      // A queued or running job is authoritative; otherwise fall back to comparing
      // the stored PDF against the name change, which also covers corrections made
      // before the queue existed.
      const queued = regenStatus !== null && REGEN_ACTIVE.has(regenStatus);

      const [downloadUrl, staleAgainstS3] = location
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
        regenerationPending: queued || staleAgainstS3,
        regenStatus,
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
  | { ok: true; updated: number }
  | { ok: false; error: string; alreadyUsed?: boolean };

/** SQL-side equivalent of `normalizeName`: trim, collapse runs of whitespace, lowercase. */
const normalizedNameSql = (column: string): Prisma.Sql =>
  Prisma.sql`lower(regexp_replace(btrim(COALESCE(${Prisma.raw(column)}, '')), '\\s+', ' ', 'g'))`;

/**
 * Record a participant's single allowed name correction.
 *
 * A participant who registered several times has one row per registration, and
 * correcting only the row they clicked would leave the duplicates showing the old
 * name — including whichever one the certificate generator happens to read. The
 * correction therefore applies to the whole duplicate group: every row sharing the
 * old name together with the same email or the same phone.
 *
 * Anchoring on the selected row keeps this safe. That row must match the contact
 * the participant just searched, so a guessed `entryId` still cannot rename anyone,
 * and the group can only ever extend to rows carrying that same person's name and
 * contact details.
 *
 * Rows with no name are never grouped — two blank names are not evidence of the
 * same person — so supplying a missing name updates only the selected row.
 *
 * `COALESCE(name_change_count, 0) = 0` appears in both the anchor lookup and the
 * UPDATE, so the one-time limit holds and a second concurrent submit matches zero
 * rows instead of incrementing twice. `orig_prtcpnt_name` preserves whatever was
 * originally registered.
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

  const spent: NameCorrectionResult = {
    ok: false,
    alreadyUsed: true,
    error: `This registration's one-time name change has already been used. Please email ${CERTIFICATE_SUPPORT_EMAIL} for further changes.`,
  };

  try {
    // The selected row, proven to belong to this contact and still unspent.
    const anchors = await postgres.$queryRaw<
      { name: string; email: string | null; phone: string | null }[]
    >(Prisma.sql`
      SELECT
        COALESCE(NULLIF(btrim(s.prtcpnt_name), ''), '') AS name,
        NULLIF(btrim(s.prtcpnt_email_id), '')           AS email,
        NULLIF(btrim(s.prtcpnt_phone_no), '')           AS phone
      FROM mission.participant_data_sheet_set s
      WHERE s.prtcpnt_entry_id = ${id}
        AND COALESCE(s.name_change_count, 0) = 0
        AND ${match}
    `);
    const anchor = anchors[0];
    if (!anchor) return spent;

    const target = buildCorrectionTargetSql(id, anchor);

    // The rename and the regeneration requests commit together. A rename that
    // failed to enqueue would leave the sheet saying one name and the PDF another
    // with nothing scheduled to reconcile them, and the participant's one
    // correction already spent.
    const entryIds = await postgres.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ prtcpnt_entry_id: string }[]>(Prisma.sql`
        UPDATE mission.participant_data_sheet_set s
        SET orig_prtcpnt_name = COALESCE(s.orig_prtcpnt_name, s.prtcpnt_name),
            prtcpnt_name      = ${name},
            name_change_count = COALESCE(s.name_change_count, 0) + 1,
            name_changed_at   = now()
        WHERE ${target}
          AND COALESCE(s.name_change_count, 0) = 0
        RETURNING s.prtcpnt_entry_id
      `);

      const ids = rows.map((r) => r.prtcpnt_entry_id);
      if (ids.length === 0) return ids;

      // One request per registration: certificates are keyed by prtcpnt_entry_id.
      // The queue's AFTER INSERT trigger notifies the worker as this commits.
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO mission.certificate_regen_queue (prtcpnt_entry_id)
        VALUES ${Prisma.join(ids.map((entry) => Prisma.sql`(${entry})`))}
      `);
      return ids;
    });

    if (entryIds.length === 0) return spent;
    return { ok: true, updated: entryIds.length };
  } catch {
    return { ok: false, error: "Could not save the name. Please try again." };
  }
}

/**
 * Rows the correction should reach: the selected row alone when it has no name,
 * otherwise every row sharing that name plus the same email or the same phone.
 *
 * Unlike `dedupeRows`, this deliberately does not follow the grouping transitively.
 * Chaining name+phone to name+email and back again can walk from one person to
 * another through a shared family phone or a common name, which is harmless when
 * it merely collapses a displayed list but would rename a stranger here. Every row
 * this matches carries the selected row's own name together with the selected row's
 * own email or phone.
 */
function buildCorrectionTargetSql(
  entryId: string,
  anchor: { name: string; email: string | null; phone: string | null },
): Prisma.Sql {
  const oldName = normalizeName(anchor.name);
  if (!oldName) return Prisma.sql`s.prtcpnt_entry_id = ${entryId}`;

  const digits = normalizeDigits(anchor.phone ?? "");
  const email = anchor.email?.trim().toLowerCase() ?? "";

  const contactKeys: Prisma.Sql[] = [];
  if (email) {
    contactKeys.push(
      Prisma.sql`lower(btrim(COALESCE(s.prtcpnt_email_id, ''))) = ${email}`,
    );
  }
  if (digits.length >= 10) {
    contactKeys.push(
      Prisma.sql`right(regexp_replace(btrim(COALESCE(s.prtcpnt_phone_no, '')), '[^0-9]', '', 'g'), 10) = ${digits.slice(-10)}`,
    );
  }
  // No usable contact key to group on: fall back to the selected row only.
  if (contactKeys.length === 0) return Prisma.sql`s.prtcpnt_entry_id = ${entryId}`;

  return Prisma.sql`${normalizedNameSql("s.prtcpnt_name")} = ${oldName}
    AND (${Prisma.join(contactKeys, " OR ")})`;
}
