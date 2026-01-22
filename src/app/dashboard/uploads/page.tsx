import UploadPanel from "@/components/upload-panel";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";

export default async function UploadsPage() {
  await requireRole(ADMIN_ROLES);

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="mt-2 text-sm text-white/70">
          Upload local recordings to S3 using the multipart API.
        </p>
      </div>
      <UploadPanel />
    </div>
  );
}
