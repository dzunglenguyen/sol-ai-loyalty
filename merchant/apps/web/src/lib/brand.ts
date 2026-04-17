/**
 * Programmatic brand values (QR payloads, inline SVG data URLs, server-rendered HTML).
 * Visual tokens for Tailwind/CSS live in `src/app/globals.css` @theme — keep hex in sync.
 */
export const BRAND_HEX = {
  shinhanNavy: "#00397f",
  surfaceWhite: "#ffffff",
} as const;

/** CopilotKit theme bridge: prefer CSS variables so the shell stays one source of truth. */
export const copilotKitThemeVars = {
  "--copilot-kit-primary-color": "var(--color-shinhan-navy)",
} as const;

export function solQrCenterIconDataUri(navyHex: string = BRAND_HEX.shinhanNavy): string {
  const fill = encodeURIComponent(navyHex);
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${fill}'><circle cx='12' cy='12' r='10'/><text x='12' y='16' text-anchor='middle' fill='white' font-size='10' font-weight='bold'>S</text></svg>`;
}
