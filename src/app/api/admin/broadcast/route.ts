import { NextRequest, NextResponse } from "next/server";
import { Role, BroadcastTarget, DeliveryChannel, BroadcastStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";
import {
  broadcastToHosts,
  broadcastToParticipants,
  broadcastToAll,
} from "@/lib/notifications/engine";
import { renderTemplate } from "@/lib/notifications/template";

// Ensure email channel is registered
import "@/lib/notifications/channels/email";

// ---------------------------------------------------------------------------
// POST /api/admin/broadcast — Send a broadcast notification
// ---------------------------------------------------------------------------

interface BroadcastBody {
  title: string;
  body: string;
  target: BroadcastTarget;
  channels: DeliveryChannel[];
  tenantId?: string | null;
  templateSlug?: string;
  severity?: string;
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: BroadcastBody;
  try {
    payload = (await request.json()) as BroadcastBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { title, body: bodyText, target, channels, tenantId, templateSlug } = payload;

  if (!title || !bodyText || !target) {
    return NextResponse.json(
      { error: "title, body, and target are required" },
      { status: 400 },
    );
  }

  // If a templateSlug is provided, use the notification engine's template system.
  // Otherwise, use the raw title/body directly.
  const effectiveSlug = templateSlug ?? "custom-broadcast";

  // For custom broadcasts without a template, we create an ad-hoc template in-memory
  // by using the title/body directly.

  console.log(
    `[broadcast] Initiated by ${session.user.email} — target: ${target}, tenantId: ${tenantId ?? "ALL"}, channels: ${channels.join(",")}`,
  );

  try {
    if (target === BroadcastTarget.HOSTS_ONLY) {
      // Create broadcast record
      const broadcast = await prisma.broadcast.create({
        data: {
          tenantId: tenantId ?? null,
          senderId: session.user.id,
          target: BroadcastTarget.HOSTS_ONLY,
          title,
          body: bodyText,
          channels: channels as string[],
          status: BroadcastStatus.SENDING,
          totalCount: 0,
        },
      });

      // Get host emails
      const hostWhere = tenantId ? { tenantId } : {};
      const hosts = await prisma.user.findMany({
        where: hostWhere,
        select: { id: true, email: true },
      });

      // Import email handler to send directly
      const { sendBulkEmail } = await import("@/lib/notifications/channels/email");
      const emails = hosts.map((h) => h.email).filter(Boolean) as string[];

      let sentCount = 0;
      let failedCount = 0;

      if (channels.includes(DeliveryChannel.EMAIL) && emails.length > 0) {
        const results = await sendBulkEmail(emails, title, bodyText);
        sentCount = results.filter((r) => r.success).length;
        failedCount = results.filter((r) => !r.success).length;
      }

      // Create in-app notifications for each host
      if (channels.includes(DeliveryChannel.IN_APP)) {
        await prisma.notification.createMany({
          data: hosts.map((h) => ({
            userId: h.id,
            tenantId: tenantId ?? null,
            type: "BROADCAST" as const,
            severity: "INFO" as const,
            title,
            body: bodyText,
            broadcastId: broadcast.id,
          })),
        });
      }

      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: BroadcastStatus.SENT,
          totalCount: emails.length,
          sentCount,
          failedCount,
          sentAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Broadcast sent to hosts",
        broadcastId: broadcast.id,
        sentCount,
        failedCount,
        totalHosts: hosts.length,
      });
    }

    if (target === BroadcastTarget.PARTICIPANTS_ONLY) {
      const broadcast = await prisma.broadcast.create({
        data: {
          tenantId: tenantId ?? null,
          senderId: session.user.id,
          target: BroadcastTarget.PARTICIPANTS_ONLY,
          title,
          body: bodyText,
          channels: [DeliveryChannel.EMAIL] as string[],
          status: BroadcastStatus.SENDING,
          totalCount: 0,
        },
      });

      // Get participant emails
      const partWhere = {
        optedOut: false,
        ...(tenantId ? { tenantId } : {}),
      };
      const participants = await prisma.participant.findMany({
        where: partWhere,
        select: { email: true },
      });

      const uniqueEmails = [...new Set(participants.map((p) => p.email))];

      const { sendBulkEmail } = await import("@/lib/notifications/channels/email");
      const results = await sendBulkEmail(uniqueEmails, title, bodyText);
      const sentCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: BroadcastStatus.SENT,
          totalCount: uniqueEmails.length,
          sentCount,
          failedCount,
          sentAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Broadcast sent to participants",
        broadcastId: broadcast.id,
        sentCount,
        failedCount,
        totalParticipants: uniqueEmails.length,
      });
    }

    if (target === BroadcastTarget.ALL) {
      const broadcast = await prisma.broadcast.create({
        data: {
          tenantId: tenantId ?? null,
          senderId: session.user.id,
          target: BroadcastTarget.ALL,
          title,
          body: bodyText,
          channels: channels as string[],
          status: BroadcastStatus.SENDING,
          totalCount: 0,
        },
      });

      // Send to hosts
      const hostWhere = tenantId ? { tenantId } : {};
      const hosts = await prisma.user.findMany({
        where: hostWhere,
        select: { id: true, email: true },
      });
      const hostEmails = hosts.map((h) => h.email).filter(Boolean) as string[];

      // Send to participants
      const partWhere = {
        optedOut: false,
        ...(tenantId ? { tenantId } : {}),
      };
      const participants = await prisma.participant.findMany({
        where: partWhere,
        select: { email: true },
      });
      const participantEmails = [...new Set(participants.map((p) => p.email))];

      const { sendBulkEmail } = await import("@/lib/notifications/channels/email");

      let hostSent = 0;
      let hostFailed = 0;
      let partSent = 0;
      let partFailed = 0;

      if (channels.includes(DeliveryChannel.EMAIL) && hostEmails.length > 0) {
        const hostResults = await sendBulkEmail(hostEmails, title, bodyText);
        hostSent = hostResults.filter((r) => r.success).length;
        hostFailed = hostResults.filter((r) => !r.success).length;
      }

      if (participantEmails.length > 0) {
        const partResults = await sendBulkEmail(participantEmails, title, bodyText);
        partSent = partResults.filter((r) => r.success).length;
        partFailed = partResults.filter((r) => !r.success).length;
      }

      // Create in-app notifications for hosts
      if (channels.includes(DeliveryChannel.IN_APP)) {
        await prisma.notification.createMany({
          data: hosts.map((h) => ({
            userId: h.id,
            tenantId: tenantId ?? null,
            type: "BROADCAST" as const,
            severity: "INFO" as const,
            title,
            body: bodyText,
            broadcastId: broadcast.id,
          })),
        });
      }

      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: BroadcastStatus.SENT,
          totalCount: hostEmails.length + participantEmails.length,
          sentCount: hostSent + partSent,
          failedCount: hostFailed + partFailed,
          sentAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Broadcast sent to all",
        broadcastId: broadcast.id,
        hosts: { sent: hostSent, failed: hostFailed, total: hostEmails.length },
        participants: { sent: partSent, failed: partFailed, total: participantEmails.length },
      });
    }

    return NextResponse.json(
      { error: `Unknown target: ${target}` },
      { status: 400 },
    );
  } catch (err) {
    console.error("[broadcast] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Broadcast failed" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/broadcast — List broadcast history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const [broadcasts, total] = await Promise.all([
    prisma.broadcast.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { name: true, email: true } },
        tenant: { select: { name: true } },
      },
    }),
    prisma.broadcast.count(),
  ]);

  return NextResponse.json({
    broadcasts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
