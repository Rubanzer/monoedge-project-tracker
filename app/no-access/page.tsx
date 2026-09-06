import Link from "next/link";
import { ALLOWED_DOMAIN } from "@/auth";
import { Mark } from "@/components/shared/mark";
import { Button } from "@/components/ui/button";

/**
 * Where a refused sign-in lands. Someone who has just been turned away is
 * owed the actual reason — "access denied" sends them to ask a colleague
 * what they did wrong, which costs two people's time to answer a question
 * the page already knows the answer to.
 */

export const metadata = { title: "No access · MonoEdge Tracker" };

type Reason = "domain" | "unverified" | "revoked";

const REASONS: Record<Reason, { title: string; body: string }> = {
  domain: {
    title: "That is not a MonoEdge account",
    body: `The tracker only accepts Google Workspace accounts on @${ALLOWED_DOMAIN}. A personal Google account is refused even when it carries an @${ALLOWED_DOMAIN} address, because only Workspace accounts prove they were issued by MonoEdge.`,
  },
  unverified: {
    title: "That address is not verified",
    body: "Google has not verified the email address on that account, so we cannot treat it as proof of who you are. Verify it with Google and try again.",
  },
  revoked: {
    title: "Your access has been turned off",
    body: "Your account is on the team list but marked inactive, so the tracker is closed to you. An admin can switch it back on.",
  },
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy =
    REASONS[(reason ?? "") as Reason] ?? REASONS.domain;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex items-center gap-2.5">
          <Mark className="h-6 w-auto text-foreground" idSuffix="noaccess" />
          <div className="flex items-baseline gap-2">
            <span className="display-mark text-[15px] leading-none">
              MonoEdge
            </span>
            <span className="label-mono text-muted-foreground">Tracker</span>
          </div>
        </div>

        <h1 className="text-[19px] leading-snug font-medium tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {copy.body}
        </p>

        <Button asChild variant="outline" className="mt-7 h-10 w-full text-[13px]">
          <Link href="/sign-in">Try a different account</Link>
        </Button>
      </div>
    </main>
  );
}
