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
import { renderEmailHtml } from "@/lib/notifications/channels/email-templates";

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
  /** Optional image URL (e.g. hosted JPEG) to embed in the email body */
  imageUrl?: string | null;
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

  const { title, body: bodyText, target, channels, tenantId, templateSlug, imageUrl } = payload;

  // Resolve image URL: allow full URLs or paths from this app's public directory (e.g. /logo.jpg)
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://app.example.com";
  const resolvedImageUrl = (() => {
    const raw = imageUrl?.trim();
    if (!raw) return undefined;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${baseUrl}${path}`;
  })();

  const emailHtmlBody =
    resolvedImageUrl
      ? renderEmailHtml(title, bodyText, { imageUrl: resolvedImageUrl })
      : undefined;

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

      // Host emails from Host table (sheet-imported); domain-agnostic, send as group
      const hostWhere = { optedOut: false, ...(tenantId ? { tenantId } : { tenantId: null }) };
      const hostsFromTable = await prisma.host.findMany({
        where: hostWhere,
        select: { email: true },
      });
      const hostEmails = [...new Set(hostsFromTable.map((h) => h.email))];

      // In-app: only to Users (logged-in portal hosts)
      const userWhere = tenantId ? { tenantId } : {};
      const portalHosts = await prisma.user.findMany({
        where: userWhere,
        select: { id: true },
      });

      const { sendBulkEmail } = await import("@/lib/notifications/channels/email");
      let sentCount = 0;
      let failedCount = 0;

      if (channels.includes(DeliveryChannel.EMAIL) && hostEmails.length > 0) {
        const results = await sendBulkEmail(hostEmails, title, bodyText, emailHtmlBody);
        sentCount = results.filter((r) => r.success).length;
        failedCount = results.filter((r) => !r.success).length;
      }

      if (channels.includes(DeliveryChannel.IN_APP) && portalHosts.length > 0) {
        await prisma.notification.createMany({
          data: portalHosts.map((h) => ({
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
          totalCount: hostEmails.length,
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
        totalHosts: hostEmails.length,
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
      const results = await sendBulkEmail(uniqueEmails, title, bodyText, emailHtmlBody);
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

      // In-app for logged-in portal hosts
      const userWhere = tenantId ? { tenantId } : {};
      const portalHosts = await prisma.user.findMany({
        where: userWhere,
        select: { id: true },
      });

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

      let partSent = 0;
      let partFailed = 0;

      if (channels.includes(DeliveryChannel.EMAIL) && participantEmails.length > 0) {
        const partResults = await sendBulkEmail(participantEmails, title, bodyText, emailHtmlBody);
        partSent = partResults.filter((r) => r.success).length;
        partFailed = partResults.filter((r) => !r.success).length;
      }

      if (channels.includes(DeliveryChannel.IN_APP) && portalHosts.length > 0) {
        await prisma.notification.createMany({
          data: portalHosts.map((h) => ({
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
          totalCount: participantEmails.length,
          sentCount: partSent,
          failedCount: partFailed,
          sentAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Broadcast sent to all",
        broadcastId: broadcast.id,
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
