'use client';

import { useCallback, useRef, useState } from 'react';
import type { AttemptInput } from '@/features/lessons/lib/attempts';
import { submitAttempts } from '@/features/lessons/server/actions';
import type { CheckedTask } from '@/features/tasks/components/task-runner';
import type { TranslationKey } from '@/lib/i18n';
import { useActiveClock } from '@/lib/use-active-clock';

export interface SaveProgress {
  phase: number;
  completed?: boolean;
  readingWpm?: number;
}

/**
 * Estado de una lección en curso: intentos pendientes de enviar, tiempo activo y guardado.
 * Si un guardado falla, los intentos y el tiempo se quedan en cola y salen en el siguiente.
 */
export function useLessonSession(lesson: { id: string; version: number }) {
  const clock = useActiveClock();
  const pending = useRef<AttemptInput[]>([]);
  const sentMs = useRef(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  /** Nota oficial de la lección (la calcula el servidor al completarla). */
  const [serverScore, setServerScore] = useState<number | null>(null);

  const record = useCallback((checked: CheckedTask) => {
    pending.current.push({
      itemId: checked.task.id,
      response: checked.response,
      durationMs: Math.min(3_600_000, Math.max(0, Math.round(checked.durationMs))),
      clientId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }, []);

  const save = useCallback(
    async (progress: SaveProgress): Promise<boolean> => {
      setSaving(true);
      setError(null);
      const totalMs = clock.total();
      const batch = [...pending.current];
      try {
        const result = await submitAttempts({
          lessonId: lesson.id,
          lessonVersion: lesson.version,
          attempts: batch,
          progress: {
            phase: progress.phase,
            completed: progress.completed ?? false,
            activeSeconds: Math.round((totalMs - sentMs.current) / 1000),
            readingWpm: progress.readingWpm,
          },
        });
        if (!result.ok) {
          setError(result.error === 'conflict' ? 'errors.lessonChanged' : 'errors.saveFailed');
          return false;
        }
        pending.current = pending.current.filter((attempt) => !batch.includes(attempt));
        sentMs.current = totalMs;
        if (result.data.score !== null) setServerScore(result.data.score);
        return true;
      } catch {
        setError('errors.saveFailed');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clock, lesson.id, lesson.version],
  );

  return { clock, record, save, saving, error, serverScore };
}
