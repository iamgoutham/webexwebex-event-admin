import { requireAuth } from "@/lib/guards";
import RelayPanel from "@/components/notifications/relay-panel";

export default async function RelayPage() {
  await requireAuth();

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Message Relay</h1>
        <p className="mt-2 text-sm text-[#6b4e3d]">
          Copy pre-formatted messages and forward them to your participants via
          WhatsApp. Click &quot;Copied &amp; Sent&quot; after forwarding to track
          completion.
        </p>
      </div>

      <RelayPanel />
    </div>
  );
}
