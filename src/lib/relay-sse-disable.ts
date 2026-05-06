/**
 * Message Relay (dashboard + API) and notification bell SSE
 * (`/api/notifications/stream`) are disabled unless explicitly enabled.
 *
 * Set `RELAY_AND_NOTIFICATIONS_SSE_ENABLED=1` (or `true`) to turn them back on.
 */

export function isRelayAndNotificationsSseEnabled(): boolean {
  const v = process.env.RELAY_AND_NOTIFICATIONS_SSE_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isRelayAndNotificationsSseDisabled(): boolean {
  return !isRelayAndNotificationsSseEnabled();
}
