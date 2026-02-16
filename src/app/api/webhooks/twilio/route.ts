import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/webhooks/twilio — Twilio SMS delivery status webhook
// ---------------------------------------------------------------------------
//
// Twilio sends delivery status updates to this endpoint when configured
// in your Twilio number's status callback URL.
//
// Status values: queued, failed, sent, delivered, undelivered
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let formData: URLSearchParams;
  try {
    const body = await request.text();
    formData = new URLSearchParams(body);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const messageSid = formData.get("MessageSid");
  const messageStatus = formData.get("MessageStatus");
  const errorCode = formData.get("ErrorCode");
  const errorMessage = formData.get("ErrorMessage");

  if (!messageSid || !messageStatus) {
    return NextResponse.json(
      { error: "Missing MessageSid or MessageStatus" },
      { status: 400 },
    );
  }

  console.log(
    `[twilio-webhook] Status update: ${messageSid} → ${messageStatus}`,
  );

  // Map Twilio status to our delivery status
  let deliveryStatus: string;
  let error: string | null = null;

  switch (messageStatus) {
    case "delivered":
      deliveryStatus = "DELIVERED";
      break;
    case "sent":
      deliveryStatus = "SENT";
      break;
    case "failed":
    case "undelivered":
      deliveryStatus = "FAILED";
      error = errorMessage
        ? `${errorCode}: ${errorMessage}`
        : `SMS ${messageStatus}`;
      break;
    default:
      // queued, sending, etc. — ignore intermediate states
      return NextResponse.json({ status: "ignored" });
  }

  try {
    await prisma.notificationDelivery.updateMany({
      where: { externalId: messageSid },
      data: {
        status: deliveryStatus,
        error,
        ...(deliveryStatus === "DELIVERED"
          ? { deliveredAt: new Date() }
          : {}),
      },
    });
  } catch (err) {
    console.error("[twilio-webhook] DB update error:", err);
  }

  return NextResponse.json({ status: "processed" });
}
