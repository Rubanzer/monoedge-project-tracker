import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Next 16 renamed Middleware to Proxy. The rename is not cosmetic here: a
 * leftover middleware.ts is silently ignored, so an auth gate written under
 * the old name would simply never run.
 *
 * This is an optimistic check and nothing more — it reads the session cookie
 * to bounce signed-out browsers to the sign-in page, which is a redirect
 * concern, not a security one. Nothing is authorised here. The real checks
 * live in lib/server/session.ts, next to the data.
 *
 * API routes are deliberately outside the matcher: a fetch that expects JSON
 * should get a 401 it can render, not an HTML login page. They enforce their
 * own access, which is where it belongs anyway.
 */

const PUBLIC_PATHS = ["/sign-in", "/no-access"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const url = new URL("/sign-in", req.nextUrl);
    // So a deep link survives the round trip through Google.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|fonts).*)",
  ],
};
