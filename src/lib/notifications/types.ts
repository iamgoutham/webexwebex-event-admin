import type {
  NotificationType,
  NotificationSeverity,
  DeliveryChannel,
  DeliveryStatus,
  BroadcastTarget,
  BroadcastStatus,
} from "@prisma/client";

// Re-export Prisma enums for convenience
export type {
  NotificationType,
  NotificationSeverity,
  DeliveryChannel,
  DeliveryStatus,
  BroadcastTarget,
  BroadcastStatus,
};

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

export interface RenderedNotification {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Notification engine inputs
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  /** Override channels (ignores template default + user preferences) */
  channels?: DeliveryChannel[];
  /** Override severity (ignores template default) */
  severity?: NotificationSeverity;
  /** Optional CTA link */
  actionUrl?: string;
  /** Arbitrary JSON payload attached to the notification */
  data?: Record<string, unknown>;
}

export interface BroadcastOptions extends NotifyOptions {
  /** null = all tenants */
  tenantId?: string | null;
  /** Who receives the broadcast */
  target: BroadcastTarget;
  /** Channels for hosts (participants always get EMAIL only) */
  hostChannels: DeliveryChannel[];
}

// ---------------------------------------------------------------------------
// Channel handler interface
// ---------------------------------------------------------------------------

export interface ChannelSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface ChannelHandler {
  channel: DeliveryChannel;
  send(to: string, subject: string, body: string, htmlBody?: string): Promise<ChannelSendResult>;
  sendBulk?(
    recipients: string[],
    subject: string,
    body: string,
    htmlBody?: string,
  ): Promise<ChannelSendResult[]>;
}

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

export interface SSENotificationEvent {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionUrl?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Broadcast API payloads
// ---------------------------------------------------------------------------

export interface CreateBroadcastPayload {
  tenantId?: string | null;
  target: BroadcastTarget;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  channels: DeliveryChannel[];
  scheduledAt?: string | null;
}

// ---------------------------------------------------------------------------
// Participant sync
// ---------------------------------------------------------------------------

export interface ParticipantSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Webex API response shapes (from FastAPI backend)
// ---------------------------------------------------------------------------

export interface WebexUser {
  email: string;
  invitePending: boolean;
}

export interface WebexMeeting {
  id: string;
  title: string;
  start: string;
  end: string;
  webLink?: string;
  meetingNumber?: string;
  state?: string;
  invitees?: WebexInvitee[];
}

export interface WebexInvitee {
  email: string;
  displayName?: string;
  name?: string;
  coHost?: boolean;
  role?: string;
  phone?: string;
}
