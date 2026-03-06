// ---------------------------------------------------------------------------
// Branded HTML email templates for Gita Chanting Event notifications
// ---------------------------------------------------------------------------
//
// Brand colors:
//   - Dark:   #3b1a1f
//   - Light:  #fbe9c6
//   - Accent: #d8792d
// ---------------------------------------------------------------------------

const BRAND = {
  dark: "#3b1a1f",
  light: "#fbe9c6",
  accent: "#d8792d",
  border: "#5c2a2d",
  textMuted: "#a08060",
  logoUrl: "", // set via env or leave empty for text-only header
};

const fromName = process.env.AWS_SES_FROM_NAME ?? "Gita Chanting Event";
const unsubscribeBaseUrl = process.env.NEXTAUTH_URL ?? "https://app.example.com";

// ---------------------------------------------------------------------------
// HTML email layout
// ---------------------------------------------------------------------------

/**
 * Render a full branded HTML email with the given subject and body.
 *
 * @param subject - Email subject (used as the heading inside the email)
 * @param body - Plain-text body (newlines converted to <br>, URLs auto-linked)
 * @param options - Optional extras: actionUrl, actionLabel, unsubscribeToken, imageUrl (JPEG/image URL to embed)
 */
export function renderEmailHtml(
  subject: string,
  body: string,
  options: {
    actionUrl?: string;
    actionLabel?: string;
    unsubscribeToken?: string;
    /** Optional image URL (e.g. hosted JPEG) to embed in the email body */
    imageUrl?: string;
  } = {},
): string {
  const bodyHtml = escapeHtml(body)
    .replace(/\n/g, "<br>")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#d8792d;text-decoration:underline;">$1</a>',
    );

  const embeddedImage =
    options.imageUrl && options.imageUrl.startsWith("http")
      ? `<div style="margin-top:16px;"><img src="${escapeHtml(options.imageUrl)}" alt="" style="max-width:100%;height:auto;border:0;display:block;" /></div>`
      : "";

  const ctaButton = options.actionUrl
    ? `
      <tr>
        <td align="center" style="padding:24px 0 8px;">
          <a href="${escapeHtml(options.actionUrl)}"
             style="display:inline-block;padding:12px 32px;background-color:${BRAND.accent};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;">
            ${escapeHtml(options.actionLabel ?? "Open")}
          </a>
        </td>
      </tr>`
    : "";

  const unsubscribeLink = options.unsubscribeToken
    ? `<a href="${unsubscribeBaseUrl}/api/unsubscribe/${options.unsubscribeToken}"
          style="color:${BRAND.textMuted};text-decoration:underline;">Unsubscribe</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(body.slice(0, 120))}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color:#f4f0eb;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Email container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
               class="email-container" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(59,26,31,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.dark};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:${BRAND.light};letter-spacing:0.02em;">
                🙏 ${escapeHtml(fromName)}
              </h1>
            </td>
          </tr>

          <!-- Subject heading -->
          <tr>
            <td style="padding:32px 32px 8px;border-bottom:2px solid ${BRAND.accent};">
              <h2 style="margin:0;font-size:22px;font-weight:700;color:${BRAND.dark};">
                ${escapeHtml(subject)}
              </h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;font-size:15px;line-height:1.6;color:#333333;">
              ${bodyHtml}
              ${embeddedImage}
            </td>
          </tr>

          <!-- CTA button (optional) -->
          ${ctaButton}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #eee;text-align:center;font-size:12px;color:${BRAND.textMuted};">
              <p style="margin:0 0 8px;">
                This email was sent by ${escapeHtml(fromName)}.
              </p>
              ${unsubscribeLink ? `<p style="margin:0;">${unsubscribeLink}</p>` : ""}
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain-text fallback
// ---------------------------------------------------------------------------

/**
 * Render a plain-text version of the email.
 * Used as the Text/plain MIME part alongside HTML.
 */
export function renderPlainText(
  subject: string,
  body: string,
  options: {
    actionUrl?: string;
    unsubscribeToken?: string;
  } = {},
): string {
  const lines: string[] = [
    `${fromName}`,
    "=".repeat(40),
    "",
    subject.toUpperCase(),
    "-".repeat(subject.length),
    "",
    body,
  ];

  if (options.actionUrl) {
    lines.push("", `Open: ${options.actionUrl}`);
  }

  lines.push(
    "",
    "-".repeat(40),
    `This email was sent by ${fromName}.`,
  );

  if (options.unsubscribeToken) {
    lines.push(
      `Unsubscribe: ${unsubscribeBaseUrl}/api/unsubscribe/${options.unsubscribeToken}`,
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
