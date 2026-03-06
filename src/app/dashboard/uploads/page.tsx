import Link from "next/link";
import UploadPanel from "@/components/upload-panel";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guards";
import { s3Bucket, s3Client } from "@/lib/s3";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { Role } from "@prisma/client";

const PAGE_SIZE = 100;

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

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function UploadsPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const params = await searchParams;
  const requestedPage = Math.max(
    1,
    parseInt(params?.page ?? "1", 10) || 1,
  );

  const where =
    session.user.role === Role.SUPERADMIN
      ? {}
      : session.user.role === Role.ADMIN
        ? { tenantId: session.user.tenantId ?? "__missing__" }
        : { userId: session.user.id };

  const total = await prisma.upload.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const uploads = await prisma.upload.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);

  const reportExistsByIndex =
    s3Bucket && uploads.length > 0
      ? await Promise.all(
          uploads.map(async (u) => {
            try {
              await s3Client.send(
                new HeadObjectCommand({
                  Bucket: s3Bucket,
                  Key: `${u.key}.report`,
                }),
              );
              return true;
            } catch {
              return false;
            }
          }),
        )
      : uploads.map(() => false);

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Upload recordings from OBS output directory to Cloud for review by
          Guinness records.
        </p>
      </div>
      <UploadPanel
        defaultHostName={session.user.name ?? undefined}
        defaultHostEmail={session.user.email ?? undefined}
      />
      <div className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 shadow-md sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <p className="text-sm text-[#6b4e3d]">
            {total === 0
              ? "No uploads"
              : `Showing ${start}–${end} of ${total}`}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f3d6a3] text-xs uppercase text-[#8a5b44]">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Key / Download</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, index) => (
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
                    <span className="block break-all">{upload.key}</span>
                    {(session.user.role === Role.ADMIN ||
                      session.user.role === Role.SUPERADMIN ||
                      session.user.role === Role.HOST) && (
                      <span className="mt-1 flex flex-wrap gap-2">
                        <a
                          href={`/api/uploads/download?key=${encodeURIComponent(upload.key)}`}
                          className="text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download file
                        </a>
                        <a
                          href={`/api/uploads/download?key=${encodeURIComponent(`${upload.key}.attest`)}`}
                          className="text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download .attest
                        </a>
                        {reportExistsByIndex[index] && (
                          <a
                            href={`/api/uploads/download?key=${encodeURIComponent(`${upload.key}.report`)}`}
                            className="text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download .report
                          </a>
                        )}
                      </span>
                    )}
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
        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-[#6b4e3d]">
              Page {currentPage} of {totalPages}
            </span>
            <span className="flex gap-2">
              {currentPage <= 1 ? (
                <span
                  className="cursor-not-allowed text-[#8a5b44]/50"
                  aria-disabled
                >
                  Previous
                </span>
              ) : (
                <Link
                  href={`/dashboard/uploads?page=${currentPage - 1}`}
                  className="text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Previous
                </Link>
              )}
              {currentPage >= totalPages ? (
                <span
                  className="cursor-not-allowed text-[#8a5b44]/50"
                  aria-disabled
                >
                  Next
                </span>
              ) : (
                <Link
                  href={`/dashboard/uploads?page=${currentPage + 1}`}
                  className="text-[#7a3b2a] underline hover:text-[#5a2b1a]"
                >
                  Next
                </Link>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
