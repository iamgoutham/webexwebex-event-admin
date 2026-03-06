const LICENSE_SHEET_1_ID = process.env.GOOGLE_LICENSE_SHEET_1_ID;
const LICENSE_SHEET_2_ID = process.env.GOOGLE_LICENSE_SHEET_2_ID;

if (!LICENSE_SHEET_1_ID || !LICENSE_SHEET_2_ID) {
  console.error(
    "Missing GOOGLE_LICENSE_SHEET_1_ID or GOOGLE_LICENSE_SHEET_2_ID",
  );
  process.exit(1);
}

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
  const gidParam = gid ? `&gid=${encodeURIComponent(gid)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
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
    const sampleEmails = rows
      .slice(1, 4)
      .map((r) => r[emailIndex]?.trim())
      .filter(Boolean)
      .map((e) => `${e.slice(0, 2)}***${e.slice(-2)}`);
    console.debug("[license-site] no match", {
      sheetId,
      gid,
      email: normalizedEmail,
      rows: rows.length - 1,
      emailColumn,
      valueColumn,
      sampleEmailsFromSheet: sampleEmails,
    });
  }
  return null;
};

const buildHostIdMap = (
  csv: string,
  emailColumn: string,
  valueColumn: string,
) => {
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return new Map<string, string>();
  }
  const headers = rows[0];
  const emailIndex = findColumnIndex(headers, emailColumn);
  const valueIndex = findColumnIndex(headers, valueColumn);
  if (emailIndex === -1 || valueIndex === -1) {
    return new Map<string, string>();
  }

  const map = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const email = row[emailIndex]?.trim();
    const value = row[valueIndex]?.trim();
    if (!email || !value) {
      continue;
    }
    map.set(normalizeValue(email), value);
  }

  return map;
};

export const getLicenseSiteForEmail = async (email: string) => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const fromSheetOne = await lookupSheetValue({
    sheetId: LICENSE_SHEET_1_ID,
    gid: sheetOneGid,
    emailColumn: "Email",
    valueColumn: "License Site",
    email: normalizedEmail,
  });
  if (fromSheetOne) {
    return fromSheetOne;
  }

  const fromSheetTwo = await lookupSheetValue({
    sheetId: LICENSE_SHEET_2_ID,
    gid: sheetTwoGid,
    emailColumn: "Email Address",
    valueColumn: "License Site",
    email: normalizedEmail,
  });

  return fromSheetTwo;
};

export const getMeetingInfoForEmail = async (email: string) => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const fromSheetOne = await lookupSheetValue({
    sheetId: LICENSE_SHEET_1_ID,
    gid: sheetOneGid,
    emailColumn: "Email",
    valueColumn: "Meeting Info",
    email: normalizedEmail,
  });
  if (fromSheetOne) {
    return fromSheetOne;
  }

  const fromSheetTwo = await lookupSheetValue({
    sheetId: LICENSE_SHEET_2_ID,
    gid: sheetTwoGid,
    emailColumn: "Email Address",
    valueColumn: "Meeting Info",
    email: normalizedEmail,
  });

  return fromSheetTwo;
};

const maskEmail = (e: string) =>
  e.length <= 4 ? "***" : `${e.slice(0, 2)}***${e.slice(-2)}`;

/** Debug info for "no meetings" — which email was used and what each sheet returned. */
export type MeetingInfoLookupDebug = {
  emailUsed: string;
  emailNormalized: string;
  sheet1: {
    sheetId: string;
    gid: string | undefined;
    emailColumn: string;
    valueColumn: string;
    rowCount: number;
    found: boolean;
    emailColumnIndex: number;
    valueColumnIndex: number;
    sampleEmailsMasked: string[];
    /** When found=false but a row masks to same pattern, why it didn't match */
    mismatchHint?: string;
  };
  sheet2: {
    sheetId: string;
    gid: string | undefined;
    emailColumn: string;
    valueColumn: string;
    rowCount: number;
    found: boolean;
    emailColumnIndex: number;
    valueColumnIndex: number;
    sampleEmailsMasked: string[];
    mismatchHint?: string;
  };
};

export const getMeetingInfoLookupDebug = async (
  email: string,
): Promise<MeetingInfoLookupDebug | null> => {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) return null;

  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const toSheetDebug = async (
    sheetId: string,
    gid: string | undefined,
    emailColumn: string,
  ): Promise<MeetingInfoLookupDebug["sheet1"]> => {
    const csv = await fetchSheetCsv(sheetId, gid);
    const rowCount = csv ? parseCsv(csv).length - 1 : 0;
    if (!csv || rowCount < 0) {
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
    const headers = rows[0];
    const emailIndex = findColumnIndex(headers, emailColumn);
    const valueIndex = findColumnIndex(headers, "Meeting Info");
    let found = false;
    const sampleEmailsMasked: string[] = [];
    const lookupMasked = maskEmail(normalizedEmail);
    let mismatchHint: string | undefined;
    if (emailIndex >= 0) {
      for (const row of rows.slice(1, 6)) {
        const cell = row[emailIndex]?.trim();
        if (cell) {
          const masked = maskEmail(cell);
          sampleEmailsMasked.push(masked);
          if (normalizeValue(cell) === normalizeValue(normalizedEmail)) found = true;
        }
      }
      if (!found && rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const cell = rows[i][emailIndex]?.trim();
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
  };

  const [sheet1, sheet2] = await Promise.all([
    toSheetDebug(LICENSE_SHEET_1_ID, sheetOneGid, "Email"),
    toSheetDebug(LICENSE_SHEET_2_ID, sheetTwoGid, "Email Address"),
  ]);

  return {
    emailUsed: email.trim(),
    emailNormalized: normalizeValue(normalizedEmail),
    sheet1,
    sheet2,
  };
};

export const getHostIdForEmail = async (email: string) => {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const fromSheetOne = await lookupSheetValue({
    sheetId: LICENSE_SHEET_1_ID,
    gid: sheetOneGid,
    emailColumn: "Email",
    valueColumn: "SHORTID",
    email: normalizedEmail,
  });
  if (fromSheetOne) {
    return fromSheetOne;
  }

  const fromSheetTwo = await lookupSheetValue({
    sheetId: LICENSE_SHEET_2_ID,
    gid: sheetTwoGid,
    emailColumn: "Email Address",
    valueColumn: "SHORTID",
    email: normalizedEmail,
  });

  return fromSheetTwo;
};

export const getHostIdMapForEmails = async (emails: string[]) => {
  const normalizedEmails = emails
    .map((email) => normalizeValue(email))
    .filter(Boolean);
  const emailSet = new Set(normalizedEmails);
  if (emailSet.size === 0) {
    return new Map<string, string>();
  }

  const sheetOneGid = process.env.GOOGLE_LICENSE_SHEET_1_GID;
  const sheetTwoGid = process.env.GOOGLE_LICENSE_SHEET_2_GID;

  const [sheetOneCsv, sheetTwoCsv] = await Promise.all([
    fetchSheetCsv(LICENSE_SHEET_1_ID, sheetOneGid),
    fetchSheetCsv(LICENSE_SHEET_2_ID, sheetTwoGid),
  ]);

  const map = new Map<string, string>();

  if (sheetOneCsv) {
    const sheetOneMap = buildHostIdMap(sheetOneCsv, "Email", "SHORTID");
    for (const email of emailSet) {
      const value = sheetOneMap.get(email);
      if (value) {
        map.set(email, value);
      }
    }
  }

  if (sheetTwoCsv) {
    const sheetTwoMap = buildHostIdMap(
      sheetTwoCsv,
      "Email Address",
      "SHORTID",
    );
    for (const email of emailSet) {
      if (!map.has(email)) {
        const value = sheetTwoMap.get(email);
        if (value) {
          map.set(email, value);
        }
      }
    }
  }

  return map;
};
