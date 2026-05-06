import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import CopyableMeetingLink from "@/components/copyable-meeting-link";
import ParticipantLinks from "@/components/participant-links";
import { getHostIdForEmail, getLicenseSiteForEmail } from "@/lib/license-site";
import { displayWebexHostShortId } from "@/lib/user-short-id";
import {
  getHostDashboardMeetings,
  type MeetingAssignment,
} from "@/lib/public-confirmation";
import {
  mergeInviteesMapFirst,
  parseInvitees,
  type InviteeContact,
} from "@/lib/meeting-invitees-from-sheet";
import { loadHostMeetingParticipants } from "@/lib/host-meeting-participants";
import { sheetMeetingForAssignment } from "@/lib/sheet-meeting-for-assignment";
import type { SheetMeeting } from "@/lib/meeting-sheet-types";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { EventDaySharedIntroCard } from "@/components/event-day-host-checklist-section";
import EventDayHostChecklistTabs from "@/components/event-day-host-checklist-tabs";
import GridSizeForm from "@/components/grid-size-form";
import HostPreparationSections from "@/components/host-preparation-sections";

export default async function DashboardPage() {
  const session = await requireAuth();
  const hostName = session.user.name ?? session.user.email ?? "Host";
  const licenseSite = session.user.email
    ? await getLicenseSiteForEmail(session.user.email)
    : null;
  const sheetHostId = session.user.email
    ? await getHostIdForEmail(session.user.email)
    : null;
  const hostIdRaw = sheetHostId ?? session.user.shortId ?? "Pending";
  const hostId = displayWebexHostShortId(hostIdRaw, licenseSite);

  /** Same merged rows as `/dashboard/meetings` (`getHostDashboardMeetings`). */
  let dashboardAssignments: MeetingAssignment[] = [];
  let sheetMeetingsForDashboard: SheetMeeting[] = [];
  let hostMapInvitees: InviteeContact[] | null = null;
  const postgres = getPostgresPrisma();
  const emailLower = session.user.email?.trim().toLowerCase();
  if (postgres && emailLower) {
    try {
      const dash = await getHostDashboardMeetings(postgres, emailLower);
      dashboardAssignments = dash.assignments;
      sheetMeetingsForDashboard = dash.sheetMeetings;
    } catch (err) {
      console.error("[dashboard] weekly meeting lookup failed:", err);
    }
    try {
      const enriched = await loadHostMeetingParticipants(postgres, emailLower);
      if (enriched.length > 0) {
        hostMapInvitees = enriched.map((p) => ({
          email: p.email,
          phone: p.phone?.trim() || undefined,
          name: p.name?.trim() || undefined,
        }));
      }
    } catch {
      // Sheet JSON invitees only when map load fails (same as meetings page)
    }
  }

  const weeklyMeetings = filterMeetingsThisWeek(dashboardAssignments);
  /** Prefer Mon–Sun ET window; otherwise show all assignments (parity with Meetings tab). */
  const meetingsHero =
    weeklyMeetings.length > 0 ? weeklyMeetings : dashboardAssignments;

  const heroMeetingsHeading =
    weeklyMeetings.length > 0
      ? weeklyMeetings.length > 1
        ? "Meetings this week"
        : "Meeting this week"
      : dashboardAssignments.length > 0
        ? dashboardAssignments.length > 1
          ? "Your meetings"
          : "Your meeting"
        : "";

  const latestUpload = await prisma.upload.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, filename: true, status: true },
  });
  const gridProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gridRows: true, gridCols: true },
  });

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <div
          className={
            meetingsHero.length > 0
              ? "grid gap-6 md:grid-cols-2 md:items-start"
              : "grid gap-6 md:items-start"
          }
        >
          <div>
            <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
              After Login
            </span>
            <h1 className="mt-4 text-2xl font-semibold">Host Dashboard</h1>
            <p className="mt-2 text-sm text-[#6b4e3d]">
              Welcome, <span className="font-semibold">{hostName}</span> (Host
              ID: <span className="font-semibold">{hostId}</span>)
            </p>
          </div>
          {meetingsHero.length > 0 ? (
            <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-sm text-[#6b4e3d]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9b6b4f]">
                {heroMeetingsHeading}
              </p>
              <ul className="mt-3 space-y-4">
                {meetingsHero.map((m, i) => {
                  const sheetRow = sheetMeetingForAssignment(
                    m,
                    sheetMeetingsForDashboard,
                  );
                  const inviteesFromSheet = Array.isArray(sheetRow?.invitees)
                    ? parseInvitees(sheetRow.invitees)
                    : [];
                  const invitees = mergeInviteesMapFirst(
                    hostMapInvitees,
                    inviteesFromSheet,
                  );
                  return (
                    <li
                      key={`${m.meetingNumber ?? ""}-${m.startTime ?? ""}-${i}`}
                      className={
                        i > 0 ? "border-t border-[#e5c18e]/80 pt-4" : undefined
                      }
                    >
                      {m.topic ? (
                        <p className="font-semibold text-[#3b1a1f]">{m.topic}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#8a5b44]">
                        {formatMeetingStartDisplay(m.startTime)}
                      </p>
                      {m.meetingNumber ? (
                        <p className="mt-1 text-xs text-[#6b4e3d]">
                          Meeting #:{" "}
                          <span className="font-mono text-[#3b1a1f]">
                            {m.meetingNumber}
                          </span>
                        </p>
                      ) : null}
                      {m.link ? <CopyableMeetingLink url={m.link} /> : null}
                      {invitees && invitees.length > 0 ? (
                        <ParticipantLinks
                          invitees={invitees}
                          emailsButtonLabel="Emails"
                          detailsButtonLabel="Participant Details"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/dashboard/meetings"
                className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.15em] text-[#8a2f2a] hover:text-[#3b1a1f]"
              >
                Full meeting details →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-3">
        <Link
          href="/dashboard/meetings"
          className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md transition hover:border-[#c58d5d] hover:bg-[#fff1d6]"
        >
          <h2 className="text-lg font-semibold">Webex Meeting Link</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Each host manages a single meeting using the custom link provided
            here.
          </p>
          <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2f2a]">
            View meetings →
          </span>
        </Link>
        <Link
          href="/dashboard/instructions"
          className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md transition hover:border-[#c58d5d] hover:bg-[#fff1d6]"
        >
          <h2 className="text-lg font-semibold">Chanting day Instructions</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Review the event checklist, chanting flow, and on-screen guidelines
            before hosting.
          </p>
          <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2f2a]">
            View instructions →
          </span>
        </Link>
        <Link
          href="/dashboard/uploads"
          className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md transition hover:border-[#c58d5d] hover:bg-[#fff1d6]"
        >
          <h2 className="text-lg font-semibold">Upload OBS meeting recording</h2>
          <p className="mt-3 text-sm text-[#6b4e3d]">
            Once meeting is complete upload the meeting recording here.
          </p>
          <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2f2a]">
            Go to uploads →
          </span>
        </Link>
      </section>

      <EventDaySharedIntroCard variant="dashboard" />

      <EventDayHostChecklistTabs variant="dashboard" />

      <HostPreparationSections />

      <GridSizeForm
        rows={gridProfile?.gridRows ?? null}
        cols={gridProfile?.gridCols ?? null}
        isSet={!!(gridProfile?.gridRows && gridProfile?.gridCols)}
      />

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6 sm:p-8">
        <h2 className="text-lg font-semibold">
          Video Recording File Upload Status
        </h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Status:{" "}
          {latestUpload?.status === "COMPLETED" ? (
            <span className="font-semibold text-emerald-700">Uploaded</span>
          ) : (
            <span className="font-semibold text-red-600">Not Uploaded</span>
          )}
        </p>
        <p className="mt-2 text-xs text-[#8a5b44]">
          {latestUpload
            ? `Last upload: ${latestUpload.filename ?? "Recording"} • ${latestUpload.createdAt.toLocaleString()}`
            : "Once uploaded successfully, status will update automatically."}
        </p>
      </div>
    </div>
  );
}

/** Week boundaries Mon–Sun (calendar days in America/New_York). */
const ET_ZONE = "America/New_York";

type Ymd = { y: number; m: number; d: number };

const DOW_MON_BASE: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function formatToPartsET(date: Date): { y: number; m: number; d: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    weekday: map.weekday ?? "",
  };
}

function civilAddDays(y: number, m: number, d: number, delta: number): Ymd {
  const x = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

function mondaySundayBoundsET(now: Date): { mon: Ymd; sun: Ymd } {
  const { y, m, d, weekday } = formatToPartsET(now);
  const offset = DOW_MON_BASE[weekday] ?? 0;
  const mon = civilAddDays(y, m, d, -offset);
  const sun = civilAddDays(mon.y, mon.m, mon.d, 6);
  return { mon, sun };
}

function ymdKey(p: Ymd): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function parseMeetingInstant(startTime: string | null): Date | null {
  if (!startTime?.trim()) return null;
  const d = new Date(startTime.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function isMeetingThisWeekET(startTime: string | null, now: Date): boolean {
  const inst = parseMeetingInstant(startTime);
  if (!inst) return false;
  const { mon, sun } = mondaySundayBoundsET(now);
  const meetingDay = formatToPartsET(inst);
  const key = ymdKey({
    y: meetingDay.y,
    m: meetingDay.m,
    d: meetingDay.d,
  });
  return key >= ymdKey(mon) && key <= ymdKey(sun);
}

function filterMeetingsThisWeek(assignments: MeetingAssignment[]): MeetingAssignment[] {
  const now = new Date();
  const filtered = assignments.filter((a) =>
    isMeetingThisWeekET(a.startTime, now),
  );
  filtered.sort((a, b) =>
    (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
  return filtered;
}

function formatMeetingStartDisplay(startTime: string | null): string {
  if (!startTime?.trim()) return "Time TBD";
  const d = new Date(startTime.trim());
  if (Number.isNaN(d.getTime())) return startTime.trim();
  return d.toLocaleString("en-US", {
    timeZone: ET_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
