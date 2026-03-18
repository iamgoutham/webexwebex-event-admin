import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";
import GridImportButton from "@/components/grid-import-button";
import UpdateMeetingSheetButton from "@/components/update-meeting-sheet-button";
import AdminParticipantsByState from "@/components/admin-participants-by-state";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

export default async function AdminDashboardPage() {
  const session = await requireRole(ADMIN_ROLES);

  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { id: true, name: true, slug: true },
      })
    : null;

  const users = tenant
    ? await prisma.user.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      })
    : [];

  const tenantSummaries =
    session.user.role === Role.SUPERADMIN
      ? await prisma.tenant.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, slug: true, _count: { select: { users: true } } },
        })
      : [];

  const postgres = getPostgresPrisma();

  let nonIndiaHostsCount = 0;
  let indiaHostsCount = 0;
  let nonIndiaParticipantsCount = 0;
  let indiaParticipantsCount = 0;

  type ContAgg = { hosts: number; participants: number };
  const byContinent: Record<string, ContAgg> = {};
  const inc = (continent: string, kind: "hosts" | "participants") => {
    const key = continent || "Other";
    if (!byContinent[key]) byContinent[key] = { hosts: 0, participants: 0 };
    byContinent[key][kind] += 1;
  };

  const continentFor = (countryRaw: string | null): string => {
    if (!countryRaw) return "Other";
    const val = countryRaw.trim().toLowerCase();
    if (!val) return "Other";
    if (val.includes("india") || val === "in") return "Asia";
    if (
      ["us", "usa", "united states", "america"].some((s) => val.includes(s)) ||
      val.includes("canada")
    ) {
      return "North America";
    }
    if (
      ["uk", "united kingdom", "england", "scotland", "wales", "ireland", "europe"].some((s) =>
        val.includes(s),
      )
    ) {
      return "Europe";
    }
    if (["australia", "nz", "new zealand"].some((s) => val.includes(s))) {
      return "Oceania";
    }
    if (["africa"].some((s) => val.includes(s))) return "Africa";
    if (["asia"].some((s) => val.includes(s))) return "Asia";
    return "Other";
  };

  type CenterRow = { center: string | null; count: number };
  let topStudentCenters: CenterRow[] = [];

  if (postgres) {
    try {
      const [
        nonIndiaHosts,
        indiaHosts,
        nonIndiaParts,
        indiaParts,
        indiaStudents,
        nonIndiaHostCountries,
        indiaHostCountries,
        nonIndiaPartCountries,
        indiaPartCountries,
        studentCenters,
      ] = await Promise.all([
        postgres.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c FROM mission.webex_hosts_non_india
        `,
        postgres.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_hosts_india
        `,
        postgres.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c FROM mission.webex_participants_non_india
        `,
        postgres.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_participants_india
        `,
        postgres.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c FROM vrindavan.webex_participants_india_students
        `,
        postgres.$queryRaw<{ host_addr_country: string | null }[]>`
          SELECT host_addr_country FROM mission.webex_hosts_non_india
        `,
        postgres.$queryRaw<{ host_addr_country: string | null }[]>`
          SELECT host_addr_country FROM vrindavan.webex_hosts_india
        `,
        postgres.$queryRaw<{ prtcpnt_addr_country: string | null }[]>`
          SELECT prtcpnt_addr_country FROM mission.webex_participants_non_india
        `,
        postgres.$queryRaw<{ ind_prtcpnt_addr_country: string | null }[]>`
          SELECT ind_prtcpnt_addr_country FROM vrindavan.webex_participants_india
        `,
        postgres.$queryRaw<{ ind_chinmaya_center_name: string | null; c: bigint }[]>`
          SELECT ind_chinmaya_center_name, COUNT(*)::bigint AS c
          FROM vrindavan.webex_participants_india_students
          GROUP BY ind_chinmaya_center_name
          ORDER BY COUNT(*)::bigint DESC
          LIMIT 10
        `,
      ]);

      nonIndiaHostsCount = Number(nonIndiaHosts[0]?.c ?? 0);
      indiaHostsCount = Number(indiaHosts[0]?.c ?? 0);
      nonIndiaParticipantsCount = Number(nonIndiaParts[0]?.c ?? 0);
      indiaParticipantsCount = Number(indiaParts[0]?.c ?? 0) + Number(indiaStudents[0]?.c ?? 0);

      nonIndiaHostCountries.forEach((row) => {
        inc(continentFor(row.host_addr_country), "hosts");
      });
      indiaHostCountries.forEach((row) => {
        inc(continentFor(row.host_addr_country), "hosts");
      });
      nonIndiaPartCountries.forEach((row) => {
        inc(continentFor(row.prtcpnt_addr_country), "participants");
      });
      indiaPartCountries.forEach((row) => {
        inc(continentFor(row.ind_prtcpnt_addr_country), "participants");
      });

      topStudentCenters = studentCenters.map((row) => ({
        center: row.ind_chinmaya_center_name,
        count: Number(row.c ?? 0),
      }));
    } catch (err) {
      console.error("[admin-dashboard] Failed to read Postgres stats:", err);
    }
  }

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Manage tenant-scoped users, roles, and uploads.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Video grid size imports</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Import grid sizes from the Google Sheet to update host allocations.
        </p>
        <div className="mt-4">
          <GridImportButton />
        </div>
      </div>

      {/* Postgres participant/host stats */}
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Participant &amp; host stats (Postgres)</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Counts by India / non-India and basic breakdowns, sourced from downstream Webex
          databases.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Non-India hosts" value={nonIndiaHostsCount} />
          <StatCard label="India hosts" value={indiaHostsCount} />
          <StatCard label="Non-India participants" value={nonIndiaParticipantsCount} />
          <StatCard label="India participants (incl. students)" value={indiaParticipantsCount} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Continent chart */}
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-xs text-[#6b4e3d]">
            <h3 className="text-sm font-semibold text-[#3b1a1f]">
              Participants &amp; hosts by continent
            </h3>
            {Object.keys(byContinent).length === 0 ? (
              <p className="mt-3 text-[11px] text-[#8a5b44]">
                No data available from downstream database.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {Object.entries(byContinent).map(([continent, agg]) => {
                  const max =
                    Math.max(
                      ...Object.values(byContinent).map((v) =>
                        Math.max(v.hosts, v.participants),
                      ),
                    ) || 1;
                  const hostPct = Math.round((agg.hosts / max) * 100);
                  const partPct = Math.round((agg.participants / max) * 100);
                  return (
                    <div key={continent}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#3b1a1f]">
                          {continent}
                        </span>
                        <span className="text-[11px] text-[#8a5b44]">
                          H: {agg.hosts.toLocaleString()} · P:{" "}
                          {agg.participants.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 flex h-3 gap-1">
                        <div
                          className="h-3 rounded-l-full bg-[#d8792d]/80"
                          style={{ width: `${hostPct || 4}%` }}
                          title={`Hosts: ${agg.hosts}`}
                        />
                        <div
                          className="h-3 rounded-r-full bg-[#1f6b4a]/80"
                          style={{ width: `${partPct || 4}%` }}
                          title={`Participants: ${agg.participants}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top student centers */}
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-xs text-[#6b4e3d]">
            <h3 className="text-sm font-semibold text-[#3b1a1f]">
              Top 10 student centres (participants)
            </h3>
            {topStudentCenters.length === 0 ? (
              <p className="mt-3 text-[11px] text-[#8a5b44]">
                No student participant data available from downstream database.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {topStudentCenters.map((row) => {
                  const max =
                    topStudentCenters.reduce(
                      (m, r) => (r.count > m ? r.count : m),
                      1,
                    ) || 1;
                  const pct = Math.round((row.count / max) * 100);
                  return (
                    <div key={row.center ?? "Unknown"}>
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[11px] font-semibold text-[#3b1a1f]">
                          {row.center ?? "Unknown center"}
                        </span>
                        <span className="text-[11px] text-[#8a5b44]">
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#f4e0b8]">
                        <div
                          className="h-3 rounded-full bg-[#1f6b4a]/80"
                          style={{ width: `${pct || 4}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Meetings preview (as user)</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          See the meetings page as it would appear for any user by email.
        </p>
        <Link
          href="/dashboard/admin/meetings-preview"
          className="mt-3 inline-flex rounded-full border border-[#7a3b2a]/60 px-4 py-2 text-sm font-semibold text-[#3b1a1f] transition hover:border-[#7a3b2a]"
        >
          Open meetings preview
        </Link>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Host meeting info</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Write meeting info from the adminsite to the Google Sheet (calls adminsite
          <code className="mx-1 rounded bg-[#f7e2b6] px-1 text-xs">/meetings/update-sheet</code>
          ).
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <UpdateMeetingSheetButton
            clientName="Chinmaya Mission"
            label="Update (Chinmaya Mission)"
          />
          <UpdateMeetingSheetButton
            clientName="Chinmaya Vrindavan"
            label="Update (Chinmaya Vrindavan)"
          />
          <UpdateMeetingSheetButton
            clientName="Chinmaya Sanjose"
            label="Update (Chinmaya Sanjose)"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md">
        <h2 className="text-lg font-semibold">Participants by state</h2>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Select any state to see all participants currently stored for that state. Uses the normalized state
          value (e.g. &quot;New Jersey&quot; rather than &quot;NJ&quot;).
        </p>
        <div className="mt-4">
          <AdminParticipantsByState />
        </div>
      </div>

      {session.user.role === Role.SUPERADMIN ? (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
          <h2 className="text-lg font-semibold">Tenant overview</h2>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Use the Users API with a tenantId query parameter to drill into a
            tenant’s roster.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {tenantSummaries.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4"
              >
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-[#8a5b44]">{item.slug}</p>
                <p className="mt-2 text-xs text-[#8a5b44]">
                  Users: {item._count.users}
                </p>
              </div>
            ))}
            {!tenantSummaries.length ? (
              <p className="text-sm text-[#8a5b44]">No tenants available yet.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e5c18e] bg-[#fff1d6] p-6">
          <h2 className="text-lg font-semibold">Tenant users</h2>
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Current tenant: {tenant?.name ?? "Unassigned"}
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5c18e] bg-white/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3d6a3] text-xs uppercase text-[#8a5b44]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-[#e5c18e]">
                    <td className="px-4 py-3">{user.name ?? "—"}</td>
                    <td className="px-4 py-3">{user.email ?? "—"}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">
                      {user.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-[#8a5b44]" colSpan={4}>
                      No users assigned yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-center">
      <p className="text-2xl font-bold text-[#d8792d]">
        {Number.isFinite(value) ? value.toLocaleString() : "—"}
      </p>
      <p className="mt-1 text-xs text-[#8a5b44]">{label}</p>
    </div>
  );
}

