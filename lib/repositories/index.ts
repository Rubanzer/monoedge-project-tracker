import type { TrackerRepository } from "../repository";
import { localRepository } from "./local";

/**
 * Swap this for the Sheets-backed adapter when the backend lands:
 *
 *   import { sheetsRepository } from "./sheets";
 *   export const repository: TrackerRepository = sheetsRepository;
 */
export const repository: TrackerRepository = localRepository;
