/** Helper-language picker: auto-detect from locale, pinch-confirm, Immersion hides hints. Pure. */
export type HelperLang = 'es' | 'vi' | 'none';

export function detectHelper(locale: string | undefined | null): HelperLang {
  const l = (locale ?? '').toLowerCase();
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('vi')) return 'vi';
  return 'none';
}

/** Pinch-confirm at launch: keep detected, or cycle to next option on each pinch. */
export function cycleHelper(current: HelperLang): HelperLang {
  return current === 'es' ? 'vi' : current === 'vi' ? 'none' : 'es';
}

export function visibleHelper(helperLang: HelperLang, immersion: boolean): HelperLang {
  return immersion ? 'none' : helperLang;
}

export function helperText(entry: { helper: { es: string; vi: string } }, lang: HelperLang, immersion: boolean): string {
  const vis = visibleHelper(lang, immersion);
  return vis === 'none' ? '' : entry.helper[vis];
}
