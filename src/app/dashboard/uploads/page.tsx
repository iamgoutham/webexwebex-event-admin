import UploadPanel from "@/components/upload-panel";
import { requireRole } from "@/lib/guards";
import { ADMIN_ROLES } from "@/lib/rbac";

export default async function UploadsPage() {
  await requireRole(ADMIN_ROLES);

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Upload local recordings to S3 using the multipart API.
        </p>
      </div>
      <UploadPanel />
    </div>
  );
}
