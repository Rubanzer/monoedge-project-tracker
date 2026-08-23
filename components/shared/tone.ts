import type { CSSProperties } from "react";

/** Hands an accent colour to the .chip / .dot / .tone-* classes. */
export const tone = (color: string): CSSProperties =>
  ({ "--c": color }) as CSSProperties;
