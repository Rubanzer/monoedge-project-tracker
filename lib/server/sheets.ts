import "server-only";

import { JWT } from "google-auth-library";

/**
 * Thin wrapper over the Sheets v4 REST API. Deliberately not the `googleapis`
 * package — this needs six calls, and the full client is a very large
 * dependency to drag into a serverless function for that.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SheetConfig {
  spreadsheetId: string;
  /** Tab to use. When unset the first tab in the spreadsheet is used. */
  tabName: string | null;
  clientEmail: string;
  privateKey: string;
}

export class SheetError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    /** Something the reader can actually do about it. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = "SheetError";
  }
}

export function readConfig(): SheetConfig {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  const missing = [
    !spreadsheetId && "GOOGLE_SHEET_ID",
    !clientEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    !rawKey && "GOOGLE_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new SheetError(
      `Missing environment ${missing.length > 1 ? "variables" : "variable"}: ${missing.join(", ")}`,
      503,
      "Set these in Vercel under Settings → Environment Variables, then redeploy.",
    );
  }

  return {
    spreadsheetId: spreadsheetId!,
    tabName: process.env.GOOGLE_SHEET_TAB?.trim() || null,
    clientEmail: clientEmail!,
    // Vercel stores the key as a single line with literal \n sequences, and
    // some UIs also wrap it in quotes. Both have to be undone or the PEM
    // parser fails with a very unhelpful error.
    privateKey: rawKey!.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
  };
}

let cached: { key: string; jwt: JWT } | null = null;

function client(config: SheetConfig): JWT {
  // Serverless keeps the module warm between invocations, so reuse the
  // signed token rather than re-authenticating on every request.
  if (cached?.key === config.clientEmail) return cached.jwt;
  const jwt = new JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: SCOPES,
  });
  cached = { key: config.clientEmail, jwt };
  return jwt;
}

async function call<T>(
  config: SheetConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let token: string | null | undefined;
  try {
    const res = await client(config).getAccessToken();
    token = res.token;
  } catch (e) {
    throw new SheetError(
      `Could not authenticate as ${config.clientEmail}: ${e instanceof Error ? e.message : e}`,
      500,
      "Check GOOGLE_PRIVATE_KEY was pasted whole, including the BEGIN and END lines.",
    );
  }

  const res = await fetch(`${API}/${config.spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new SheetError(
        "Google refused access to the spreadsheet.",
        403,
        `Share the sheet with ${config.clientEmail} and give it Editor access.`,
      );
    }
    if (res.status === 404) {
      throw new SheetError(
        "No spreadsheet with that ID.",
        404,
        "GOOGLE_SHEET_ID is the part of the sheet URL between /d/ and /edit.",
      );
    }
    if (res.status === 429) {
      throw new SheetError(
        "Hit Google's rate limit.",
        429,
        "Sheets allows about 60 requests a minute per service account. Give it a moment.",
      );
    }
    throw new SheetError(`Sheets API ${res.status}: ${body.slice(0, 300)}`, 502);
  }

  return res.json() as Promise<T>;
}

interface SheetMeta {
  sheetId: number;
  title: string;
  rowCount: number;
}

export async function getTab(config: SheetConfig): Promise<SheetMeta> {
  const data = await call<{
    sheets: {
      properties: {
        sheetId: number;
        title: string;
        gridProperties: { rowCount: number };
      };
    }[];
  }>(config, "?fields=sheets.properties");

  const tabs = data.sheets ?? [];
  if (!tabs.length) throw new SheetError("The spreadsheet has no tabs.", 500);

  const match = config.tabName
    ? tabs.find((s) => s.properties.title === config.tabName)
    : tabs[0];

  if (!match) {
    throw new SheetError(
      `No tab named "${config.tabName}".`,
      404,
      `Tabs in this spreadsheet: ${tabs.map((s) => s.properties.title).join(", ")}`,
    );
  }

  return {
    sheetId: match.properties.sheetId,
    title: match.properties.title,
    rowCount: match.properties.gridProperties?.rowCount ?? 0,
  };
}

/** Tab titles can contain spaces and quotes, both of which break A1 notation. */
const quoteTab = (title: string) => `'${title.replace(/'/g, "''")}'`;

export async function readRange(
  config: SheetConfig,
  tab: string,
  a1: string,
): Promise<unknown[][]> {
  const range = encodeURIComponent(`${quoteTab(tab)}!${a1}`);
  const data = await call<{ values?: unknown[][] }>(
    config,
    // Serial numbers rather than formatted text: "6-Aug" has no year in it,
    // so the formatted value cannot be turned back into a real date.
    `/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
  );
  return data.values ?? [];
}

export async function writeRanges(
  config: SheetConfig,
  tab: string,
  updates: { a1: string; values: unknown[][] }[],
): Promise<void> {
  if (!updates.length) return;
  await call(config, "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      // USER_ENTERED so an ISO date lands as a real date cell and picks up
      // whatever format the column already uses.
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: `${quoteTab(tab)}!${u.a1}`,
        values: u.values,
      })),
    }),
  });
}

export async function appendRow(
  config: SheetConfig,
  tab: string,
  lastColumn: string,
  values: unknown[],
): Promise<void> {
  const range = encodeURIComponent(`${quoteTab(tab)}!A:${lastColumn}`);
  await call(
    config,
    `/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) },
  );
}

export async function deleteRow(
  config: SheetConfig,
  sheetId: number,
  rowNumber: number,
): Promise<void> {
  await call(config, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1, // API is 0-based, row numbers are 1-based
              endIndex: rowNumber,
            },
          },
        },
      ],
    }),
  });
}
