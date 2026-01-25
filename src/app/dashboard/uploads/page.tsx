import UploadPanel from "@/components/upload-panel";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { Role } from "@prisma/client";

const formatBytes = (value?: number | null) => {
  if (!value) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const scaled = value / Math.pow(1024, index);
  return `${scaled.toFixed(scaled >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export default async function UploadsPage() {
  const session = await requireAuth();

  const uploads = await prisma.upload.findMany({
    where:
      session.user.role === Role.SUPERADMIN
        ? {}
        : session.user.role === Role.ADMIN
        ? { tenantId: session.user.tenantId ?? "__missing__" }
        : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Upload recordings from OBS output directory to Cloud for review by
          Guinness records.
        </p>
      </div>
      <UploadPanel />
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <h2 className="text-lg font-semibold">Recent uploads</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f3d6a3] text-xs uppercase text-[#8a5b44]">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Key</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.id} className="border-t border-[#e5c18e]">
                  <td className="px-4 py-3">
                    {upload.filename ?? "Unnamed file"}
                  </td>
                  <td className="px-4 py-3">{formatBytes(upload.sizeBytes)}</td>
                  <td className="px-4 py-3">{upload.status}</td>
                  <td className="px-4 py-3">
                    {upload.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b4e3d]">
                    {upload.key}
                  </td>
                </tr>
              ))}
              {uploads.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-[#8a5b44]" colSpan={5}>
                    No uploads recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
