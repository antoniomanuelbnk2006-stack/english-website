'use client';

import { useSyncExternalStore } from 'react';
import { storeAccent, storedAccent, subscribeAccent } from '@/features/pronunciation/lib/speech';
import { ACCENTS, DEFAULT_ACCENT, type Accent } from '@/features/pronunciation/lib/voices';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const LABEL: Record<Accent, TranslationKey> = {
  'en-GB': 'pronunciation.accentGb',
  'en-US': 'pronunciation.accentUs',
};

/** Acento elegido en este navegador, para el audio modelo y para el reconocimiento. */
export function useAccent(): Accent {
  return useSyncExternalStore(subscribeAccent, storedAccent, () => DEFAULT_ACCENT);
}

/** Elegir entre inglés británico y americano. */
export function AccentPicker() {
  const t = useT();
  const accent = useAccent();
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t('pronunciation.accent')}</legend>
      <span aria-hidden="true" className="text-xs text-muted">
        {t('pronunciation.accent')}
      </span>
      {ACCENTS.map((option) => (
        <label
          key={option}
          className={cn(
            'flex h-8 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors duration-150 pointer-coarse:h-11 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
            option === accent
              ? 'border-accent bg-surface-2 font-medium text-accent'
              : 'border-border text-muted hover:border-subtle hover:text-text',
          )}
        >
          <input
            type="radio"
            name="accent"
            value={option}
            checked={option === accent}
            onChange={() => storeAccent(option)}
            className="sr-only"
          />
          {t(LABEL[option])}
        </label>
      ))}
    </fieldset>
  );
}
