import { NextRequest, NextResponse } from "next/server";
import { Role, BroadcastStatus, BroadcastTarget } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, jsonError } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/relay — Get active relay messages for the current host
// ---------------------------------------------------------------------------

export async function GET() {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  // Get recent relay-type broadcasts (RELAY target or broadcasts that have relay content)
  const relayMessages = await prisma.broadcast.findMany({
    where: {
      status: BroadcastStatus.SENT,
      OR: [
        { tenantId: null }, // Cross-tenant broadcasts
        { tenantId: session.user.tenantId }, // Same tenant
      ],
    },
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      target: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  });

  // Check which ones this host has acknowledged
  const acknowledgments = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      type: "RELAY",
      data: { not: null },
    },
    select: {
      data: true,
    },
  });

  // Extract acknowledged broadcast IDs from notification data
  const acknowledgedIds = new Set<string>();
  for (const ack of acknowledgments) {
    if (ack.data && typeof ack.data === "object" && "broadcastId" in (ack.data as Record<string, unknown>)) {
      acknowledgedIds.add((ack.data as Record<string, unknown>).broadcastId as string);
    }
  }

  const messagesWithStatus = relayMessages.map((msg) => ({
    ...msg,
    acknowledged: acknowledgedIds.has(msg.id),
  }));

  return NextResponse.json({ relayMessages: messagesWithStatus });
}

// ---------------------------------------------------------------------------
// POST /api/relay — Acknowledge a relay message (host clicked "Copied & Sent")
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiAuth();
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  let body: { broadcastId: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { broadcastId } = body;
  if (!broadcastId) {
    return jsonError("broadcastId is required", 400);
  }

  // Verify the broadcast exists
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: { id: true },
  });

  if (!broadcast) {
    return jsonError("Broadcast not found", 404);
  }

  // Create a notification record to track the acknowledgment
  await prisma.notification.create({
    data: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      type: "RELAY",
      severity: "INFO",
      title: "Relay message acknowledged",
      body: `Acknowledged relay for broadcast ${broadcastId}`,
      data: { broadcastId, acknowledgedAt: new Date().toISOString() },
    },
  });

  return NextResponse.json({
    message: "Acknowledgment recorded",
    broadcastId,
  });
}
