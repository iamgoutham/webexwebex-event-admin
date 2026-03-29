import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { sendEmail } from "@/lib/notifications/channels/email";
import {
  Prisma,
  type PrismaClient as PostgresPrismaClient,
} from "@/generated/postgres-client";

export type MeetingAssignment = {
  topic: string | null;
  link: string | null;
  meetingNumber: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Organizer / assigned host for this row */
  hostEmail: string | null;
  hostPhone: string | null;
};

/** Participants mapped to this host in host↔participant map tables (UI / API only). */
export type HostMeetingParticipant = {
  email: string;
  phone: string | null;
  name: string | null;
};

export type ConfirmationLookupResult = {
  valid: boolean;
  email: string;
  isHost: boolean;
  isParticipant: boolean;
  displayName: string | null;
  meetings: MeetingAssignment[];
  /** Populated when {@link isHost}; emails/phones from participant tables. */
  hostMeetingParticipants: HostMeetingParticipant[];
};

type GchantRow = {
  topic: string | null;
  webex_mtng_link: string | null;
  webex_mtng_no: bigint | null;
  start_time: Date | null;
  end_time: Date | null;
};

function toMeetingAssignment(
  r: GchantRow,
  hostEmail: string | null,
  hostPhone: string | null,
): MeetingAssignment {
  return {
    topic: r.topic ?? null,
    link: r.webex_mtng_link ?? null,
    meetingNumber: r.webex_mtng_no != null ? String(r.webex_mtng_no) : null,
    startTime: r.start_time ? r.start_time.toISOString() : null,
    endTime: r.end_time ? r.end_time.toISOString() : null,
    hostEmail,
    hostPhone,
  };
}

function meetingDedupeKey(m: MeetingAssignment): string {
  return [
    m.link ?? "",
    m.startTime ?? "",
    m.topic ?? "",
    m.hostEmail ?? "",
  ].join("|");
}

async function lookupHostPhone(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string | null> {
  const [r1, r2] = await Promise.all([
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
      LIMIT 1
    `,
    postgres.$queryRaw<{ phone: string | null }[]>`
      SELECT host_phone_no::text AS phone
      FROM vrindavan.webex_hosts_india
      WHERE lower(btrim(host_email_id::text)) = ${hostEmailLower}
      LIMIT 1
    `,
  ]);
  const p = r1[0]?.phone?.trim() || r2[0]?.phone?.trim();
  return p || null;
}

async function fetchGchantMeetingsForOrganizer(
  postgres: PostgresPrismaClient,
  organizerEmailLower: string,
): Promise<GchantRow[]> {
  const [missionRows, vrindavanRows] = await Promise.all([
    postgres.$queryRaw<GchantRow[]>`
      SELECT
        topic,
        webex_mtng_link,
        webex_mtng_no,
        start_time,
        end_time
      FROM mission.gchant_mtng
      WHERE lower(btrim(organizer_email::text)) = ${organizerEmailLower}
      ORDER BY start_time NULLS LAST
    `,
    postgres.$queryRaw<GchantRow[]>`
      SELECT
        topic,
        webex_mtng_link,
        webex_mtng_no,
        start_time,
        end_time
      FROM vrindavan.gchant_mtng
      WHERE lower(btrim(organizer_email::text)) = ${organizerEmailLower}
      ORDER BY start_time NULLS LAST
    `,
  ]);
  return [...missionRows, ...vrindavanRows];
}

/**
 * Host emails tied to a participant via downstream map tables.
 * Column names follow existing mission/vrindavan conventions; alternate queries run if joins differ.
 */
async function collectHostEmailsFromParticipantMaps(
  postgres: PostgresPrismaClient,
  participantEmailLower: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const q = participantEmailLower;

  const add = (rows: { host_email: string | null }[]) => {
    for (const r of rows) {
      const e = r.host_email?.trim().toLowerCase();
      if (e) out.add(e);
    }
  };

  // mission.host_prtcpnt_map_nonindia_nu → mission.webex_hosts_non_india
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu m
      INNER JOIN mission.webex_hosts_non_india h
        ON btrim(h.license_site_code::text) = btrim(m.host_lic_site::text)
       AND btrim(h.host_unq_shortid::text) = btrim(m.host_unq_shortid::text)
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
    `;
    add(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] mission host_prtcpnt_map_nonindia_nu host_email_id failed:",
      err,
    );
  }

  // vrindavan.host_prtcpnt_map_india → vrindavan.webex_hosts_india
  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtcpnt_map_india m
      INNER JOIN vrindavan.webex_hosts_india h
        ON btrim(h.license_site_code::text) = btrim(m.host_lic_site::text)
       AND btrim(h.host_unq_shortid::text) = btrim(m.host_unq_shortid::text)
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(h.host_email_id::text)) AS host_email
        FROM vrindavan.host_prtcpnt_map_india m
        INNER JOIN vrindavan.webex_hosts_india h
          ON btrim(h.license_site_code::text) = btrim(m.host_lic_site::text)
         AND btrim(h.host_unq_shortid::text) = btrim(m.host_unq_shortid::text)
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] vrindavan host_prtcpnt_map_india join failed:",
        err,
      );
    }
  }

  try {
    const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE lower(btrim(m.ind_prtcpnt_email_id::text)) = ${q}
        AND m.host_email_id IS NOT NULL
        AND btrim(m.host_email_id::text) <> ''
    `;
    add(rows);
  } catch {
    try {
      const rows = await postgres.$queryRaw<{ host_email: string | null }[]>`
        SELECT DISTINCT lower(btrim(m.host_email_id::text)) AS host_email
        FROM vrindavan.host_prtcpnt_map_india m
        WHERE lower(btrim(m.prtcpnt_email_id::text)) = ${q}
          AND m.host_email_id IS NOT NULL
          AND btrim(m.host_email_id::text) <> ''
      `;
      add(rows);
    } catch (err) {
      console.warn(
        "[confirm-registration] vrindavan host_prtcpnt_map_india host_email_id failed:",
        err,
      );
    }
  }

  return out;
}

/**
 * Participant emails assigned to this host via mission/vrindavan host↔participant map tables.
 */
async function collectParticipantEmailsForHost(
  postgres: PostgresPrismaClient,
  hostEmailLower: string,
): Promise<string[]> {
  const set = new Set<string>();
  const he = hostEmailLower;

  const addEmails = (rows: { e: string | null }[]) => {
    for (const r of rows) {
      const x = r.e?.trim().toLowerCase();
      if (x) set.add(x);
    }
  };

  try {
    const rows = await postgres.$queryRaw<{ e: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.prtcpnt_email_id::text)) AS e
      FROM mission.host_prtcpnt_map_nonindia_nu m
      INNER JOIN mission.webex_hosts_non_india h
        ON btrim(h.license_site_code::text) = btrim(m.host_lic_site::text)
       AND btrim(h.host_unq_shortid::text) = btrim(m.host_unq_shortid::text)
      WHERE lower(btrim(h.host_email_id::text)) = ${he}
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
    `;
    addEmails(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] collectParticipantEmailsForHost mission join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ e: string | null }[]>`
      SELECT DISTINCT lower(btrim(m.prtcpnt_email_id::text)) AS e
      FROM mission.host_prtcpnt_map_nonindia_nu m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND m.prtcpnt_email_id IS NOT NULL
        AND btrim(m.prtcpnt_email_id::text) <> ''
    `;
    addEmails(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] collectParticipantEmailsForHost mission host_email_id failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ e: string | null }[]>`
      SELECT DISTINCT lower(btrim(
        COALESCE(
          NULLIF(btrim(m.ind_prtcpnt_email_id::text), ''),
          NULLIF(btrim(m.prtcpnt_email_id::text), '')
        )
      )) AS e
      FROM vrindavan.host_prtcpnt_map_india m
      INNER JOIN vrindavan.webex_hosts_india h
        ON btrim(h.license_site_code::text) = btrim(m.host_lic_site::text)
       AND btrim(h.host_unq_shortid::text) = btrim(m.host_unq_shortid::text)
      WHERE lower(btrim(h.host_email_id::text)) = ${he}
        AND COALESCE(
          NULLIF(btrim(m.ind_prtcpnt_email_id::text), ''),
          NULLIF(btrim(m.prtcpnt_email_id::text), '')
        ) IS NOT NULL
    `;
    addEmails(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] collectParticipantEmailsForHost vrindavan join failed:",
      err,
    );
  }

  try {
    const rows = await postgres.$queryRaw<{ e: string | null }[]>`
      SELECT DISTINCT lower(btrim(
        COALESCE(
          NULLIF(btrim(m.ind_prtcpnt_email_id::text), ''),
          NULLIF(btrim(m.prtcpnt_email_id::text), '')
        )
      )) AS e
      FROM vrindavan.host_prtcpnt_map_india m
      WHERE lower(btrim(m.host_email_id::text)) = ${he}
        AND COALESCE(
          NULLIF(btrim(m.ind_prtcpnt_email_id::text), ''),
          NULLIF(btrim(m.prtcpnt_email_id::text), '')
        ) IS NOT NULL
    `;
    addEmails(rows);
  } catch (err) {
    console.warn(
      "[confirm-registration] collectParticipantEmailsForHost vrindavan host_email_id failed:",
      err,
    );
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * One row per participant record — duplicate emails appear as multiple entries.
 */
async function enrichHostMeetingParticipants(
  postgres: PostgresPrismaClient,
  emails: string[],
): Promise<HostMeetingParticipant[]> {
  if (emails.length === 0) return [];

  const emailSet = new Set(emails);

  const [nonIndia, india, students] = await Promise.all([
    postgres.nonIndiaParticipant.findMany({
      where: { prtcpntEmailId: { in: emails } },
      select: {
        prtcpntEmailId: true,
        prtcpntPhoneNo: true,
        prtcpntName: true,
      },
    }),
    postgres.indiaParticipant.findMany({
      where: { indPrtcpntEmailId: { in: emails } },
      select: {
        indPrtcpntEmailId: true,
        indPrtcpntPhoneNo: true,
        indPrtcpntName: true,
      },
    }),
    postgres.$queryRaw<{ email: string | null; phone: string | null; name: string | null }[]>`
      SELECT
        lower(btrim(ind_prtcpnt_email_id::text)) AS email,
        ind_prtcpnt_phone_no::text AS phone,
        ind_prtcpnt_name::text AS name
      FROM vrindavan.webex_participants_india_students
      WHERE lower(btrim(ind_prtcpnt_email_id::text)) IN (${Prisma.join(emails)})
    `,
  ]);

  const out: HostMeetingParticipant[] = [];

  const pushRow = (
    emailRaw: string | null | undefined,
    phone: string | null | undefined,
    name: string | null | undefined,
  ) => {
    const e = emailRaw?.trim().toLowerCase();
    if (!e || !emailSet.has(e)) return;
    out.push({
      email: e,
      phone: phone?.trim() ? phone.trim() : null,
      name: name?.trim() ? name.trim() : null,
    });
  };

  for (const r of nonIndia) {
    pushRow(r.prtcpntEmailId, r.prtcpntPhoneNo, r.prtcpntName);
  }
  for (const r of india) {
    pushRow(r.indPrtcpntEmailId, r.indPrtcpntPhoneNo, r.indPrtcpntName);
  }
  for (const r of students) {
    pushRow(r.email, r.phone, r.name);
  }

  out.sort((a, b) => {
    const cmpE = a.email.localeCompare(b.email);
    if (cmpE !== 0) return cmpE;
    const cmpN = (a.name ?? "").localeCompare(b.name ?? "");
    if (cmpN !== 0) return cmpN;
    return (a.phone ?? "").localeCompare(b.phone ?? "");
  });

  return out;
}

export async function lookupConfirmation(emailRaw: string): Promise<ConfirmationLookupResult> {
  const email = emailRaw.trim().toLowerCase();
  const postgres = getPostgresPrisma();
  if (!postgres) {
    throw new Error("Downstream database is not configured.");
  }

  // Presence checks across curated participants + hosts + india students.
  const [hostNonIndia, hostIndia, nonIndiaRows, indiaRows, indiaStudentRows] =
    await Promise.all([
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null }[]>`
        SELECT host_first_name, host_last_name
        FROM mission.webex_hosts_non_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
        LIMIT 1
      `,
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null; chinmaya_center_name: string | null }[]>`
        SELECT host_first_name, host_last_name, chinmaya_center_name
        FROM vrindavan.webex_hosts_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
        LIMIT 1
      `,
      postgres.nonIndiaParticipant.findMany({
        where: { prtcpntEmailId: email },
        select: { prtcpntName: true },
      }),
      postgres.indiaParticipant.findMany({
        where: { indPrtcpntEmailId: email },
        select: { indPrtcpntName: true },
      }),
      postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
        SELECT ind_prtcpnt_name
        FROM vrindavan.webex_participants_india_students
        WHERE lower(btrim(ind_prtcpnt_email_id::text)) = ${email}
      `,
    ]);

  const isHost = hostNonIndia.length > 0 || hostIndia.length > 0;
  const isParticipant = Boolean(
    nonIndiaRows.length > 0 ||
      indiaRows.length > 0 ||
      indiaStudentRows.length > 0,
  );

  const participantNameParts: string[] = [];
  for (const r of nonIndiaRows) {
    const n = r.prtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaRows) {
    const n = r.indPrtcpntName?.trim();
    if (n) participantNameParts.push(n);
  }
  for (const r of indiaStudentRows) {
    const n = r.ind_prtcpnt_name?.trim();
    if (n) participantNameParts.push(n);
  }

  const hostNameFallback =
    hostNonIndia[0]?.host_first_name || hostNonIndia[0]?.host_last_name
      ? `${hostNonIndia[0]?.host_first_name ?? ""} ${hostNonIndia[0]?.host_last_name ?? ""}`.trim()
      : hostIndia[0]?.host_first_name || hostIndia[0]?.host_last_name
        ? `${hostIndia[0]?.host_first_name ?? ""} ${hostIndia[0]?.host_last_name ?? ""}`.trim()
        : null;

  const displayName =
    participantNameParts.length > 0
      ? participantNameParts.join("; ")
      : hostNameFallback;

  const collected: MeetingAssignment[] = [];

  try {
    // Host: meetings where this email is the Webex organizer
    if (isHost) {
      const hostPhone = await lookupHostPhone(postgres, email);
      const rows = await fetchGchantMeetingsForOrganizer(postgres, email);
      for (const r of rows) {
        collected.push(toMeetingAssignment(r, email, hostPhone));
      }
    }

    // Participant: meetings for hosts mapped to this participant email
    if (isParticipant) {
      const mappedHostEmails = await collectHostEmailsFromParticipantMaps(postgres, email);
      for (const hostEmail of mappedHostEmails) {
        const hostPhone = await lookupHostPhone(postgres, hostEmail);
        const rows = await fetchGchantMeetingsForOrganizer(postgres, hostEmail);
        for (const r of rows) {
          collected.push(toMeetingAssignment(r, hostEmail, hostPhone));
        }
      }
    }
  } catch (err) {
    console.error("[confirm-registration] Meeting lookup failed:", err);
  }

  const seen = new Set<string>();
  const meetings = collected.filter((m) => {
    const k = meetingDedupeKey(m);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  meetings.sort((a, b) => {
    const ta = a.startTime ?? "";
    const tb = b.startTime ?? "";
    return ta.localeCompare(tb);
  });

  let hostMeetingParticipants: HostMeetingParticipant[] = [];
  if (isHost) {
    try {
      const partEmails = await collectParticipantEmailsForHost(postgres, email);
      hostMeetingParticipants = await enrichHostMeetingParticipants(
        postgres,
        partEmails,
      );
    } catch (err) {
      console.error(
        "[confirm-registration] Host meeting participants lookup failed:",
        err,
      );
    }
  }

  return {
    valid: isHost || isParticipant,
    email,
    isHost,
    isParticipant,
    displayName,
    meetings,
    hostMeetingParticipants,
  };
}

const CONFIRMATION_EMAIL_SUBJECT =
  "Registration confirmation — Chinmaya Gita Samarpanam 2026";

/**
 * Builds the exact subject and plain-text body used by
 * {@link sendConfirmationEmail} (and admin preview).
 */
export function buildConfirmationEmailContent(result: ConfirmationLookupResult): {
  subject: string;
  body: string;
} {
  const greetingName = result.displayName?.trim()
    ? ` ${result.displayName.trim()}`
    : "";

  const lines: string[] = [];
  lines.push(`Namaste${greetingName},`);
  lines.push("");
  lines.push("This email confirms your registration for Chinmaya Gita Samarpanam 2026.");
  lines.push("");
  lines.push(`Registered email: ${result.email}`);
  lines.push(
    `Status: ${result.isParticipant ? "Participant" : ""}${result.isParticipant && result.isHost ? " + " : ""}${result.isHost ? "Host" : ""}`,
  );
  lines.push("");

  if (result.isHost && !result.isParticipant) {
    lines.push(
      "Note: You are registered as a host, but we could not find a matching participant registration for this email.",
    );
    lines.push(
      "All hosts should also register as participants so they are counted correctly. Please make sure you (or your family members) have also registered as participants using this email.",
    );
    lines.push("");
  }

  if (result.meetings.length > 0) {
    lines.push("Your assigned meeting(s):");
    for (const m of result.meetings) {
      const title = m.topic ?? "Meeting";
      const number = m.meetingNumber ? ` (Meeting #: ${m.meetingNumber})` : "";
      lines.push(`- ${title}${number}`);
      if (m.link) {
        lines.push(`  Meeting link: ${m.link}`);
      }
      if (m.hostEmail) {
        lines.push(`  Host email: ${m.hostEmail}`);
      }
      if (m.hostPhone) {
        lines.push(`  Host phone: ${m.hostPhone}`);
      }
      if (m.startTime) {
        lines.push(`  Start: ${m.startTime}`);
      }
    }
  } else {
    lines.push("Meeting assignment: Not found yet (if you are a host, this may be assigned later).");
  }

  if (result.isHost) {
    lines.push("");
    lines.push("Participants in your meeting(s) (from registration records):");
    const parts = result.hostMeetingParticipants ?? [];
    if (parts.length === 0) {
      lines.push(
        "(No participants are linked to your host record in the assignment map yet.)",
      );
    } else {
      lines.push("  Email | Phone | Name");
      for (const p of parts) {
        const phone = p.phone?.trim() ? p.phone.trim() : "—";
        const name = p.name?.trim() ? p.name.trim() : "—";
        lines.push(`  ${p.email} | ${phone} | ${name}`);
      }
    }
  }

  lines.push("");
  lines.push("If you did not request this email, you can ignore it.");

  return {
    subject: CONFIRMATION_EMAIL_SUBJECT,
    body: lines.join("\n"),
  };
}

export async function sendConfirmationEmail(result: ConfirmationLookupResult) {
  const { subject, body } = buildConfirmationEmailContent(result);
  const sendResult = await sendEmail(result.email, subject, body);
  if (!sendResult.success) {
    throw new Error(sendResult.error ?? "Failed to send email.");
  }
}
