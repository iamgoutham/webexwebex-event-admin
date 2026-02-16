import { NextRequest, NextResponse } from "next/server";
import { processUnsubscribe } from "@/lib/notifications/unsubscribe";

// ---------------------------------------------------------------------------
// GET /api/unsubscribe/[token] — Public email unsubscribe (no auth required)
// ---------------------------------------------------------------------------
//
// Token format: base64url(email):hmac
// The token is verified using HMAC-SHA256, so no database lookup is needed
// for verification — only for the actual opt-out update.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!token) {
    return new NextResponse(renderPage("Invalid Link", "The unsubscribe link is invalid."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const result = await processUnsubscribe(decodeURIComponent(token));

  if (result.success) {
    return new NextResponse(
      renderPage(
        "Unsubscribed Successfully",
        `You have been unsubscribed from email notifications. You will no longer receive emails from us.`,
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  return new NextResponse(
    renderPage(
      "Unsubscribe Failed",
      result.error ?? "Unable to process your unsubscribe request. The link may be invalid or expired.",
    ),
    {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

// ---------------------------------------------------------------------------
// Simple HTML page renderer (no auth required, no React)
// ---------------------------------------------------------------------------

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Gita Chanting Event</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f4f0eb;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(59,26,31,0.1);
      max-width: 480px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: #3b1a1f;
      padding: 24px 32px;
      text-align: center;
    }
    .header h1 {
      color: #fbe9c6;
      font-size: 18px;
      font-weight: 700;
    }
    .body {
      padding: 32px;
      text-align: center;
    }
    .body h2 {
      font-size: 22px;
      color: #3b1a1f;
      margin-bottom: 16px;
    }
    .body p {
      font-size: 15px;
      line-height: 1.6;
      color: #555;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Gita Chanting Event</h1>
    </div>
    <div class="body">
      <div class="icon">${title.includes("Success") ? "✅" : "⚠️"}</div>
      <h2>${title}</h2>
      <p>${message}</p>
    </div>
  </div>
</body>
</html>`;
}
