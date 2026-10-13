'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { setDeclaredLevel } from '@/features/level/server/actions';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const DESCRIPTION: Record<CefrLevel, TranslationKey> = {
  A1: 'level.descA1',
  A2: 'level.descA2',
  B1: 'level.descB1',
  B2: 'level.descB2',
  C1: 'level.descC1',
  C2: 'level.descC2',
};

/**
 * Elegir el nivel: un grupo de opciones con lo que se entiende en cada uno. Lo que haya
 * publicado de ese nivel es lo primero que se ve en cada sección.
 */
export function LevelPicker({
  current,
  counts,
}: {
  current: CefrLevel | null;
  /** Cuánto contenido hay publicado de cada nivel. */
  counts: Record<CefrLevel, number>;
}) {
  const t = useT();
  const router = useRouter();
  const [level, setLevel] = useState<CefrLevel | null>(current);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [navigating, startTransition] = useTransition();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!level) return;
    setSaving(true);
    setFailed(false);
    const result = await setDeclaredLevel({ level }).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    startTransition(() => {
      router.push('/hoy');
      router.refresh();
    });
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('level.chooseTitle')}</legend>
        {CEFR_LEVELS.map((option) => {
          const checked = level === option;
          return (
            <label
              key={option}
              className={cn(
                'option cursor-pointer items-start gap-4 bg-surface p-4',
                checked && 'border-accent',
              )}
            >
              <input
                type="radio"
                name="level"
                value={option}
                checked={checked}
                onChange={() => setLevel(option)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{t(`cefr.${option}` as TranslationKey)}</span>
                  <span className="tabular-nums text-caption text-muted">
                    {counts[option] === 1
                      ? t('level.contentOne')
                      : t('level.content', { n: counts[option] })}
                  </span>
                </span>
                <span className="text-body-sm text-muted">{t(DESCRIPTION[option])}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="self-start"
        disabled={!level || saving || navigating}
      >
        {saving || navigating ? t('common.saving') : t('level.save')}
      </Button>
    </form>
  );
}
