import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, jsonError } from "@/lib/api-guards";

// ---------------------------------------------------------------------------
// GET /api/relay/status?broadcastId=xxx — Admin view of relay acknowledgments
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const broadcastId = searchParams.get("broadcastId");

  if (!broadcastId) {
    return jsonError("broadcastId query parameter is required", 400);
  }

  // Get the broadcast
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      id: true,
      title: true,
      tenantId: true,
      createdAt: true,
    },
  });

  if (!broadcast) {
    return jsonError("Broadcast not found", 404);
  }

  // Get all hosts who should have relayed this message
  const hostWhere = broadcast.tenantId
    ? { tenantId: broadcast.tenantId }
    : {};

  const allHosts = await prisma.user.findMany({
    where: hostWhere,
    select: { id: true, name: true, email: true },
  });

  // Get hosts who acknowledged
  const acknowledgments = await prisma.notification.findMany({
    where: {
      type: "RELAY",
    },
    select: {
      userId: true,
      data: true,
      createdAt: true,
    },
  });

  // Filter to relevant broadcast acknowledgments
  const acked = new Map<string, Date>();
  for (const ack of acknowledgments) {
    if (
      ack.data &&
      typeof ack.data === "object" &&
      (ack.data as Record<string, unknown>).broadcastId === broadcastId
    ) {
      acked.set(ack.userId, ack.createdAt);
    }
  }

  const hostsStatus = allHosts.map((host) => ({
    id: host.id,
    name: host.name,
    email: host.email,
    acknowledged: acked.has(host.id),
    acknowledgedAt: acked.get(host.id)?.toISOString() ?? null,
  }));

  const acknowledgedCount = hostsStatus.filter((h) => h.acknowledged).length;
  const pendingCount = hostsStatus.filter((h) => !h.acknowledged).length;

  return NextResponse.json({
    broadcast: {
      id: broadcast.id,
      title: broadcast.title,
    },
    summary: {
      totalHosts: allHosts.length,
      acknowledged: acknowledgedCount,
      pending: pendingCount,
      completionRate:
        allHosts.length > 0
          ? Math.round((acknowledgedCount / allHosts.length) * 100)
          : 0,
    },
    hosts: hostsStatus,
  });
}
