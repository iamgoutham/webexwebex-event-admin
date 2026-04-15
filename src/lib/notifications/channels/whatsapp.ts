import { DeliveryChannel } from "@prisma/client";
import { registerChannelHandler } from "../engine";
import type { ChannelHandler, ChannelSendResult } from "../types";

// ---------------------------------------------------------------------------
// WhatsApp Channel — Meta Cloud API (Hosts Only)
// ---------------------------------------------------------------------------
//
// Only used for hosts (authenticated users with phone numbers).
// Participants get free WhatsApp reach via the Host Relay panel.
//
// Requires:
//   WHATSAPP_ACCESS_TOKEN
//   And either WHATSAPP_PHONE_NUMBER_ID (sender) or WHATSAPP_WABA_ID (we resolve
//   phone number id via GET /{waba-id}/phone_numbers)
//
// Note: Meta Cloud API requires pre-approved templates for business-initiated
// messages. For event notifications, you'll need to create templates in the
// Meta Business Manager.
//
// For quick deployment, we use the "text" message type which works for
// 24-hour conversation windows (after a user messages you first).
// For proactive messaging, use approved templates.
// ---------------------------------------------------------------------------

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const WHATSAPP_WABA_ID = process.env.WHATSAPP_WABA_ID?.trim();
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim();

const isWhatsAppConfigured =
  !!WHATSAPP_ACCESS_TOKEN &&
  !!(WHATSAPP_PHONE_NUMBER_ID || WHATSAPP_WABA_ID);

const GRAPH_API_VERSION = "v18.0";

const whatsAppDebug =
  process.env.WHATSAPP_DEBUG === "true" || process.env.WHATSAPP_DEBUG === "1";

/** Cached sender id when using WABA lookup (phone number id from Graph API). */
let resolvedSenderPhoneNumberId: string | null | undefined;

function summarizeJson(value: unknown, maxLen = 2500): string {
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(value);
  }
}

/** Log the exact Graph API request when a call fails (no access token logged). */
function logWhatsAppGraphError(
  label: string,
  details: {
    method: string;
    url: string;
    requestBody?: unknown;
    httpStatus: number;
    responseBody: string;
  },
) {
  console.error(`[whatsapp] ${label} FAILED`, {
    method: details.method,
    url: details.url,
    requestBody: details.requestBody
      ? summarizeJson(details.requestBody)
      : undefined,
    httpStatus: details.httpStatus,
    responseBody:
      details.responseBody.length > 4000
        ? `${details.responseBody.slice(0, 4000)}…`
        : details.responseBody,
  });
}

function debugSuffix(
  method: string,
  url: string,
  requestBody?: unknown,
): string {
  if (!whatsAppDebug) return "";
  const summary = requestBody ? summarizeJson(requestBody, 1200) : "";
  return `\n[WhatsApp debug] ${method} ${url}${summary ? ` body=${summary}` : ""}`;
}

async function getSenderPhoneNumberId(): Promise<string | null> {
  if (WHATSAPP_PHONE_NUMBER_ID) {
    return WHATSAPP_PHONE_NUMBER_ID;
  }
  if (resolvedSenderPhoneNumberId !== undefined) {
    return resolvedSenderPhoneNumberId;
  }
  if (!WHATSAPP_WABA_ID || !WHATSAPP_ACCESS_TOKEN) {
    resolvedSenderPhoneNumberId = null;
    return null;
  }
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_WABA_ID}/phone_numbers?fields=id,display_phone_number`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      logWhatsAppGraphError("WABA phone_numbers", {
        method: "GET",
        url,
        httpStatus: res.status,
        responseBody: body,
      });
      resolvedSenderPhoneNumberId = null;
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ id: string; display_phone_number?: string }>;
    };
    const id = data.data?.[0]?.id ?? null;
    if (id) {
      console.log(
        "[whatsapp] Using sender phone_number_id from WABA",
        WHATSAPP_WABA_ID,
        data.data?.[0]?.display_phone_number ?? "",
      );
    } else {
      console.error("[whatsapp] WABA returned no phone numbers");
    }
    resolvedSenderPhoneNumberId = id;
    return id;
  } catch (err) {
    console.error("[whatsapp] WABA phone_numbers request failed:", err);
    resolvedSenderPhoneNumberId = null;
    return null;
  }
}

/**
 * Send a WhatsApp text message via Meta Cloud API.
 *
 * @param to - Phone number (E.164 format without +, e.g. 1234567890)
 * @param _subject - Ignored for WhatsApp
 * @param body - The message text
 */
async function sendWhatsApp(
  to: string,
  _subject: string,
  body: string,
): Promise<ChannelSendResult> {
  if (!isWhatsAppConfigured) {
    return {
      success: false,
      error:
        "WhatsApp not configured (missing WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_WABA_ID)",
    };
  }

  const senderId = await getSenderPhoneNumberId();
  if (!senderId) {
    return {
      success: false,
      error:
        "WhatsApp sender not resolved (set WHATSAPP_PHONE_NUMBER_ID or fix WHATSAPP_WABA_ID / token)",
    };
  }

  // Clean phone number: remove +, spaces, dashes
  const cleanPhone = to.replace(/[^0-9]/g, "");

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${senderId}/messages`;

    const requestPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: {
        preview_url: false,
        body: body.slice(0, 4096), // WhatsApp text limit
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logWhatsAppGraphError("send text message", {
        method: "POST",
        url,
        requestBody: requestPayload,
        httpStatus: response.status,
        responseBody: errorBody,
      });
      return {
        success: false,
        error: `WhatsApp API ${response.status}: ${errorBody}${debugSuffix("POST", url, requestPayload)}`,
      };
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };
    const messageId = data.messages?.[0]?.id;

    return {
      success: true,
      externalId: messageId,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] Failed to send to ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a WhatsApp template message (for proactive/business-initiated messages).
 *
 * @param to - Phone number
 * @param templateName - The pre-approved template name in Meta Business Manager
 * @param languageCode - Template language code (e.g. "en_US")
 * @param components - Template components (header, body parameters)
 */
async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  components?: Array<Record<string, unknown>>,
): Promise<ChannelSendResult> {
  if (!isWhatsAppConfigured) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const senderId = await getSenderPhoneNumberId();
  if (!senderId) {
    return {
      success: false,
      error:
        "WhatsApp sender not resolved (set WHATSAPP_PHONE_NUMBER_ID or fix WHATSAPP_WABA_ID / token)",
    };
  }

  const cleanPhone = to.replace(/[^0-9]/g, "");

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${senderId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logWhatsAppGraphError(`template "${templateName}"`, {
        method: "POST",
        url,
        requestBody: payload,
        httpStatus: response.status,
        responseBody: errorBody,
      });
      return {
        success: false,
        error: `WhatsApp template ${response.status}: ${errorBody}${debugSuffix("POST", url, payload)}`,
      };
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };
    return {
      success: true,
      externalId: data.messages?.[0]?.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Channel handler registration
// ---------------------------------------------------------------------------

const whatsAppHandler: ChannelHandler = {
  channel: DeliveryChannel.WHATSAPP,
  send: sendWhatsApp,
};

if (isWhatsAppConfigured) {
  registerChannelHandler(whatsAppHandler);
  console.log("[whatsapp] WhatsApp channel registered");
} else {
  console.log("[whatsapp] WhatsApp not configured — channel disabled");
}

export { sendWhatsApp, sendWhatsAppTemplate };
