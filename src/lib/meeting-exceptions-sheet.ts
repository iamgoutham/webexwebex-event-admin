import { google } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function getServiceAccountClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in env.",
    );
  }

  // Private key may contain literal \n; normalize to real newlines.
  const normalizedKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: normalizedKey,
    scopes: [SHEETS_SCOPE],
  });
}

export async function appendMeetingExceptionRows(rows: string[][]) {
  const spreadsheetId = process.env.MEETING_EXCEPTION_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("MEETING_EXCEPTION_SHEET_ID is not set in env.");
  }

  const auth = getServiceAccountClient();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    // Sheet tab name: meeting exception list, columns A–H (A1:H required for API parse)
    range: "'meeting exception list'!A1:H",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}

