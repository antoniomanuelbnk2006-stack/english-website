'use client';

import { BookOpen, Headphones } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { QUICK_MINUTES } from '@/features/journal/lib/journal';
import { deleteInput, logInput } from '@/features/journal/server/actions';
import { useT } from '@/lib/i18n/client';

type QuickKind = 'extensive_listening' | 'extensive_reading';

/**
 * Registro de contenido externo en un toque: «20 min de escucha».
 * Se puede deshacer justo después, por si el dedo se ha ido al botón de al lado.
 */
export function QuickLog() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<{ id: number; minutes: number; kind: QuickKind } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const kindLabel = (kind: QuickKind) =>
    (kind === 'extensive_listening'
      ? t('journal.quickListening')
      : t('journal.quickReading')
    ).toLowerCase();

  function log(kind: QuickKind, minutes: number) {
    startTransition(async () => {
      const result = await logInput({ kind, minutes });
      if (result.ok) {
        setLast({ id: result.data.id, minutes, kind });
        setMessage(t('journal.logged', { n: minutes, kind: kindLabel(kind) }));
        router.refresh();
      } else {
        setLast(null);
        setMessage(t('errors.saveFailed'));
      }
    });
  }

  function undo() {
    if (!last) return;
    startTransition(async () => {
      const result = await deleteInput({ id: last.id });
      setLast(null);
      setMessage(result.ok ? t('journal.undone') : t('errors.saveFailed'));
      if (result.ok) router.refresh();
    });
  }

  const rows = [
    { kind: 'extensive_listening' as const, icon: Headphones, label: t('journal.quickListening') },
    { kind: 'extensive_reading' as const, icon: BookOpen, label: t('journal.quickReading') },
  ];

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ kind, icon: Icon, label }) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span className="flex w-24 shrink-0 items-center gap-2 text-body-sm font-medium">
            <Icon aria-hidden="true" className="size-5 text-accent-text" strokeWidth={1.75} />
            {label}
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_MINUTES.map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                className="tabular-nums min-w-16"
                disabled={pending}
                aria-label={t('journal.logMinutes', { n: minutes, kind: kindLabel(kind) })}
                onClick={() => log(kind, minutes)}
              >
                {t('common.minutes', { n: minutes })}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <p
        role="status"
        className="flex min-h-9 flex-wrap items-center gap-2 text-body-sm text-muted"
      >
        {message}
        {last ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={undo}>
            {t('journal.undo')}
          </Button>
        ) : null}
      </p>
    </div>
  );
}
