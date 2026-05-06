import RelayPanel from "@/components/notifications/relay-panel";
import { requireAuth } from "@/lib/guards";
import { isRelayAndNotificationsSseDisabled } from "@/lib/relay-sse-disable";

export default async function RelayPage() {
  await requireAuth();
  const relayDisabled = isRelayAndNotificationsSseDisabled();

  return (
    <div className="space-y-8 text-[#3b1a1f]">
      <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-8 shadow-lg">
        <h1 className="text-2xl font-semibold">Message Relay</h1>
        {relayDisabled ? (
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Message relay is turned off for this deployment. To enable it, set{" "}
            <code className="rounded bg-[#f7e2b6] px-1.5 py-0.5 text-xs text-[#3b1a1f]">
              RELAY_AND_NOTIFICATIONS_SSE_ENABLED=1
            </code>{" "}
            in the server environment and restart the app.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#6b4e3d]">
            Copy pre-formatted messages and forward them to your participants via
            WhatsApp. Click &quot;Copied &amp; Sent&quot; after forwarding to track
            completion.
          </p>
        )}
      </div>

      {relayDisabled ? null : <RelayPanel />}
    </div>
  );
}
