import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// AWS SES v2 SNS Webhook — Bounce & Complaint Handler
// ---------------------------------------------------------------------------
//
// SES sends bounce and complaint notifications to an SNS topic.
// SNS forwards them to this endpoint as HTTP POST with JSON body.
//
// Flow:
//   1. SES detects bounce/complaint
//   2. SES publishes event to SNS topic
//   3. SNS sends HTTP POST to this endpoint
//   4. We process the event:
//      - Bounces: mark delivery as BOUNCED, optionally suppress the email
//      - Complaints: mark participant as opted out
//
// Setup:
//   1. Create SNS topic in AWS Console
//   2. Configure SES to publish bounce/complaint events to the topic
//   3. Create an HTTPS subscription pointing to this endpoint:
//      https://your-domain.com/api/webhooks/ses
//   4. Confirm the subscription (handled automatically below)
// ---------------------------------------------------------------------------

interface SNSMessage {
  Type: string;
  MessageId?: string;
  TopicArn?: string;
  Token?: string;
  Message?: string;
  SubscribeURL?: string;
  Subject?: string;
  Timestamp?: string;
}

interface SESBounceEvent {
  eventType: "Bounce";
  bounce: {
    bounceType: string; // "Permanent" | "Transient"
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
  };
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
  };
}

interface SESComplaintEvent {
  eventType: "Complaint";
  complaint: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    complaintFeedbackType?: string;
    timestamp: string;
  };
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
  };
}

type SESEvent = SESBounceEvent | SESComplaintEvent;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  let snsMessage: SNSMessage;

  try {
    const body = await request.text();
    snsMessage = JSON.parse(body) as SNSMessage;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Handle SNS subscription confirmation
  if (snsMessage.Type === "SubscriptionConfirmation" && snsMessage.SubscribeURL) {
    console.log(
      "[ses-webhook] Confirming SNS subscription:",
      snsMessage.TopicArn,
    );
    try {
      await fetch(snsMessage.SubscribeURL);
      return NextResponse.json({ status: "subscription_confirmed" });
    } catch (err) {
      console.error("[ses-webhook] Failed to confirm subscription:", err);
      return NextResponse.json(
        { error: "Failed to confirm subscription" },
        { status: 500 },
      );
    }
  }

  // Handle notification messages
  if (snsMessage.Type === "Notification" && snsMessage.Message) {
    let event: SESEvent;
    try {
      event = JSON.parse(snsMessage.Message) as SESEvent;
    } catch {
      console.error("[ses-webhook] Failed to parse SES event from SNS message");
      return NextResponse.json(
        { error: "Invalid SES event in message" },
        { status: 400 },
      );
    }

    try {
      if (event.eventType === "Bounce") {
        await handleBounce(event);
      } else if (event.eventType === "Complaint") {
        await handleComplaint(event);
      } else {
        console.log(
          "[ses-webhook] Ignoring event type:",
          (event as { eventType?: string }).eventType,
        );
      }
    } catch (err) {
      console.error("[ses-webhook] Error processing event:", err);
      // Still return 200 to prevent SNS from retrying
    }

    return NextResponse.json({ status: "processed" });
  }

  return NextResponse.json({ status: "ignored" });
}

// ---------------------------------------------------------------------------
// Bounce handler
// ---------------------------------------------------------------------------

async function handleBounce(event: SESBounceEvent): Promise<void> {
  const { bounce, mail } = event;
  const messageId = mail.messageId;
  const isPermanent = bounce.bounceType === "Permanent";

  console.log(
    `[ses-webhook] Bounce (${bounce.bounceType}/${bounce.bounceSubType}) for message ${messageId}`,
  );

  for (const recipient of bounce.bouncedRecipients) {
    const email = recipient.emailAddress.toLowerCase();

    // Update delivery record if we can find it by externalId
    await prisma.notificationDelivery.updateMany({
      where: { externalId: messageId },
      data: {
        status: "BOUNCED",
        error: `${bounce.bounceType}: ${bounce.bounceSubType} - ${recipient.diagnosticCode ?? "no diagnostic"}`,
      },
    });

    // For permanent bounces, suppress future emails to this address
    if (isPermanent) {
      // Opt out all participant records with this email
      await prisma.participant.updateMany({
        where: { email },
        data: { optedOut: true },
      });

      console.log(
        `[ses-webhook] Permanently bounced — opted out participant: ${email}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Complaint handler
// ---------------------------------------------------------------------------

async function handleComplaint(event: SESComplaintEvent): Promise<void> {
  const { complaint, mail } = event;
  const messageId = mail.messageId;

  console.log(
    `[ses-webhook] Complaint (${complaint.complaintFeedbackType ?? "unknown"}) for message ${messageId}`,
  );

  for (const recipient of complaint.complainedRecipients) {
    const email = recipient.emailAddress.toLowerCase();

    // Update delivery record
    await prisma.notificationDelivery.updateMany({
      where: { externalId: messageId },
      data: {
        status: "FAILED",
        error: `Complaint: ${complaint.complaintFeedbackType ?? "unknown"}`,
      },
    });

    // Opt out the participant from all future emails
    await prisma.participant.updateMany({
      where: { email },
      data: { optedOut: true },
    });

    console.log(
      `[ses-webhook] Complaint — opted out participant: ${email}`,
    );
  }
}
