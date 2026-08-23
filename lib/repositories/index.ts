import type { TrackerRepository } from "../repository";
import { localRepository } from "./local";
import { remoteRepository } from "./remote";

/**
 * Which backend the app talks to. Set NEXT_PUBLIC_TRACKER_BACKEND=sheets in
 * Vercel once the Google credentials are in place; anything else keeps the
 * browser-local draft, so a checkout with no credentials still runs.
 */
export const repository: TrackerRepository =
  process.env.NEXT_PUBLIC_TRACKER_BACKEND === "sheets"
    ? remoteRepository
    : localRepository;
