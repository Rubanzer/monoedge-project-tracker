import "server-only";

import { ExternalAccountClient, JWT } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import type { AuthClient } from "google-auth-library";

/**
 * Thin wrapper over the Sheets v4 REST API. Deliberately not the `googleapis`
 * package — this needs six calls, and the full client is a very large
 * dependency to drag into a serverless function for that.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Two ways to prove who we are:
 *
 * `federated` — Vercel mints a short-lived OIDC token per deployment and
 *   Google trades it for an access token via Workload Identity Federation.
 *   No key exists to leak or rotate. This is the intended path, and the one
 *   Google's `disableServiceAccountKeyCreation` policy pushes you towards.
 *
 * `key` — a downloaded service account key. Kept only as an escape hatch;
 *   it is a permanent credential that works from anywhere until revoked.
 *
 * Federation wins when both are configured. Locally, `vercel env pull`
 * populates VERCEL_OIDC_TOKEN, so federation works off Vercel too.
 */
export type AuthMode = "federated" | "key";

export interface SheetConfig {
  spreadsheetId: string;
  /** Tab to use. When unset the first tab in the spreadsheet is used. */
  tabName: string | null;
  mode: AuthMode;
  /** The account being impersonated (federated) or signed as (key). */
  clientEmail: string;
  /** Federation only. */
  audience?: string;
  /** Key mode only. */
  privateKey?: string;
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

const env = (name: string) => process.env[name]?.trim() || "";

export function readConfig(): SheetConfig {
  const spreadsheetId = env("GOOGLE_SHEET_ID");
  const clientEmail = env("GCP_SERVICE_ACCOUNT_EMAIL") || env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const tabName = env("GOOGLE_SHEET_TAB") || null;

  if (!spreadsheetId) {
    throw new SheetError(
      "Missing environment variable: GOOGLE_SHEET_ID",
      503,
      "It is the part of the sheet URL between /d/ and /edit.",
    );
  }

  const projectNumber = env("GCP_PROJECT_NUMBER");
  const poolId = env("GCP_WORKLOAD_IDENTITY_POOL_ID");
  const providerId = env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID");
  const federationVars = { projectNumber, poolId, providerId, clientEmail };
  const federationSet = Object.values(federationVars).filter(Boolean).length;

  // Federation first — but a half-configured federation is a mistake worth
  // naming rather than silently falling through to the key path.
  if (federationSet > 0) {
    const missing = Object.entries({
      GCP_PROJECT_NUMBER: projectNumber,
      GCP_WORKLOAD_IDENTITY_POOL_ID: poolId,
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: providerId,
      GCP_SERVICE_ACCOUNT_EMAIL: clientEmail,
    })
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length) {
      throw new SheetError(
        `Workload identity federation is half configured. Missing: ${missing.join(", ")}`,
        503,
        "Set all four, or unset the GCP_ ones to fall back to a service account key.",
      );
    }

    return {
      spreadsheetId,
      tabName,
      mode: "federated",
      clientEmail,
      audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    };
  }

  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new SheetError(
      "No Google credentials configured.",
      503,
      "Set the four GCP_ variables for workload identity federation (no key needed), or GOOGLE_SERVICE_ACCOUNT_EMAIL plus GOOGLE_PRIVATE_KEY to use a key.",
    );
  }

  return {
    spreadsheetId,
    tabName,
    mode: "key",
    clientEmail,
    // Vercel stores the key as a single line with literal \n sequences, and
    // some UIs also wrap it in quotes. Both have to be undone or the PEM
    // parser fails with a very unhelpful error.
    privateKey: rawKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
  };
}

let cached: { key: string; client: AuthClient } | null = null;

function client(config: SheetConfig): AuthClient {
  // Serverless keeps the module warm between invocations, so reuse the
  // client rather than re-authenticating on every request.
  const cacheKey = `${config.mode}:${config.clientEmail}:${config.audience ?? ""}`;
  if (cached?.key === cacheKey) return cached.client;

  let auth: AuthClient | null;
  if (config.mode === "federated") {
    auth = ExternalAccountClient.fromJSON({
      type: "external_account",
      audience: config.audience!,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.clientEmail}:generateAccessToken`,
      scopes: SCOPES,
      subject_token_supplier: {
        // Vercel mints this per invocation; it is short-lived by design.
        getSubjectToken: () => getVercelOidcToken(),
      },
    });
    if (!auth) {
      throw new SheetError(
        "Could not build a federated credential from the GCP_ variables.",
        500,
        "Check GCP_PROJECT_NUMBER, pool id and provider id match the values on the provider page.",
      );
    }
  } else {
    auth = new JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: SCOPES,
    });
  }

  cached = { key: cacheKey, client: auth };
  return auth;
}

/**
 * Google's auth failures all arrive as "invalid_grant" with the useful part
 * buried in the message. Each of these means something different and has a
 * different fix, so they are worth telling apart.
 */
function authHint(detail: string, mode: AuthMode): string {
  const d = detail.toLowerCase();

  if (mode === "federated") {
    if (d.includes("oidc") || d.includes("access token") || d.includes("vercel_oidc_token")) {
      return "No Vercel OIDC token available. On Vercel, enable OIDC Federation under Project Settings → Security. Locally, run `vercel env pull` — the token is short-lived, so pull it again when it expires.";
    }
    if (d.includes("audience")) {
      return "Google rejected the token's audience. In the pool provider, set Allowed audiences to https://vercel.com/<your-team-slug>.";
    }
    if (d.includes("iam.serviceaccounts.getaccesstoken") || d.includes("impersonat")) {
      return "The federated identity may not impersonate that service account. On the service account, grant the principal Workload Identity User — and Service Account Token Creator if it still refuses.";
    }
    if (d.includes("subject token") || d.includes("invalid_request")) {
      return "Google could not match the token's subject. Check google.subject maps to assertion.sub, and that the bound principal is exactly owner:<team>:project:<project>:environment:<environment>.";
    }
    if (d.includes("permission") || d.includes("denied") || d.includes("403")) {
      return "The pool or provider exists but the binding is wrong. Recheck the principal on the service account against the subject shown on the pool page.";
    }
    return "Verify the pool and provider ids, the issuer URL https://oidc.vercel.com/<team-slug>, and that the service account grants the principal Workload Identity User.";
  }

  if (d.includes("account not found")) {
    return "That service account does not exist. Check GOOGLE_SERVICE_ACCOUNT_EMAIL matches client_email in the JSON key, and that the account has not been deleted.";
  }
  if (d.includes("invalid jwt signature")) {
    return "The key does not belong to that service account. Both values must come from the same JSON key file.";
  }
  if (d.includes("token must be a short-lived token") || d.includes("clock")) {
    return "This machine's clock is out of sync with Google. Fix the system time and retry.";
  }
  if (d.includes("decoder") || d.includes("pem") || d.includes("asn1")) {
    return "GOOGLE_PRIVATE_KEY is not a readable PEM. Run: npm run setup:key -- path/to/key.json";
  }
  if (d.includes("api has not been used") || d.includes("disabled")) {
    return "Enable the Google Sheets API for the project that owns this service account.";
  }
  return "Check GOOGLE_PRIVATE_KEY was pasted whole, including the BEGIN and END lines. `npm run setup:key` does this for you.";
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
    const detail = e instanceof Error ? e.message : String(e);
    throw new SheetError(
      `Could not authenticate as ${config.clientEmail}: ${detail}`,
      500,
      authHint(detail, config.mode),
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
