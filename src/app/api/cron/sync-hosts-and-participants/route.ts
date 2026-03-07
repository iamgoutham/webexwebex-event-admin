import { NextResponse } from "next/server";
import { syncHosts } from "@/lib/notifications/host-sync";
import { syncParticipants } from "@/lib/notifications/participant-sync";

/**
 * Cron endpoint: sync hosts and participants from Google Sheets (same as
 * the "Sync Hosts" and "Sync Participants" buttons on the broadcast page).
 *
 * Secured by CRON_SECRET. Vercel Cron sends: Authorization: Bearer <CRON_SECRET>.
 * External crons can use header: x-cron-secret: <CRON_SECRET>.
 *
 * Schedule: every 2 hours (configured in vercel.json).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/sync] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearerMatch = authHeader?.startsWith("Bearer ");
  const token = bearerMatch ? authHeader.slice(7) : null;

  if (token !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/sync] Starting hosts + participants sync");

    const [hostResult, participantResult] = await Promise.all([
      syncHosts(null),
      syncParticipants(null),
    ]);

    console.log(
      `[cron/sync] Hosts — created: ${hostResult.created}, updated: ${hostResult.updated}, skipped: ${hostResult.skipped}, errors: ${hostResult.errors.length}`,
    );
    console.log(
      `[cron/sync] Participants — created: ${participantResult.created}, updated: ${participantResult.updated}, skipped: ${participantResult.skipped}, errors: ${participantResult.errors.length}`,
    );

    return NextResponse.json({
      message: "Sync complete",
      hosts: hostResult,
      participants: participantResult,
    });
  } catch (error) {
    console.error("[cron/sync] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
