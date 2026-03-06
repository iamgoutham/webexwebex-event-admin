#!/usr/bin/env node
/**
 * Standalone script to test meeting-info lookup debug for a given email.
 *
 * Usage (from project root):
 *   node scripts/test-meeting-lookup.js <email>
 *
 * Requires .env with:
 *   GOOGLE_LICENSE_SHEET_1_ID
 *   GOOGLE_LICENSE_SHEET_2_ID
 *   GOOGLE_LICENSE_SHEET_1_GID (optional)
 *   GOOGLE_LICENSE_SHEET_2_GID (optional)
 */

const fs = require("fs");
const path = require("path");

// Load .env from project root
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const normalizeValue = (value) => String(value || "").trim().toLowerCase();

function parseCsv(csv) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function findColumnIndex(headers, target) {
  const normalizedTarget = normalizeValue(target);
  return headers.findIndex((header) => normalizeValue(header) === normalizedTarget);
}

async function fetchSheetCsv(sheetId, gid) {
  const gidParam = gid ? `&gid=${encodeURIComponent(gid)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.text();
}

const maskEmail = (e) => (e.length <= 4 ? "***" : `${e.slice(0, 2)}***${e.slice(-2)}`);

async function getMeetingInfoLookupDebug(email) {
  const normalizedEmail = (email || "").trim();
  if (!normalizedEmail) return null;

  const sheet1Id = process.env.GOOGLE_LICENSE_SHEET_1_ID;
  const sheet2Id = process.env.GOOGLE_LICENSE_SHEET_2_ID;
  const sheet1Gid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheet2Gid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  if (!sheet1Id || !sheet2Id) {
    throw new Error("Missing GOOGLE_LICENSE_SHEET_1_ID or GOOGLE_LICENSE_SHEET_2_ID in .env");
  }

  async function toSheetDebug(sheetId, gid, emailColumn) {
    const csv = await fetchSheetCsv(sheetId, gid);
    if (!csv) {
      return {
        sheetId,
        gid,
        emailColumn,
        valueColumn: "Meeting Info",
        rowCount: 0,
        found: false,
        emailColumnIndex: -1,
        valueColumnIndex: -1,
        sampleEmailsMasked: [],
      };
    }
    const rows = parseCsv(csv);
    const headers = rows[0] || [];
    const emailIndex = findColumnIndex(headers, emailColumn);
    const valueIndex = findColumnIndex(headers, "Meeting Info");
    let found = false;
    const sampleEmailsMasked = [];
    const lookupMasked = maskEmail(normalizedEmail);
    let mismatchHint;

    if (emailIndex >= 0) {
      for (const row of rows.slice(1, 6)) {
        const cell = (row[emailIndex] || "").trim();
        if (cell) {
          sampleEmailsMasked.push(maskEmail(cell));
          if (normalizeValue(cell) === normalizeValue(normalizedEmail)) found = true;
        }
      }
      if (!found && rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const cell = (rows[i][emailIndex] || "").trim();
          if (!cell) continue;
          const normCell = normalizeValue(cell);
          if (normCell === normalizeValue(normalizedEmail)) {
            found = true;
            break;
          }
          if (maskEmail(cell) === lookupMasked && !mismatchHint) {
            const lenCell = normCell.length;
            const lenLookup = normalizeValue(normalizedEmail).length;
            let diffAt = -1;
            for (let j = 0; j < Math.min(lenCell, lenLookup); j++) {
              if (normCell[j] !== normalizeValue(normalizedEmail)[j]) {
                diffAt = j;
                break;
              }
            }
            if (diffAt === -1 && lenCell !== lenLookup) diffAt = Math.min(lenCell, lenLookup);
            mismatchHint =
              diffAt >= 0
                ? `One row masks to ${lookupMasked} but normalized value differs (lengths: cell=${lenCell}, lookup=${lenLookup}; first diff at index ${diffAt}).`
                : `One row masks to ${lookupMasked} but normalized comparison failed.`;
          }
        }
      }
    }

    return {
      sheetId,
      gid,
      emailColumn,
      valueColumn: "Meeting Info",
      rowCount: rows.length - 1,
      found,
      emailColumnIndex: emailIndex,
      valueColumnIndex: valueIndex,
      sampleEmailsMasked,
      ...(mismatchHint && { mismatchHint }),
    };
  }

  const [sheet1, sheet2] = await Promise.all([
    toSheetDebug(sheet1Id, sheet1Gid, "Email"),
    toSheetDebug(sheet2Id, sheet2Gid, "Email Address"),
  ]);

  return {
    emailUsed: email.trim(),
    emailNormalized: normalizeValue(normalizedEmail),
    sheet1,
    sheet2,
  };
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/test-meeting-lookup.js <email>");
    process.exit(1);
  }

  try {
    const result = await getMeetingInfoLookupDebug(email);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
