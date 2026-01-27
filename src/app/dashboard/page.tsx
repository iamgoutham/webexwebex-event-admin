import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { getHostIdForEmail, getLicenseSiteForEmail } from "@/lib/license-site";
import GridSizeForm from "@/components/grid-size-form";

export default async function DashboardPage() {
  const session = await requireAuth();
  const hostName = session.user.name ?? session.user.email ?? "Host";
  const sheetHostId = session.user.email
    ? await getHostIdForEmail(session.user.email)
    : null;
  const hostId = sheetHostId ?? session.user.shortId ?? "Pending";
  const licenseSite = session.user.email
    ? await getLicenseSiteForEmail(session.user.email)
    : null;
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
        <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-start">
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
          <div className="rounded-2xl border border-[#e5c18e] bg-[#fff9ef] p-4 text-sm text-[#6b4e3d]">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b6b4f]">
              License Site
            </p>
            <p className="mt-2 text-base font-semibold text-[#3b1a1f]">
              {licenseSite ?? "Unknown"}
            </p>
            <p className="text-xs text-[#8a5b44]">
              Assigned Webex site for this host
            </p>
          </div>
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

      <GridSizeForm
        rows={gridProfile?.gridRows ?? null}
        cols={gridProfile?.gridCols ?? null}
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
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Grid Size Status:{" "}
          {gridProfile?.gridRows && gridProfile?.gridCols ? (
            <span className="font-semibold text-emerald-700">Saved</span>
          ) : (
            <span className="font-semibold text-red-600">Not Set</span>
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
