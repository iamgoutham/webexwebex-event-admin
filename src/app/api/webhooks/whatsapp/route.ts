import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// WhatsApp Webhook — Meta Cloud API
// ---------------------------------------------------------------------------
//
// Meta sends message delivery statuses and incoming messages to this endpoint.
//
// Setup:
//   1. In Meta Business Manager → WhatsApp → Configuration
//   2. Set webhook URL to: https://your-domain.com/api/webhooks/whatsapp
//   3. Set verify token to WHATSAPP_VERIFY_TOKEN env var
//   4. Subscribe to: messages, message_deliveries
// ---------------------------------------------------------------------------

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "gita-chanting-verify";

// ---------------------------------------------------------------------------
// GET — Webhook verification (Meta verification challenge)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[whatsapp-webhook] Verification successful");
    return new Response(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — Incoming webhooks (delivery statuses, messages)
// ---------------------------------------------------------------------------

interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string };
        statuses?: Array<{
          id: string;
          status: string; // "delivered" | "read" | "sent" | "failed"
          timestamp: string;
          recipient_id: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
          }>;
        }>;
      };
      field?: string;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  let body: WhatsAppWebhookBody;
  try {
    body = (await request.json()) as WhatsAppWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const statuses = change.value?.statuses ?? [];

      for (const status of statuses) {
        const messageId = status.id;
        let deliveryStatus: string;
        let error: string | null = null;

        switch (status.status) {
          case "delivered":
            deliveryStatus = "DELIVERED";
            break;
          case "read":
            deliveryStatus = "DELIVERED"; // treat "read" as delivered
            break;
          case "sent":
            deliveryStatus = "SENT";
            break;
          case "failed":
            deliveryStatus = "FAILED";
            error = status.errors
              ?.map((e) => `${e.code}: ${e.title}`)
              .join("; ") ?? "WhatsApp delivery failed";
            break;
          default:
            continue;
        }

        console.log(
          `[whatsapp-webhook] ${messageId} → ${status.status}`,
        );

        try {
          await prisma.notificationDelivery.updateMany({
            where: { externalId: messageId },
            data: {
              status: deliveryStatus,
              error,
              ...(deliveryStatus === "DELIVERED"
                ? { deliveredAt: new Date() }
                : {}),
            },
          });
        } catch (err) {
          console.error("[whatsapp-webhook] DB update error:", err);
        }
      }
    }
  }

  return NextResponse.json({ status: "processed" });
}
