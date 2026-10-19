'use client';

import { useContentLang } from '@/components/content-language';
import { useMemo, useSyncExternalStore } from 'react';
import { useT } from '@/lib/i18n/client';

const subscribe = () => () => undefined;

/**
 * Lo que se escribió en una redacción del simulacro. No pasa por el servidor: la pantalla de
 * examen lo deja en este navegador al entregar, y aquí se lee para compararlo con el modelo.
 */
export function WritingReview({ paperId, n }: { paperId: string; n: number }) {
  const lang = useContentLang();
  const t = useT();
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.sessionStorage.getItem(`senal:exam:${paperId}:writing`);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const text = useMemo(() => {
    if (raw === null) return '';
    try {
      const value = (JSON.parse(raw) as Record<string, unknown>)[String(n)];
      return typeof value === 'string' ? value.trim() : '';
    } catch {
      return '';
    }
  }, [raw, n]);

  if (text === '') return <p className="text-body-sm text-muted">{t('exams.writingMissing')}</p>;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-body-sm font-medium text-muted">{t('exams.writingYours')}</h4>
      <p lang={lang} className="prose-reading whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}
