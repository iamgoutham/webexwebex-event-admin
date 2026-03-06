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
//   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
//
// Note: Meta Cloud API requires pre-approved templates for business-initiated
// messages. For event notifications, you'll need to create templates in the
// Meta Business Manager.
//
// For quick deployment, we use the "text" message type which works for
// 24-hour conversation windows (after a user messages you first).
// For proactive messaging, use approved templates.
// ---------------------------------------------------------------------------

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const isWhatsAppConfigured =
  !!WHATSAPP_PHONE_NUMBER_ID && !!WHATSAPP_ACCESS_TOKEN;

const GRAPH_API_VERSION = "v18.0";

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
        "WhatsApp not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)",
    };
  }

  // Clean phone number: remove +, spaces, dashes
  const cleanPhone = to.replace(/[^0-9]/g, "");

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: false,
          body: body.slice(0, 4096), // WhatsApp text limit
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[whatsapp] Meta API error (${response.status}):`,
        errorBody,
      );
      return {
        success: false,
        error: `WhatsApp API ${response.status}: ${errorBody}`,
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

  const cleanPhone = to.replace(/[^0-9]/g, "");

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

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
      return {
        success: false,
        error: `WhatsApp template ${response.status}: ${errorBody}`,
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
