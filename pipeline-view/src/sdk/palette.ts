import type { OptionColor } from '../types';

/**
 * Built-in approximation of Lark's select-option palette (color ids 0..54), used
 * when the host cannot provide `ui.getSelectOptionColorInfoList()` (mock mode,
 * older hosts, errors).
 *
 * Layout: ids 0-49 are 5 tiers x 10 hues, ids 50-54 are extra light hues.
 *   tier 0 (0-9)   light pastel, dark text        <- the colors Lark assigns first
 *   tier 1 (10-19) deeper pastel, dark text
 *   tier 2 (20-29) saturated, white text (dark on yellow)
 *   tier 3 (30-39) deep, white text
 *   tier 4 (40-49) very light tint, hue-colored text
 */

const DARK_TEXT = '#1f2329';
const WHITE_TEXT = '#ffffff';

interface HueScale {
  tint: string; // ~50
  light: string; // ~100
  soft: string; // ~200
  strong: string; // ~500
  deep: string; // ~700
  ink: string; // ~600, readable text on tint
}

/** Hue order for ids 0-9: blue, cyan, green, yellow, orange, red, pink, purple, indigo, grey. */
const HUES: HueScale[] = [
  { tint: '#f0f4ff', light: '#e1eaff', soft: '#bacefd', strong: '#3370ff', deep: '#1c4cba', ink: '#245bdb' }, // blue
  { tint: '#f0fbff', light: '#d9f3fd', soft: '#b1e8fc', strong: '#049fd7', deep: '#006185', ink: '#037eaa' }, // cyan
  { tint: '#f0fbef', light: '#d9f5d6', soft: '#b7edb1', strong: '#34c724', deep: '#237b19', ink: '#2ea121' }, // green
  { tint: '#fdf9ed', light: '#faf1d1', soft: '#f8e6ab', strong: '#ffc60a', deep: '#aa7803', ink: '#b88502' }, // yellow
  { tint: '#fff5eb', light: '#feead2', soft: '#fed4a4', strong: '#ff8800', deep: '#b26206', ink: '#c96d03' }, // orange
  { tint: '#fef1f1', light: '#fde2e2', soft: '#fbbfbc', strong: '#f54a45', deep: '#ac2f28', ink: '#d83931' }, // red
  { tint: '#fef0f8', light: '#fddbef', soft: '#f9aed9', strong: '#e8259a', deep: '#a11060', ink: '#c71077' }, // pink
  { tint: '#f6f1fe', light: '#ece2fe', soft: '#cdb2fa', strong: '#7f3bf5', deep: '#4c1ba2', ink: '#6425d0' }, // purple
  { tint: '#f2f3fd', light: '#e0e3fa', soft: '#c2c7f5', strong: '#4954e6', deep: '#2b32a0', ink: '#3b43c4' }, // indigo
  { tint: '#f5f6f7', light: '#eff0f1', soft: '#dee0e3', strong: '#8f959e', deep: '#373c43', ink: '#646a73' }, // grey
];

/** Extra light hues for ids 50-54: turquoise, lime, violet, deeper turquoise, deeper lime. */
const EXTRA_BACKGROUNDS = ['#d5f6f2', '#eef6c6', '#f8def8', '#a9efe6', '#dfee96'];

/** Relative luminance (WCAG) of a #rrggbb color. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Dark or white text, whichever contrasts better with `bg`. */
function readableText(bg: string): string {
  const l = luminance(bg);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return contrastWhite >= contrastDark ? WHITE_TEXT : DARK_TEXT;
}

function buildPalette(): OptionColor[] {
  const tiers: ((h: HueScale) => OptionColor)[] = [
    (h) => ({ bg: h.light, text: DARK_TEXT }),
    (h) => ({ bg: h.soft, text: DARK_TEXT }),
    (h) => ({ bg: h.strong, text: readableText(h.strong) }),
    (h) => ({ bg: h.deep, text: WHITE_TEXT }),
    (h) => ({ bg: h.tint, text: h.ink }),
  ];
  const colors: OptionColor[] = [];
  for (const tier of tiers) {
    for (const hue of HUES) colors.push(tier(hue));
  }
  for (const bg of EXTRA_BACKGROUNDS) colors.push({ bg, text: DARK_TEXT });
  return colors;
}

/** 55 entries; index = Lark option color id. */
export const FALLBACK_OPTION_COLORS: OptionColor[] = buildPalette();

/**
 * Color for an option color id, never undefined: wraps out-of-range ids, treats
 * non-finite ids as 0 and falls back to the built-in palette when `colors` is empty.
 */
export function optionColor(colors: OptionColor[] | null | undefined, index: number): OptionColor {
  const palette = colors && colors.length > 0 ? colors : FALLBACK_OPTION_COLORS;
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  const n = palette.length;
  return palette[((i % n) + n) % n] ?? FALLBACK_OPTION_COLORS[0];
}
