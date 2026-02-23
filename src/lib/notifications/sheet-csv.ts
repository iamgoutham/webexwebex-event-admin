/** Timeout for Google Sheets fetch (2 minutes per sheet). */
export const SHEET_FETCH_TIMEOUT_MS = 2 * 60 * 1000;

/** Normalize for column matching: trim, lowercase, collapse spaces/underscores, unify apostrophes. */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'"); // curly/smart apostrophes → straight
}

export function parseCsv(csv: string): string[][] {
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

export function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(header)),
  );
}

export async function fetchSheetCsv(
  sheetId: string,
  gid?: string,
): Promise<string | null> {
  const gidParam = gid ? `&gid=${encodeURIComponent(gid)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHEET_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Format headers for error messages (list available columns). */
export function formatAvailableColumns(headers: string[]): string {
  return headers
    .map((h, i) => (h?.trim() ? `"${String(h).replace(/"/g, '\\"')}"` : `(empty ${i})`))
    .join(", ");
}
