/**
 * The MonoEdge symbol, from the brand assets. The two strokes take
 * `currentColor` so the mark inverts with the theme the way the black and
 * white lockups do; the descending wings keep the MonoEdge Blue → Ice Blue
 * gradient, which is the one place the gradient is allowed to appear.
 *
 * The second gradient is the first mirrored about the artboard centre
 * (x' = 410.4 − x) rather than the source file's rotate-and-translate, which
 * is the same geometry written in a way a human can check.
 *
 * Gradient ids are suffixed per instance: two marks on one page (the top bar
 * and a dialog, say) would otherwise both point at whichever `<defs>` the
 * document happened to parse first.
 */
export function Mark({
  className = "h-[19px] w-auto text-foreground",
  idSuffix = "bar",
}: {
  className?: string;
  idSuffix?: string;
}) {
  const right = `me-wing-right-${idSuffix}`;
  const left = `me-wing-left-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 410.4 288"
      className={className}
      role="img"
      aria-label="MonoEdge Systems"
    >
      <defs>
        <linearGradient
          id={right}
          x1="370.12"
          y1="108.33"
          x2="295.97"
          y2="244.19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.03" stopColor="#204494" />
          <stop offset="0.41" stopColor="#3256a1" />
          <stop offset="0.84" stopColor="#698dc9" />
          <stop offset="1" stopColor="#85a9dd" />
        </linearGradient>
        <linearGradient
          id={left}
          x1="40.28"
          y1="108.33"
          x2="114.43"
          y2="244.19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.03" stopColor="#204494" />
          <stop offset="0.41" stopColor="#3256a1" />
          <stop offset="0.84" stopColor="#698dc9" />
          <stop offset="1" stopColor="#85a9dd" />
        </linearGradient>
      </defs>
      <path
        fill="currentColor"
        d="M97.36,35.83h-53.81v49.15c34.26,34.26,67.05,67.05,101.31,101.31,17.94-17.94,33.32-33.77,51.25-51.71-34.26-34.26-64.49-64.49-98.76-98.76Z"
      />
      <polygon
        fill="currentColor"
        points="314.16 35.83 151.59 198.18 151.59 251.99 201.28 252.18 366.85 86.63 366.85 35.82 314.16 35.83"
      />
      <path
        fill={`url(#${right})`}
        d="M366.85,106.54c-31.41,31.39-62.82,62.46-94.23,93.85v50.63s28.63,0,28.63,0c16.19,0,31.72-6.46,43.13-17.96,1.61-1.62,3.23-3.25,4.83-4.87,11.3-11.38,17.63-26.77,17.63-42.8v-78.85Z"
      />
      <path
        fill={`url(#${left})`}
        d="M43.55,106.54c31.41,31.39,62.82,62.46,94.23,93.85v50.63s-28.63,0-28.63,0c-16.19,0-31.72-6.46-43.13-17.96-1.61-1.62-3.23-3.25-4.83-4.87-11.3-11.38-17.63-26.77-17.63-42.8v-78.85Z"
      />
    </svg>
  );
}
