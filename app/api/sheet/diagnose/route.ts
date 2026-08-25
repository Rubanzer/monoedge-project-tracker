import { getVercelOidcToken } from "@vercel/oidc";
import { getTab, readConfig, readRange, SheetError } from "@/lib/server/sheets";
import { loadItems } from "@/lib/server/sheet-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Check {
  step: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

/**
 * Reads sub and aud out of the OIDC token without verifying it — this is for
 * showing you what Google will be matching against, not for trusting it.
 * The token itself is never returned.
 */
function decodeClaims(jwt: string): { sub?: string; aud?: string } | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { sub?: string; aud?: string | string[] };
    return {
      sub: claims.sub,
      aud: Array.isArray(claims.aud) ? claims.aud.join(", ") : claims.aud,
    };
  } catch {
    return null;
  }
}

/**
 * Walks the connection one step at a time and reports where it stops.
 * "It doesn't work" is a bad bug report; this turns it into a specific one.
 * Deliberately reveals no cell contents and no part of the private key.
 */
export async function GET() {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // 1 — environment
  let config;
  try {
    config = readConfig();
    add({
      step: "Environment variables",
      ok: true,
      detail: `Sheet ${config.spreadsheetId.slice(0, 8)}…`,
    });
  } catch (e) {
    const err = e as SheetError;
    add({
      step: "Environment variables",
      ok: false,
      detail: err.message,
      hint: err.hint,
    });
    return Response.json({ ok: false, checks }, { status: 503 });
  }

  if (config.mode === "federated") {
    add({
      step: "Auth mode",
      ok: true,
      detail: `Workload identity federation, impersonating ${config.clientEmail}. No key involved.`,
    });

    // Checked on its own: "no OIDC token" and "Google rejected the token"
    // are different failures with different fixes, and collapsing them into
    // one error is what makes this setup hard to debug.
    try {
      const oidc = await getVercelOidcToken();
      const claims = decodeClaims(oidc);
      add({
        step: "Vercel OIDC token",
        ok: true,
        detail: claims
          ? `sub: ${claims.sub ?? "?"} · aud: ${claims.aud ?? "?"}`
          : "Present",
        hint: claims?.sub
          ? `The service account must grant Workload Identity User to a principal ending in /subject/${claims.sub}`
          : undefined,
      });
    } catch (e) {
      add({
        step: "Vercel OIDC token",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
        hint: "On Vercel: Project Settings → Security → enable OIDC Federation, then redeploy. Locally: run `vercel env pull` (the token is short-lived, so re-pull when it expires).",
      });
      return Response.json({ ok: false, checks }, { status: 503 });
    }
  } else {
    const key = config.privateKey ?? "";
    const keyLooksRight =
      key.includes("BEGIN PRIVATE KEY") && key.includes("\n");
    add({
      step: "Auth mode",
      ok: true,
      detail: `Service account key, signing as ${config.clientEmail}`,
      hint: "A downloaded key is a permanent credential. Federation (the GCP_ variables) avoids it entirely.",
    });
    add({
      step: "Private key format",
      ok: keyLooksRight,
      detail: keyLooksRight
        ? "Looks like a PEM block with real newlines"
        : "Does not look like a PEM block",
      hint: keyLooksRight
        ? undefined
        : "Run: npm run setup:key -- path/to/key.json",
    });
  }

  // 2 — can we reach the spreadsheet at all
  let tab;
  try {
    tab = await getTab(config);
    add({
      step: "Spreadsheet access",
      ok: true,
      detail: `Reading tab "${tab.title}" (${tab.rowCount} rows allocated)`,
    });
  } catch (e) {
    const err = e as SheetError;
    add({
      step: "Spreadsheet access",
      ok: false,
      detail: err.message,
      hint: err.hint,
    });
    return Response.json({ ok: false, checks }, { status: err.status ?? 500 });
  }

  // 3 — headers
  try {
    const header = (await readRange(config, tab.title, "A1:N1"))[0] ?? [];
    const labels = header.map((h) => String(h ?? "").trim());
    const managed = ["Item ID", "Board Order", "Assignee Key", "Updated At"];
    const present = managed.filter((m) => labels.includes(m));
    add({
      step: "Managed columns (K–N)",
      ok: present.length === managed.length,
      detail:
        present.length === managed.length
          ? "All four present"
          : `Missing: ${managed.filter((m) => !present.includes(m)).join(", ")}`,
      hint:
        present.length === managed.length
          ? undefined
          : "These are added automatically on the first successful load. Reload the board once.",
    });
  } catch (e) {
    add({
      step: "Managed columns (K–N)",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 4 — can we actually write
  try {
    const { items, warnings } = await loadItems();
    add({
      step: "Read and map rows",
      ok: true,
      detail: `${items.length} work ${items.length === 1 ? "item" : "items"} imported`,
    });
    add({
      step: "Row warnings",
      ok: warnings.length === 0,
      detail: warnings.length ? warnings.slice(0, 12).join(" · ") : "None",
      hint: warnings.length
        ? "Unrecognised values were defaulted. Fix the cell or add an alias in lib/server/sheet-store.ts."
        : undefined,
    });
  } catch (e) {
    const err = e as SheetError;
    add({
      step: "Read and map rows",
      ok: false,
      detail: err.message,
      hint: err.hint,
    });
  }

  const ok = checks.every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 500 });
}
