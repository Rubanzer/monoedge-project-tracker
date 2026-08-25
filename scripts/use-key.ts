/**
 * Turns a downloaded service-account JSON key into the two environment
 * variables the app needs, written into .env.local correctly escaped.
 *
 *   npm run setup:key -- "C:/Users/you/Downloads/project-abc123.json"
 *
 * A PEM block pasted into a .env file by hand is the single most common way
 * this setup fails: real newlines break dotenv parsing, and quoting rules
 * differ between editors and the Vercel dashboard. This writes the one form
 * that works everywhere — a single line with \n escapes.
 *
 * The private key is never printed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env.local");

function die(message: string, hint?: string): never {
  console.error(`\n  ✗ ${message}`);
  if (hint) console.error(`    ${hint}`);
  console.error("");
  process.exit(1);
}

const keyPath = process.argv[2];
if (!keyPath) {
  die(
    "No path to the key file.",
    'Usage: npm run setup:key -- "C:/path/to/service-account.json"',
  );
}

const resolved = resolve(keyPath.replace(/^["']|["']$/g, ""));
if (!existsSync(resolved)) die(`No file at ${resolved}`);

let key: { client_email?: string; private_key?: string; type?: string };
try {
  key = JSON.parse(readFileSync(resolved, "utf8"));
} catch {
  die(
    "That file is not valid JSON.",
    "Use the JSON key downloaded from the service account, not the p12 file.",
  );
}

if (key.type !== "service_account") {
  die(
    `Expected a service account key, got type "${key.type ?? "unknown"}".`,
    "Service Accounts → your account → Keys → Add key → Create new key → JSON.",
  );
}
if (!key.client_email || !key.private_key) {
  die("That key file has no client_email / private_key.");
}
if (!key.private_key.includes("BEGIN PRIVATE KEY")) {
  die("private_key does not look like a PEM block.");
}

// One line, \n escaped, wrapped in double quotes: parses identically in
// dotenv, in the Vercel dashboard, and in a shell.
const oneLine = `"${key.private_key.replace(/\r?\n/g, "\\n")}"`;

const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
const upsert = (body: string, name: string, value: string) => {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  return re.test(body) ? body.replace(re, line) : `${body.trimEnd()}\n${line}\n`;
};

let next = existing;
next = upsert(next, "GOOGLE_SERVICE_ACCOUNT_EMAIL", key.client_email);
next = upsert(next, "GOOGLE_PRIVATE_KEY", oneLine);
writeFileSync(ENV_PATH, next, "utf8");

const missing = ["NEXT_PUBLIC_TRACKER_BACKEND", "GOOGLE_SHEET_ID"].filter(
  (n) => !new RegExp(`^${n}=.+$`, "m").test(next),
);

console.log(`
  ✓ Wrote GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY to .env.local
    (.env.local is gitignored. The key was not printed.)

  Next:

  1. Share the sheet with this address, as Editor:

       ${key.client_email}

  2. npm run dev
  3. Open http://localhost:3200/api/sheet/diagnose
${
  missing.length
    ? `\n  ⚠ Still unset in .env.local: ${missing.join(", ")}\n`
    : ""
}
  For Vercel, copy the values straight out of .env.local — they are already
  in the form its dashboard expects.
`);
