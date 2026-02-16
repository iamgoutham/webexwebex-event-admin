import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";
import BroadcastForm from "@/components/notifications/broadcast-form";
import QuickSendButtons from "@/components/notifications/quick-send-buttons";
import BroadcastHistory from "@/components/notifications/broadcast-history";
import ParticipantSyncButton from "@/components/notifications/participant-sync-button";

export default async function BroadcastPage() {
  const session = await requireRole(ADMIN_ROLES);

  // Fetch tenants for the scope selector
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Get participant + host counts for the stats cards
  const [participantCount, activeParticipantCount, hostCount] =
    await Promise.all([
      prisma.participant.count(),
      prisma.participant.count({ where: { optedOut: false } }),
      prisma.user.count(),
    ]);

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      {/* Header */}
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Broadcast Center</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Send notifications to hosts and participants across all tenants.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-5 text-center">
          <p className="text-3xl font-bold text-[#d8792d]">
            {hostCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#8a5b44]">Hosts (authenticated)</p>
        </div>
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-5 text-center">
          <p className="text-3xl font-bold text-[#d8792d]">
            {activeParticipantCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#8a5b44]">
            Active Participants (email)
          </p>
        </div>
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-5 text-center">
          <p className="text-3xl font-bold text-[#d8792d]">
            {participantCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#8a5b44]">
            Total Participants
            {participantCount > activeParticipantCount
              ? ` (${participantCount - activeParticipantCount} opted out)`
              : ""}
          </p>
        </div>
      </div>

      {/* Quick-send buttons */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Quick Send</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          One-click broadcasts for common event-day scenarios. Sends to all
          tenants.
        </p>
        <div className="mt-4">
          <QuickSendButtons />
        </div>
      </div>

      {/* Participant sync */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Participant Data</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Sync participant emails from Webex meeting invitees via the admin
          backend. This pulls all invitees from all hosts&apos; meetings.
        </p>
        <div className="mt-4">
          <ParticipantSyncButton />
        </div>
      </div>

      {/* Custom broadcast form */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Custom Broadcast</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Compose and send a custom message to hosts, participants, or everyone.
        </p>
        <div className="mt-4">
          <BroadcastForm tenants={tenants} />
        </div>
      </div>

      {/* Broadcast history */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Broadcast History</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Recent broadcasts sent from this panel.
        </p>
        <div className="mt-4">
          <BroadcastHistory />
        </div>
      </div>
    </div>
  );
}
