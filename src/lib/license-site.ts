const DEFAULT_SHEET_ONE_ID = "1cOfMqutwpFyFayADYHUw20kl7Mi5R1NqXa8bhbV6xrI";
const DEFAULT_SHEET_TWO_ID = "1BRD62ucextyICTq7BKGgn01ZtzmKwTSAF94Tl4xulUY";

const normalizeValue = (value: string) => value.trim().toLowerCase();

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

const findColumnIndex = (headers: string[], target: string) => {
  const normalizedTarget = normalizeValue(target);
  return headers.findIndex(
    (header) => normalizeValue(header) === normalizedTarget,
  );
};

const fetchSheetCsv = async (sheetId: string, gid?: string) => {
  const params = new URLSearchParams({ tqx: "out:csv" });
  if (gid) {
    params.set("gid", gid);
  }
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
      console.debug(
        "[license-site] sheet fetch failed",
        sheetId,
        response.status,
      );
    }
    return null;
  }
  const csv = await response.text();
  if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
    console.debug("[license-site] sheet csv fetched", sheetId, {
      length: csv.length,
    });
  }
  return csv;
};

const lookupSheetValue = async ({
  sheetId,
  gid,
  emailColumn,
  valueColumn,
  email,
}: {
  sheetId: string;
  gid?: string;
  emailColumn: string;
  valueColumn: string;
  email: string;
}) => {
  const csv = await fetchSheetCsv(sheetId, gid);
  if (!csv) {
    return null;
  }
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
      console.debug("[license-site] no data rows", { sheetId, gid });
    }
    return null;
  }
  const headers = rows[0];
  const emailIndex = findColumnIndex(headers, emailColumn);
  const valueIndex = findColumnIndex(headers, valueColumn);
  if (emailIndex === -1 || valueIndex === -1) {
    if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
      console.debug("[license-site] missing columns", {
        sheetId,
        gid,
        emailColumn,
        valueColumn,
        headers,
      });
    }
    return null;
  }

  const normalizedEmail = normalizeValue(email);
  for (const row of rows.slice(1)) {
    const candidate = row[emailIndex];
    if (candidate && normalizeValue(candidate) === normalizedEmail) {
      const value = row[valueIndex]?.trim();
      if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
        console.debug("[license-site] match found", {
          sheetId,
          gid,
          email: normalizedEmail,
          value,
        });
      }
      return value || null;
    }
  }

  if (process.env.GOOGLE_SHEETS_DEBUG === "true") {
    console.debug("[license-site] no match", {
      sheetId,
      gid,
      email: normalizedEmail,
      rows: rows.length - 1,
    });
  }
  return null;
};

export const getLicenseSiteForEmail = async (email: string) => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  const sheetOneId =
    process.env.GOOGLE_LICENSE_SHEET_1_ID ?? DEFAULT_SHEET_ONE_ID;
  const sheetTwoId =
    process.env.GOOGLE_LICENSE_SHEET_2_ID ?? DEFAULT_SHEET_TWO_ID;
  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const fromSheetOne = await lookupSheetValue({
    sheetId: sheetOneId,
    gid: sheetOneGid,
    emailColumn: "Email",
    valueColumn: "License Site",
    email: normalizedEmail,
  });
  if (fromSheetOne) {
    return fromSheetOne;
  }

  const fromSheetTwo = await lookupSheetValue({
    sheetId: sheetTwoId,
    gid: sheetTwoGid,
    emailColumn: "Email Address",
    valueColumn: "License Site",
    email: normalizedEmail,
  });

  return fromSheetTwo;
};
