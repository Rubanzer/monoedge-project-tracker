import { redirect } from "next/navigation";
import { auth, signIn, ALLOWED_DOMAIN } from "@/auth";
import { Mark } from "@/components/shared/mark";
import { Button } from "@/components/ui/button";

/**
 * One button. Google is the only way in, so a provider list, an email field
 * and a "forgot password" link would all be furniture for doors that do not
 * exist.
 */

export const metadata = { title: "Sign in · MonoEdge Tracker" };

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Already in — no reason to show a door that is standing open.
  if (await auth()) redirect(next ?? "/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex items-center gap-2.5">
          <Mark className="h-6 w-auto text-foreground" idSuffix="signin" />
          <div className="flex items-baseline gap-2">
            <span className="display-mark text-[15px] leading-none">
              MonoEdge
            </span>
            <span className="label-mono text-muted-foreground">Tracker</span>
          </div>
        </div>

        <h1 className="text-[19px] leading-snug font-medium tracking-tight text-foreground">
          Sign in to the tracker
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Use your <span className="text-foreground">@{ALLOWED_DOMAIN}</span>{" "}
          Google account. Everyone at MonoEdge has access — there is no
          separate invite to wait for.
        </p>

        {error && (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-destructive">
            That sign-in did not complete. Try again, and if it keeps failing
            check that you picked your work account rather than a personal one.
          </p>
        )}

        <form
          className="mt-7"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: next ?? "/" });
          }}
        >
          <Button type="submit" className="h-10 w-full gap-2.5 text-[13px]">
            <GoogleGlyph />
            Continue with Google
          </Button>
        </form>

        <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
          Personal Google accounts are refused, even ones carrying an
          @{ALLOWED_DOMAIN} address.
        </p>
      </div>
    </main>
  );
}
