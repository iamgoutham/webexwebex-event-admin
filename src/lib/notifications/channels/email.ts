import {
  SESv2Client,
  SendEmailCommand,
  SendBulkEmailCommand,
  type BulkEmailEntry,
} from "@aws-sdk/client-sesv2";
import { DeliveryChannel } from "@prisma/client";
import { registerChannelHandler } from "../engine";
import type { ChannelHandler, ChannelSendResult } from "../types";
import { renderEmailHtml, renderPlainText } from "./email-templates";

// ---------------------------------------------------------------------------
// SES v2 client (reuses AWS creds from S3 config)
// ---------------------------------------------------------------------------

const sesRegion = process.env.AWS_SES_REGION ?? process.env.AWS_REGION;

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const sesClient = new SESv2Client({
  region: sesRegion,
  credentials,
});

const fromEmail = process.env.AWS_SES_FROM_EMAIL ?? "noreply@example.com";
const fromName = process.env.AWS_SES_FROM_NAME ?? "Gita Chanting Event";
const fromAddress = `${fromName} <${fromEmail}>`;

// ---------------------------------------------------------------------------
// Send a single email
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  htmlBody?: string,
): Promise<ChannelSendResult> {
  const html = htmlBody ?? renderEmailHtml(subject, body);
  const text = renderPlainText(subject, body);

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
          Headers: [
            {
              Name: "List-Unsubscribe",
              Value: `<mailto:${fromEmail}?subject=unsubscribe>`,
            },
          ],
        },
      },
    });

    const response = await sesClient.send(command);
    return {
      success: true,
      externalId: response.MessageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send to ${to}:`, message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Send bulk emails (batches of 50 per SES v2 limit)
// ---------------------------------------------------------------------------

async function sendBulkEmail(
  recipients: string[],
  subject: string,
  body: string,
  htmlBody?: string,
): Promise<ChannelSendResult[]> {
  const html = htmlBody ?? renderEmailHtml(subject, body);
  const text = renderPlainText(subject, body);
  const allResults: ChannelSendResult[] = [];

  // Throttle to respect SES max send rate (emails/second).
  // Default to 14/s if not configured (matches SES console value you mentioned).
  const maxRateEnv = Number(process.env.SES_MAX_SEND_RATE ?? "14");
  const MAX_RATE =
    Number.isFinite(maxRateEnv) && maxRateEnv > 0 ? maxRateEnv : 14;

  // SES v2 SendBulkEmail supports up to 50 destinations per call.
  // We also cap by MAX_RATE so we never exceed the allowed recipients/sec.
  const BATCH_SIZE = Math.min(50, Math.max(1, MAX_RATE));
  const BATCH_DELAY_MS = 1000; // 1 second between batches

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const entries: BulkEmailEntry[] = batch.map((email) => ({
      Destination: {
        ToAddresses: [email],
      },
    }));

    try {
      const command = new SendBulkEmailCommand({
        FromEmailAddress: fromAddress,
        DefaultContent: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
        BulkEmailEntries: entries,
      });

      const response = await sesClient.send(command);

      const statuses = response.BulkEmailEntryResults ?? [];
      for (let j = 0; j < batch.length; j++) {
        const status = statuses[j];
        if (status?.Status === "SUCCESS") {
          allResults.push({
            success: true,
            externalId: status.MessageId,
          });
        } else {
          allResults.push({
            success: false,
            error: status?.Error ?? "Unknown bulk send error",
          });
        }
      }
    } catch (err) {
      // If the entire batch call fails, mark all recipients as failed
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[email] Bulk send batch failed:`, message);

      // Fall back to individual sends for this batch
      const fallbackResults = await Promise.allSettled(
        batch.map((email) => sendEmail(email, subject, body, html)),
      );

      for (const result of fallbackResults) {
        if (result.status === "fulfilled") {
          allResults.push(result.value);
        } else {
          allResults.push({
            success: false,
            error: String(result.reason),
          });
        }
      }
    }

    // Simple throttling between batches to stay under SES rate.
    if (i + BATCH_SIZE < recipients.length) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Channel handler registration
// ---------------------------------------------------------------------------

const emailHandler: ChannelHandler = {
  channel: DeliveryChannel.EMAIL,
  send: sendEmail,
  sendBulk: sendBulkEmail,
};

registerChannelHandler(emailHandler);

export { sendEmail, sendBulkEmail, sesClient };
