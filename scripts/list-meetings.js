#!/usr/bin/env node
/**
 * List meetings for a given email (from license sheet "Meeting Info" column).
 *
 * Usage (from project root):
 *   node scripts/list-meetings.js <email>
 *
 * Requires .env with:
 *   GOOGLE_LICENSE_SHEET_1_ID
 *   GOOGLE_LICENSE_SHEET_2_ID
 *   GOOGLE_LICENSE_SHEET_1_GID (optional)
 *   GOOGLE_LICENSE_SHEET_2_GID (optional)
 */

const fs = require("fs");
const path = require("path");

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

async function lookupSheetValue(sheetId, gid, emailColumn, valueColumn, email) {
  const csv = await fetchSheetCsv(sheetId, gid);
  if (!csv) return null;
  const rows = parseCsv(csv);
  if (rows.length < 2) return null;

  const headers = rows[0];
  const emailIndex = findColumnIndex(headers, emailColumn);
  const valueIndex = findColumnIndex(headers, valueColumn);
  if (emailIndex === -1 || valueIndex === -1) return null;

  const normalizedEmail = normalizeValue(email);
  for (const row of rows.slice(1)) {
    const candidate = (row[emailIndex] || "").trim();
    if (candidate && normalizeValue(candidate) === normalizedEmail) {
      const value = (row[valueIndex] || "").trim();
      return value || null;
    }
  }
  return null;
}

async function getMeetingInfoForEmail(email) {
  const normalizedEmail = (email || "").trim();
  if (!normalizedEmail) return null;

  const sheet1Id = process.env.GOOGLE_LICENSE_SHEET_1_ID;
  const sheet2Id = process.env.GOOGLE_LICENSE_SHEET_2_ID;
  const sheet1Gid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheet2Gid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  if (!sheet1Id || !sheet2Id) {
    throw new Error("Missing GOOGLE_LICENSE_SHEET_1_ID or GOOGLE_LICENSE_SHEET_2_ID in .env");
  }

  const fromSheet1 = await lookupSheetValue(
    sheet1Id,
    sheet1Gid,
    "Email",
    "Meeting Info",
    normalizedEmail
  );
  if (fromSheet1) return fromSheet1;

  const fromSheet2 = await lookupSheetValue(
    sheet2Id,
    sheet2Gid,
    "Email Address",
    "Meeting Info",
    normalizedEmail
  );
  return fromSheet2;
}

function parseMeetingInfoJson(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return null;
  try {
    const data = JSON.parse(trimmed);
    const list = data?.meetings;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list;
  } catch {
    return null;
  }
}

function formatDateTime(value) {
  if (!value) return "TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/list-meetings.js <email>");
    process.exit(1);
  }

  try {
    const meetingInfoRaw = await getMeetingInfoForEmail(email);
    if (!meetingInfoRaw?.trim()) {
      console.log(`No meeting info found for: ${email}`);
      process.exit(0);
    }

    const meetings = parseMeetingInfoJson(meetingInfoRaw);
    if (!meetings) {
      console.log("Meeting Info (raw, not JSON meetings array):");
      console.log(meetingInfoRaw.slice(0, 500) + (meetingInfoRaw.length > 500 ? "..." : ""));
      process.exit(0);
    }

    console.log(`Meetings for ${email} (${meetings.length} meeting(s)):\n`);
    meetings.forEach((m, i) => {
      console.log(`--- Meeting ${i + 1} ---`);
      console.log(`  Title:    ${m.title ?? "(none)"}`);
      console.log(`  Start:    ${formatDateTime(m.start)}`);
      console.log(`  End:      ${formatDateTime(m.end)}`);
      console.log(`  State:    ${m.state ?? "—"}`);
      console.log(`  Number:   ${m.meetingNumber ?? "—"}`);
      console.log(`  Link:     ${m.webLink ?? "—"}`);
      if (Array.isArray(m.invitees) && m.invitees.length > 0) {
        console.log(`  Invitees: ${m.invitees.length}`);
      }
      console.log("");
    });
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
