import UploadPanel from "@/components/upload-panel";
import { requireAuth } from "@/lib/guards";

export default async function UploadsPage() {
  await requireAuth();

  return (
    <div className="space-y-6 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Upload recordings from OBS output directory to Cloud for review by
          Guinness records.
        </p>
      </div>
      <UploadPanel />
    </div>
  );
}
