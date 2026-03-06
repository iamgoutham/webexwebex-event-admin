import { DeliveryChannel } from "@prisma/client";
import { registerChannelHandler } from "../engine";
import type { ChannelHandler, ChannelSendResult } from "../types";

// ---------------------------------------------------------------------------
// SMS Channel — Twilio (Hosts Only)
// ---------------------------------------------------------------------------
//
// Only used for hosts (authenticated users with phone numbers in the system).
// Participants receive email only.
//
// Requires:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//
// Note: We use the Twilio REST API directly to avoid adding the full
// twilio SDK (~2MB). If you prefer the SDK, install `twilio` and replace
// the fetch calls.
// ---------------------------------------------------------------------------

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

const isTwilioConfigured =
  !!TWILIO_ACCOUNT_SID && !!TWILIO_AUTH_TOKEN && !!TWILIO_FROM_NUMBER;

/**
 * Send a single SMS via Twilio REST API.
 *
 * @param to - Phone number (E.164 format, e.g. +1234567890)
 *             In our system, this comes from the user's phone field,
 *             but the engine passes `email` — we override in the handler.
 * @param subject - Ignored for SMS (no subject)
 * @param body - The message text
 */
async function sendSms(
  to: string,
  _subject: string,
  body: string,
): Promise<ChannelSendResult> {
  if (!isTwilioConfigured) {
    return {
      success: false,
      error: "Twilio not configured (missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER)",
    };
  }

  // Trim to 1600 chars (Twilio max for a concatenated SMS)
  const message = body.length > 1600 ? body.slice(0, 1597) + "..." : body;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
    ).toString("base64");

    const formData = new URLSearchParams({
      From: TWILIO_FROM_NUMBER!,
      To: to,
      Body: message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[sms] Twilio error (${response.status}):`, errorBody);
      return { success: false, error: `Twilio ${response.status}: ${errorBody}` };
    }

    const data = (await response.json()) as { sid?: string; status?: string };
    return {
      success: true,
      externalId: data.sid,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sms] Failed to send to ${to}:`, message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Channel handler registration
// ---------------------------------------------------------------------------

const smsHandler: ChannelHandler = {
  channel: DeliveryChannel.SMS,
  send: sendSms,
};

// Only register if Twilio is configured
if (isTwilioConfigured) {
  registerChannelHandler(smsHandler);
  console.log("[sms] Twilio SMS channel registered");
} else {
  console.log("[sms] Twilio not configured — SMS channel disabled");
}

export { sendSms };
