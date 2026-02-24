import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { sendBulkEmail } from "@/lib/notifications/channels/email";
import { renderEmailHtml } from "@/lib/notifications/channels/email-templates";

const DEFAULT_SUBJECT = "SES test — Gita Chanting Event";
const DEFAULT_BODY =
  "This is a test email from the broadcast system. If you received this, SES is working correctly.";

function getTestGroupEmails(): string[] {
  const raw = process.env.SES_TEST_GROUP_EMAILS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

// ---------------------------------------------------------------------------
// GET — Return whether test group is configured (for UI)
// ---------------------------------------------------------------------------

export async function GET() {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = getTestGroupEmails();
  return NextResponse.json({
    configured: emails.length > 0,
    count: emails.length,
    emails: emails.length > 0 ? emails : undefined,
  });
}

// ---------------------------------------------------------------------------
// POST — Send a test email to each address in SES_TEST_GROUP_EMAILS
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = getTestGroupEmails();
  if (emails.length === 0) {
    return NextResponse.json(
      {
        error:
          "SES_TEST_GROUP_EMAILS is not set. Add comma-separated emails to .env and restart the server.",
      },
      { status: 400 },
    );
  }

  let subject = DEFAULT_SUBJECT;
  let body = DEFAULT_BODY;
  let imageUrl: string | undefined;
  try {
    const parsed = await request.json().catch(() => ({}));
    if (typeof parsed.subject === "string" && parsed.subject.trim())
      subject = parsed.subject.trim();
    if (typeof parsed.body === "string" && parsed.body.trim())
      body = parsed.body.trim();
    if (typeof parsed.imageUrl === "string" && parsed.imageUrl.trim()) {
      imageUrl = parsed.imageUrl.trim();
    }
  } catch {
    // use defaults
  }

  // Resolve image URL (same behavior as main broadcast route)
  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://app.example.com";
  const resolvedImageUrl = (() => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${path}`;
  })();

  const htmlBody = resolvedImageUrl
    ? renderEmailHtml(subject, body, { imageUrl: resolvedImageUrl })
    : undefined;

  const results = await sendBulkEmail(emails, subject, body, htmlBody);
  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Test email sent to ${sent} of ${emails.length} addresses`,
    sent,
    failed,
    total: emails.length,
    results: emails.map((email, i) => ({
      email,
      success: results[i]?.success ?? false,
      error: results[i]?.success ? undefined : (results[i]?.error ?? "Unknown error"),
    })),
  });
}
