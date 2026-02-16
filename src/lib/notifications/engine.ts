import { prisma } from "@/lib/prisma";
import {
  type Prisma,
  DeliveryChannel,
  NotificationSeverity,
  BroadcastStatus,
  BroadcastTarget,
} from "@prisma/client";
import { renderNotification } from "./template";
import type {
  TemplateVariables,
  NotifyOptions,
  BroadcastOptions,
  ChannelHandler,
  ChannelSendResult,
} from "./types";

// ---------------------------------------------------------------------------
// Channel handler registry
// ---------------------------------------------------------------------------

const channelHandlers = new Map<DeliveryChannel, ChannelHandler>();

/**
 * Register a channel handler (called at startup by each channel module).
 */
export function registerChannelHandler(handler: ChannelHandler): void {
  channelHandlers.set(handler.channel, handler);
}

function getHandler(channel: DeliveryChannel): ChannelHandler | undefined {
  return channelHandlers.get(channel);
}

// ---------------------------------------------------------------------------
// Core: notify a single user (host)
// ---------------------------------------------------------------------------

/**
 * Send a notification to a single authenticated user (host).
 *
 * 1. Resolves the template by slug
 * 2. Renders title/body with variables
 * 3. Checks user's notification preferences
 * 4. Creates Notification + NotificationDelivery records
 * 5. Dispatches to each enabled channel
 * 6. Updates delivery statuses
 */
export async function notify(
  userId: string,
  templateSlug: string,
  variables: TemplateVariables = {},
  options: NotifyOptions = {},
): Promise<string | null> {
  const rendered = await renderNotification(templateSlug, variables);
  if (!rendered) {
    console.error(
      `[notifications] Template not found: ${templateSlug}`,
    );
    return null;
  }

  const { title, body, template } = rendered;

  // Determine which channels to use
  const templateChannels = (template.channels as string[]) ?? [];
  const requestedChannels =
    options.channels ?? templateChannels.map((c) => c as DeliveryChannel);

  // Fetch user's preferences
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId },
  });
  const disabledChannels = new Set(
    preferences.filter((p) => !p.enabled).map((p) => p.channel),
  );

  // Filter to enabled channels only
  const enabledChannels = requestedChannels.filter(
    (ch) => !disabledChannels.has(ch),
  );

  if (enabledChannels.length === 0) return null;

  // Look up user for tenantId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, email: true },
  });

  // Create notification record
  const notification = await prisma.notification.create({
    data: {
      userId,
      tenantId: user?.tenantId ?? null,
      type: template.type,
      severity: options.severity ?? NotificationSeverity.INFO,
      title,
      body,
      data: (options.data ?? undefined) as Prisma.InputJsonValue | undefined,
      actionUrl: options.actionUrl ?? null,
      deliveries: {
        create: enabledChannels.map((channel) => ({ channel })),
      },
    },
    include: { deliveries: true },
  });

  // Dispatch to channels (fire and forget, update statuses async)
  dispatchDeliveries(notification.deliveries, user?.email ?? "", title, body);

  return notification.id;
}

// ---------------------------------------------------------------------------
// Core: notify multiple users
// ---------------------------------------------------------------------------

/**
 * Send the same notification to multiple users.
 * Returns an array of notification IDs (null for failures).
 */
export async function notifyMany(
  userIds: string[],
  templateSlug: string,
  variables: TemplateVariables = {},
  options: NotifyOptions = {},
): Promise<(string | null)[]> {
  const results = await Promise.allSettled(
    userIds.map((userId) => notify(userId, templateSlug, variables, options)),
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}

// ---------------------------------------------------------------------------
// Broadcast to hosts
// ---------------------------------------------------------------------------

/**
 * Broadcast a notification to all hosts.
 * tenantId=null → all tenants.
 */
export async function broadcastToHosts(
  tenantId: string | null | undefined,
  templateSlug: string,
  variables: TemplateVariables = {},
  channels: DeliveryChannel[] = [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
  options: NotifyOptions = {},
): Promise<string | null> {
  const rendered = await renderNotification(templateSlug, variables);
  if (!rendered) return null;

  // Fetch all hosts
  const where = tenantId ? { tenantId } : {};
  const hosts = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  if (hosts.length === 0) return null;

  // Create broadcast record
  const broadcast = await prisma.broadcast.create({
    data: {
      tenantId: tenantId ?? null,
      senderId: options.data?.senderId as string ?? "system",
      target: BroadcastTarget.HOSTS_ONLY,
      title: rendered.title,
      body: rendered.body,
      channels: channels as string[],
      status: BroadcastStatus.SENDING,
      totalCount: hosts.length,
    },
  });

  // Notify each host
  const results = await notifyMany(
    hosts.map((h) => h.id),
    templateSlug,
    variables,
    { ...options, channels },
  );

  const sentCount = results.filter((r) => r !== null).length;
  const failedCount = results.filter((r) => r === null).length;

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status: BroadcastStatus.SENT,
      sentCount,
      failedCount,
      sentAt: new Date(),
    },
  });

  return broadcast.id;
}

// ---------------------------------------------------------------------------
// Broadcast to participants (email only)
// ---------------------------------------------------------------------------

/**
 * Broadcast email to all participants (no auth users).
 * tenantId=null → all tenants.
 * Skips participants with optedOut=true.
 */
export async function broadcastToParticipants(
  tenantId: string | null | undefined,
  templateSlug: string,
  variables: TemplateVariables = {},
  options: NotifyOptions = {},
): Promise<{ sent: number; failed: number }> {
  const rendered = await renderNotification(templateSlug, variables);
  if (!rendered) return { sent: 0, failed: 0 };

  const where = {
    optedOut: false,
    ...(tenantId ? { tenantId } : {}),
  };

  const participants = await prisma.participant.findMany({
    where,
    select: { email: true },
  });

  if (participants.length === 0) return { sent: 0, failed: 0 };

  const emailHandler = getHandler(DeliveryChannel.EMAIL);
  if (!emailHandler) {
    console.error("[notifications] EMAIL channel handler not registered");
    return { sent: 0, failed: participants.length };
  }

  // Deduplicate emails
  const uniqueEmails = [...new Set(participants.map((p) => p.email))];

  // Use bulk send if available, otherwise send individually
  let results: ChannelSendResult[];
  if (emailHandler.sendBulk) {
    results = await emailHandler.sendBulk(
      uniqueEmails,
      rendered.title,
      rendered.body,
    );
  } else {
    const settled = await Promise.allSettled(
      uniqueEmails.map((email) =>
        emailHandler.send(email, rendered.title, rendered.body),
      ),
    );
    results = settled.map((r) =>
      r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) },
    );
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Broadcast to all (hosts multi-channel + participants email)
// ---------------------------------------------------------------------------

/**
 * Combined broadcast: hosts get multi-channel, participants get email.
 */
export async function broadcastToAll(
  options: BroadcastOptions,
  templateSlug: string,
  variables: TemplateVariables = {},
): Promise<{
  broadcastId: string | null;
  hostsSent: number;
  participantsSent: number;
  participantsFailed: number;
}> {
  // Broadcast to hosts
  const broadcastId = await broadcastToHosts(
    options.tenantId,
    templateSlug,
    variables,
    options.hostChannels,
    options,
  );

  // Broadcast to participants (email only)
  const participantResult = await broadcastToParticipants(
    options.tenantId,
    templateSlug,
    variables,
    options,
  );

  // Update broadcast record with participant counts
  if (broadcastId) {
    const existing = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { sentCount: true, failedCount: true, totalCount: true },
    });
    if (existing) {
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          target: BroadcastTarget.ALL,
          totalCount:
            existing.totalCount +
            participantResult.sent +
            participantResult.failed,
          sentCount: existing.sentCount + participantResult.sent,
          failedCount: existing.failedCount + participantResult.failed,
        },
      });
    }
  }

  return {
    broadcastId,
    hostsSent: broadcastId ? 1 : 0, // simplified — actual count is in the broadcast record
    participantsSent: participantResult.sent,
    participantsFailed: participantResult.failed,
  };
}

// ---------------------------------------------------------------------------
// Internal: dispatch deliveries to channel handlers
// ---------------------------------------------------------------------------

async function dispatchDeliveries(
  deliveries: Array<{ id: string; channel: DeliveryChannel }>,
  recipientEmail: string,
  subject: string,
  body: string,
): Promise<void> {
  const tasks = deliveries.map(async (delivery) => {
    const handler = getHandler(delivery.channel);

    // IN_APP notifications don't need external dispatch — they're already in the DB.
    // The SSE manager will pick them up separately.
    if (delivery.channel === DeliveryChannel.IN_APP) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          sentAt: new Date(),
          deliveredAt: new Date(),
        },
      });
      return;
    }

    if (!handler) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          error: `No handler registered for channel: ${delivery.channel}`,
        },
      });
      return;
    }

    try {
      const result = await handler.send(recipientEmail, subject, body);
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.success ? "SENT" : "FAILED",
          externalId: result.externalId ?? null,
          error: result.error ?? null,
          sentAt: result.success ? new Date() : null,
        },
      });
    } catch (err) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });

  // Fire all channel dispatches in parallel, don't block the caller
  Promise.allSettled(tasks).catch((err) => {
    console.error("[notifications] Dispatch error:", err);
  });
}
