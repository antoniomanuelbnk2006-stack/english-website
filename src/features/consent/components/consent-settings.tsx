'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveConsent } from '@/features/consent/lib/browser';
import { applyConsentToSession } from '@/features/consent/server/actions';
import type { Consent } from '@/lib/consent';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const OPTIONS: { choice: Consent; label: TranslationKey; saved: TranslationKey }[] = [
  { choice: 'necessary', label: 'consent.onlyNecessary', saved: 'consent.savedNecessary' },
  { choice: 'all', label: 'consent.withPreferences', saved: 'consent.savedAll' },
];

/** Cambiar la decisión sobre las cookies desde Ajustes: tan fácil como darla (ADR-0028). */
export function ConsentSettings({ initial }: { initial: Consent | null }) {
  const t = useT();
  const router = useRouter();
  const [consent, setConsent] = useState(initial);
  const [saved, setSaved] = useState<TranslationKey | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t('consent.title')} className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const active = consent === option.choice;
          return (
            <button
              key={option.choice}
              type="button"
              aria-pressed={active}
              onClick={() => {
                saveConsent(option.choice);
                setConsent(option.choice);
                setSaved(option.saved);
                // La sesión pasa a recordarse o no según la decisión (ADR-0030).
                void applyConsentToSession().finally(() => router.refresh());
              }}
              className={cn(
                'flex min-h-11 items-center rounded-full border px-4 text-body-sm transition-colors duration-150',
                active
                  ? 'border-accent bg-surface-2 font-medium text-accent-text'
                  : 'border-transparent bg-surface-2 text-muted hover:border-border hover:text-text',
              )}
            >
              {t(option.label)}
            </button>
          );
        })}
      </div>
      <p role="status" className="min-h-5 text-body-sm text-muted">
        {saved ? t(saved) : null}
      </p>
    </div>
  );
}
