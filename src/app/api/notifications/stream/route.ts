import { NextRequest } from "next/server";
import { getServerAuthSession } from "@/lib/session";
import { sseManager } from "@/lib/notifications/sse-manager";
import { isRelayAndNotificationsSseDisabled } from "@/lib/relay-sse-disable";

// ---------------------------------------------------------------------------
// GET /api/notifications/stream — SSE endpoint for real-time notifications
// ---------------------------------------------------------------------------
//
// Opens a Server-Sent Events connection for the authenticated user.
// The connection stays open and receives notification events in real-time.
//
// Client usage:
//   const eventSource = new EventSource('/api/notifications/stream');
//   eventSource.onmessage = (e) => { const data = JSON.parse(e.data); ... };
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  if (isRelayAndNotificationsSseDisabled()) {
    return new Response("Notification live stream is disabled.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", userId })}\n\n`,
        ),
      );

      // Register this connection
      const cleanup = sseManager.addConnection(userId, controller);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Connection closed
          clearInterval(heartbeatInterval);
          cleanup();
        }
      }, 30_000);

      // Handle client disconnect via AbortSignal
      _request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
