import { handlers } from "@/auth";

// The OAuth callback needs node:crypto to verify Google's ID token.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
