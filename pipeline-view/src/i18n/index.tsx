import React, { createContext, useContext } from 'react';
import type { Lang } from '../types';
import common from './parts/common';
import detail from './parts/detail';
import settings from './parts/settings';

/**
 * Each part file exports `{ vi: {...}, en: {...} }` with keys prefixed by its area
 * (`common.*`, `detail.*`, `settings.*`). Placeholders use `{name}`.
 */
export type Dict = Record<string, string>;
export interface DictPart {
  vi: Dict;
  en: Dict;
}

const parts: DictPart[] = [common, detail, settings];

const dicts: Record<Lang, Dict> = {
  vi: Object.assign({}, ...parts.map((p) => p.vi)),
  en: Object.assign({}, ...parts.map((p) => p.en)),
};

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

export function createT(lang: Lang): TFunc {
  return (key, vars) => {
    const template = dicts[lang][key] ?? dicts.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  };
}

/** Map a host language/locale string (e.g. "vi-VN", "en-US", "zh") to a supported Lang. */
export function toLang(input: string | undefined | null): Lang {
  return (input || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

const I18nContext = createContext<{ lang: Lang; t: TFunc }>({ lang: 'en', t: createT('en') });

export function I18nProvider(props: { lang: Lang; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ lang: props.lang, t: createT(props.lang) }), [props.lang]);
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
