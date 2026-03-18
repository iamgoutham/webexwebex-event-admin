import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { sendEmail } from "@/lib/notifications/channels/email";

export type ConfirmationLookupResult = {
  valid: boolean;
  email: string;
  isHost: boolean;
  isParticipant: boolean;
  displayName: string | null;
  meetings: {
    topic: string | null;
    link: string | null;
    meetingNumber: string | null;
    startTime: string | null;
    endTime: string | null;
  }[];
};

export async function lookupConfirmation(emailRaw: string): Promise<ConfirmationLookupResult> {
  const email = emailRaw.trim().toLowerCase();
  const postgres = getPostgresPrisma();
  if (!postgres) {
    throw new Error("Downstream database is not configured.");
  }

  // Presence checks across curated participants + hosts + india students.
  const [hostNonIndia, hostIndia, nonIndiaP, indiaP, indiaStudents] =
    await Promise.all([
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null }[]>`
        SELECT host_first_name, host_last_name
        FROM mission.webex_hosts_non_india
        WHERE lower(host_email_id) = ${email}
        LIMIT 1
      `,
      postgres.$queryRaw<{ host_first_name: string | null; host_last_name: string | null; chinmaya_center_name: string | null }[]>`
        SELECT host_first_name, host_last_name, chinmaya_center_name
        FROM vrindavan.webex_hosts_india
        WHERE lower(host_email_id) = ${email}
        LIMIT 1
      `,
      postgres.nonIndiaParticipant.findFirst({
        where: { prtcpntEmailId: email },
        select: { prtcpntName: true },
      }),
      postgres.indiaParticipant.findFirst({
        where: { indPrtcpntEmailId: email },
        select: { indPrtcpntName: true },
      }),
      postgres.$queryRaw<{ ind_prtcpnt_name: string | null }[]>`
        SELECT ind_prtcpnt_name
        FROM vrindavan.webex_participants_india_students
        WHERE lower(ind_prtcpnt_email_id) = ${email}
        LIMIT 1
      `,
    ]);

  const isHost = hostNonIndia.length > 0 || hostIndia.length > 0;
  const isParticipant = Boolean(nonIndiaP || indiaP || indiaStudents.length > 0);

  const displayName =
    nonIndiaP?.prtcpntName ??
    indiaP?.indPrtcpntName ??
    indiaStudents[0]?.ind_prtcpnt_name ??
    (hostNonIndia[0]?.host_first_name || hostNonIndia[0]?.host_last_name
      ? `${hostNonIndia[0]?.host_first_name ?? ""} ${hostNonIndia[0]?.host_last_name ?? ""}`.trim()
      : null) ??
    (hostIndia[0]?.host_first_name || hostIndia[0]?.host_last_name
      ? `${hostIndia[0]?.host_first_name ?? ""} ${hostIndia[0]?.host_last_name ?? ""}`.trim()
      : null) ??
    null;

  let meetings: ConfirmationLookupResult["meetings"] = [];
  // Meeting assignments from gchant_mtng in mission + vrindavan schemas.
  // We look up by organizer_email (host email) since that's the stable key.
  try {
    const [missionRows, vrindavanRows] = await Promise.all([
      postgres.$queryRaw<
        {
          topic: string | null;
          webex_mtng_link: string | null;
          webex_mtng_no: bigint | null;
          start_time: Date | null;
          end_time: Date | null;
        }[]
      >`
        SELECT
          topic,
          webex_mtng_link,
          webex_mtng_no,
          start_time,
          end_time
        FROM mission.gchant_mtng
        WHERE lower(organizer_email) = ${email}
        ORDER BY start_time NULLS LAST
      `,
      postgres.$queryRaw<
        {
          topic: string | null;
          webex_mtng_link: string | null;
          webex_mtng_no: bigint | null;
          start_time: Date | null;
          end_time: Date | null;
        }[]
      >`
        SELECT
          topic,
          webex_mtng_link,
          webex_mtng_no,
          start_time,
          end_time
        FROM vrindavan.gchant_mtng
        WHERE lower(organizer_email) = ${email}
        ORDER BY start_time NULLS LAST
      `,
    ]);

    const toMeeting = (r: {
      topic: string | null;
      webex_mtng_link: string | null;
      webex_mtng_no: bigint | null;
      start_time: Date | null;
      end_time: Date | null;
    }) => ({
      topic: r.topic ?? null,
      link: r.webex_mtng_link ?? null,
      meetingNumber: r.webex_mtng_no != null ? String(r.webex_mtng_no) : null,
      startTime: r.start_time ? r.start_time.toISOString() : null,
      endTime: r.end_time ? r.end_time.toISOString() : null,
    });

    meetings = [...missionRows.map(toMeeting), ...vrindavanRows.map(toMeeting)];
  } catch {
    meetings = [];
  }

  return {
    valid: isHost || isParticipant,
    email,
    isHost,
    isParticipant,
    displayName,
    meetings,
  };
}

export async function sendConfirmationEmail(result: ConfirmationLookupResult) {
  const subject = "Registration confirmation — Chinmaya Gita Samarpanam 2026";
  const greetingName = result.displayName?.trim() ? ` ${result.displayName.trim()}` : "";

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
      if (m.link) {
        lines.push(`- ${title}${number}: ${m.link}`);
      } else {
        lines.push(`- ${title}${number}`);
      }
    }
  } else {
    lines.push("Meeting assignment: Not found yet (if you are a host, this may be assigned later).");
  }

  lines.push("");
  lines.push("If you did not request this email, you can ignore it.");

  const body = lines.join("\n");
  const sendResult = await sendEmail(result.email, subject, body);
  if (!sendResult.success) {
    throw new Error(sendResult.error ?? "Failed to send email.");
  }
}

