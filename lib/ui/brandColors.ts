/**
 * Brand colors for ECharts / themeColor / shared JS.
 * Sync with app/globals.css :root --color-* and docs/design-tokens.md
 */
export const BRAND = {
  ink: '#17212b',
  inkHover: '#2a3644',
  paper: '#f6f8f5',
  coral: '#f07f62',
  coralDeep: '#d9654a',
  coralHover: '#df6e51',
  coralInk: '#c4533a',
  mint: '#d8f3e4',
} as const;

/** RGB channels (space-separated) for css rgb(var(--color-*) / ...) */
export const BRAND_RGB = {
  ink: '23 33 43',
  inkHover: '42 54 68',
  paper: '246 248 245',
  coral: '240 127 98',
  coralDeep: '217 101 74',
  coralHover: '223 110 81',
  coralInk: '196 83 58',
  mint: '216 243 228',
} as const;

export type BrandColor = keyof typeof BRAND;
