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
      detail: `Sheet ${config.spreadsheetId.slice(0, 8)}…, service account ${config.clientEmail}`,
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

  const keyLooksRight =
    config.privateKey.includes("BEGIN PRIVATE KEY") &&
    config.privateKey.includes("\n");
  add({
    step: "Private key format",
    ok: keyLooksRight,
    detail: keyLooksRight
      ? "Looks like a PEM block with real newlines"
      : "Does not look like a PEM block",
    hint: keyLooksRight
      ? undefined
      : "Paste the whole private_key value from the JSON key file, including the BEGIN and END lines.",
  });

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
