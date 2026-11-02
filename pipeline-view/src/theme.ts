import type { ThemeMode } from './types';

/** Semi UI (and our --pv-* tokens) switch to dark mode through `body[theme-mode="dark"]`. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined' || !document.body) return;
  if (mode === 'dark') document.body.setAttribute('theme-mode', 'dark');
  else document.body.removeAttribute('theme-mode');
}
