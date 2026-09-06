import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { GoogleProfile } from "next-auth/providers/google";

/**
 * Sign-in. Google is the only connection, and only Google Workspace accounts
 * on our own domain get through.
 *
 * The security model is deliberately simple: nobody outside MonoEdge can be
 * issued an @monoedge.in address, because only a Workspace admin can create
 * one. So domain membership *is* the guest list, administered in the place
 * it should be. There is no second allowlist to keep in step, and offboarding
 * happens the moment IT suspends the Google account.
 *
 * That only holds while all of the following are true, and each one is load
 * bearing:
 *
 *   1. Google is the ONLY provider. Enable email/password alongside it and
 *      anyone can register an @monoedge.in address they do not own, which
 *      defeats the entire scheme. Do not add providers here casually.
 *   2. The address is verified (`email_verified`).
 *   3. The account carries the `hd` claim for our domain. This is the check
 *      that matters: a *personal* Google account can hold a custom-domain
 *      address, but only a real Workspace account is issued `hd`. Matching
 *      on the email suffix alone would accept the impostor.
 *
 * Whether the person is still *allowed* in — the Active flag, and their role
 * — is a separate question answered against the Team tab in
 * lib/server/session.ts. Keeping that out of here means a Sheets outage
 * cannot stop people signing in; they get a legible error on the board
 * instead of a login loop.
 */

export const ALLOWED_DOMAIN =
  process.env.AUTH_ALLOWED_DOMAIN?.trim().toLowerCase() || "monoedge.in";

/** Twelve hours: long enough for a working day, short enough that a
 *  forgotten laptop is not a standing door. */
const SESSION_MAX_AGE = 12 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Narrows Google's account chooser to our domain. A convenience
          // only — it travels in the URL and can be edited, so it is worth
          // nothing as a control. The signIn callback below is the check.
          hd: ALLOWED_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },

  pages: { signIn: "/sign-in", error: "/sign-in" },

  // Vercel is detected automatically; this covers running anywhere else.
  trustHost: true,

  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "google") return false;

      const google = profile as GoogleProfile | undefined;
      if (!google?.email_verified) return "/no-access?reason=unverified";

      const hd = (google.hd ?? "").trim().toLowerCase();
      if (hd !== ALLOWED_DOMAIN) return "/no-access?reason=domain";

      return true;
    },

    jwt({ token, profile }) {
      // Carried so the session has an address to resolve against the Team
      // tab without re-reading the provider profile on every request.
      if (profile?.email) token.email = profile.email;
      return token;
    },

    session({ session, token }) {
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});
