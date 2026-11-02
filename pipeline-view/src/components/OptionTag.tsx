import type { CSSProperties } from 'react';
import type { OptionColor, StatusCategory } from '../types';

export interface OptionTagProps {
  option?: { name: string; color: number } | null;
  colors: OptionColor[];
  size?: 'small' | 'default';
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** Palette entry for a Lark option color index; tolerant of out-of-range / negative indexes. */
export function pickOptionColor(colors: OptionColor[], color: number): OptionColor | undefined {
  if (colors.length === 0 || !Number.isFinite(color)) return undefined;
  const i = Math.trunc(color);
  return colors[((i % colors.length) + colors.length) % colors.length];
}

const SIZES: Record<'small' | 'default', CSSProperties> = {
  small: { height: 20, padding: '0 6px', fontSize: 12, borderRadius: 4 },
  default: { height: 24, padding: '0 8px', fontSize: 13, borderRadius: 6 },
};

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
  lineHeight: 1,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
};

/** Select option chip in Lark colours; a muted placeholder chip when there is no option. */
export function OptionTag(props: OptionTagProps): JSX.Element {
  const { option, colors, size = 'default', placeholder, className, style, title } = props;
  const palette = option ? pickOptionColor(colors, option.color) : undefined;
  const colorStyle: CSSProperties = option
    ? {
        background: palette?.bg ?? 'var(--pv-surface-2)',
        color: palette?.text ?? 'var(--pv-text)',
      }
    : {
        background: 'var(--pv-surface-2)',
        color: 'var(--pv-text-3)',
        boxShadow: 'inset 0 0 0 1px var(--pv-border)',
        fontWeight: 400,
      };
  const text = option ? option.name : (placeholder ?? '—');
  return (
    <span
      className={['pv-option-tag', className].filter(Boolean).join(' ')}
      style={{ ...BASE, ...SIZES[size], ...colorStyle, ...style }}
      title={title ?? text}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </span>
  );
}

/** Small round swatch in an option's colour (used where a full tag would be too heavy). */
export function OptionDot(props: { color: number; colors: OptionColor[]; size?: number }): JSX.Element {
  const { color, colors, size = 10 } = props;
  const palette = pickOptionColor(colors, color);
  return (
    <span
      aria-hidden
      className="pv-option-dot"
      style={{
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: palette?.bg ?? 'var(--pv-dot-pending)',
        // Lark option backgrounds are mostly pastel: a neutral ring keeps them visible on white.
        boxShadow: 'inset 0 0 0 1px var(--pv-border-strong)',
      }}
    />
  );
}

/** CSS colour for a status category (todo grey, doing amber, blocked red, done green). */
export function categoryColor(category: StatusCategory | null | undefined): string {
  switch (category) {
    case 'done':
      return 'var(--pv-success)';
    case 'doing':
      return 'var(--pv-warning)';
    case 'blocked':
      return 'var(--pv-danger)';
    default:
      return 'var(--pv-dot-pending)';
  }
}

/** Dot coloured by status category; 'todo' is a hollow ring like Meegle's "not started". */
export function StatusDot(props: { category: StatusCategory | null | undefined; size?: number }): JSX.Element {
  const { category, size = 8 } = props;
  const hollow = !category || category === 'todo';
  return (
    <span
      aria-hidden
      className="pv-status-dot"
      style={{
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: hollow ? 'transparent' : categoryColor(category),
        boxShadow: hollow ? 'inset 0 0 0 1.5px var(--pv-text-3)' : undefined,
      }}
    />
  );
}
