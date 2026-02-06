import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-guards";

const GRID_SHEET_ID = process.env.GOOGLE_GRID_SHEET_ID;

if (!GRID_SHEET_ID) {
  console.error("Missing GOOGLE_GRID_SHEET_ID");
  process.exit(1);
}

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_]+/g, "");

const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
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
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
};

const findColumnIndex = (headers: string[], candidates: string[]) => {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(header)),
  );
};

const fetchSheetCsv = async (sheetId: string) => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return response.text();
};

const parseGridValue = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 5 || parsed > 9) {
    return null;
  }
  return parsed;
};

export async function POST() {
  const { session, response } = await requireApiAuth([
    Role.ADMIN,
    Role.SUPERADMIN,
  ]);
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csv = await fetchSheetCsv(GRID_SHEET_ID);
  if (!csv) {
    return NextResponse.json(
      { error: "Unable to fetch grid size sheet." },
      { status: 500 },
    );
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Grid size sheet has no data." },
      { status: 400 },
    );
  }

  const headers = rows[0];
  const emailIndex = findColumnIndex(headers, ["Email", "Email Address"]);
  const rowsIndex = findColumnIndex(headers, [
    "Grid Rows",
    "Rows",
    "GridRows",
  ]);
  const colsIndex = findColumnIndex(headers, [
    "Grid Columns",
    "Columns",
    "GridCols",
  ]);

  if (emailIndex === -1 || rowsIndex === -1 || colsIndex === -1) {
    return NextResponse.json(
      { error: "Required columns are missing in the sheet." },
      { status: 400 },
    );
  }

  let processed = 0;
  let updated = 0;
  let skippedInvalid = 0;
  let skippedNotFound = 0;
  let skippedUnauthorized = 0;

  const tenantFilter =
    session.user.role === Role.ADMIN ? session.user.tenantId : null;

  for (const row of rows.slice(1)) {
    const email = row[emailIndex]?.trim().toLowerCase();
    const rowsValue = row[rowsIndex];
    const colsValue = row[colsIndex];
    if (!email) {
      skippedInvalid += 1;
      continue;
    }
    const gridRows = rowsValue ? parseGridValue(rowsValue) : null;
    const gridCols = colsValue ? parseGridValue(colsValue) : null;
    if (!gridRows || !gridCols) {
      skippedInvalid += 1;
      continue;
    }

    processed += 1;

    if (tenantFilter) {
      const result = await prisma.user.updateMany({
        where: { email, tenantId: tenantFilter },
        data: { gridRows, gridCols },
      });
      if (result.count === 0) {
        skippedUnauthorized += 1;
      } else {
        updated += result.count;
      }
    } else {
      const result = await prisma.user.updateMany({
        where: { email },
        data: { gridRows, gridCols },
      });
      if (result.count === 0) {
        skippedNotFound += 1;
      } else {
        updated += result.count;
      }
    }
  }

  return NextResponse.json({
    message: "Grid sizes imported successfully.",
    result: {
      processed,
      updated,
      skippedInvalid,
      skippedNotFound,
      skippedUnauthorized,
    },
  });
}
