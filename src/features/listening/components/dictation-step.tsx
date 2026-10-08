'use client';

import { CircleCheck, Play } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { toPercent } from '@/features/lessons/lib/summary';
import {
  CAUSES,
  diagnoseBest,
  type Cause,
  type Diagnosis,
} from '@/features/listening/lib/dictation';
import type { DictationTask } from '@/features/listening/lib/views';
import { DictationDiff } from './dictation-diff';
import { player, usePlayer } from '@/lib/audio/store';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export const CAUSE_LABEL: Record<Cause, TranslationKey> = {
  unknown_word: 'listening.causeUnknownWord',
  not_recognized: 'listening.causeNotRecognized',
  boundaries: 'listening.causeBoundaries',
  speed: 'listening.causeSpeed',
  accent: 'listening.causeAccent',
  attention: 'listening.causeAttention',
};

export interface DictationFailure {
  expected: string;
  typed: string | null;
  cause: Cause;
  /** `user` si se cambió la causa propuesta. */
  source: 'auto' | 'user';
}

export interface DictationResult {
  task: DictationTask;
  typed: string;
  accuracy: number;
  failures: DictationFailure[];
  playbackRate: number;
  durationMs: number;
}

export interface DictationContext {
  /** Índice de cada segmento en el audio, por id. */
  segmentIndex: ReadonlyMap<string, number>;
  knownLemmas: ReadonlySet<string>;
  /** Por segmento: palabra en minúsculas → lema. */
  lemmas: ReadonlyMap<string, Readonly<Record<string, string>>>;
  /** Por segmento: rasgos de habla conectada marcados. */
  features: ReadonlyMap<string, readonly string[]>;
  /** Por segmento: acento del hablante. */
  accents: ReadonlyMap<string, string>;
}

/**
 * Fase 3 · Diagnóstico: microdictado de las frases clave. Compara palabra a palabra, propone
 * por qué se escapó cada fallo y deja corregir la causa con un toque.
 */
export function DictationStep({
  tasks,
  context,
  onChecked,
  onDone,
  busy,
}: {
  tasks: readonly DictationTask[];
  context: DictationContext;
  onChecked: (result: DictationResult) => void;
  onDone: (results: DictationResult[]) => void;
  busy: boolean;
}) {
  const t = useT();
  const rate = usePlayer((state) => state.rate);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [failures, setFailures] = useState<DictationFailure[]>([]);
  const results = useRef<DictationResult[]>([]);
  const startedAt = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const task = tasks[index];

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (diagnosis) feedbackRef.current?.focus();
  }, [diagnosis]);

  if (!task) return null;
  const isLast = index === tasks.length - 1;
  const play = () => {
    const segment = context.segmentIndex.get(task.segment);
    if (segment !== undefined) player.playSegment(segment);
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    if (!diagnosis) {
      if (typed.trim() === '') return;
      const result = diagnoseBest(
        {
          reference: task.reference,
          typed,
          knownLemmas: context.knownLemmas,
          lemmas: context.lemmas.get(task.segment),
          features: context.features.get(task.segment),
          accent: context.accents.get(task.segment),
        },
        task.accept_variants,
      );
      setDiagnosis(result);
      setFailures(
        result.errors.map((error) => ({
          expected: error.expected,
          typed: error.typed,
          cause: error.cause,
          source: 'auto',
        })),
      );
      return;
    }

    const result: DictationResult = {
      task,
      typed,
      accuracy: diagnosis.accuracy,
      failures,
      playbackRate: rate,
      durationMs: Date.now() - startedAt.current,
    };
    results.current = [...results.current, result];
    onChecked(result);
    if (isLast) {
      onDone(results.current);
      return;
    }
    setIndex(index + 1);
    setTyped('');
    setDiagnosis(null);
    setFailures([]);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hud text-xs text-muted">
          {t('listening.sentenceOf', { n: index + 1, total: tasks.length })}
        </p>
        <Button variant="outline" onClick={play}>
          <Play aria-hidden="true" strokeWidth={2} />
          {t('listening.playSentence')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dictation-input">{t('listening.dictationLabel')}</Label>
        <Textarea
          id="dictation-input"
          lang="en"
          rows={3}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="reading-md"
          placeholder={t('listening.dictationPlaceholder')}
          disabled={diagnosis !== null}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>

      {diagnosis ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="status"
          className="flex flex-col gap-3 rounded-control border border-border bg-surface-2 p-3 outline-none"
        >
          <p
            className={cn(
              'hud flex items-center gap-2 text-sm',
              diagnosis.accuracy === 1 ? 'text-success' : 'text-text',
            )}
          >
            {diagnosis.accuracy === 1 ? (
              <CircleCheck aria-hidden="true" className="size-5" strokeWidth={2} />
            ) : null}
            {diagnosis.accuracy === 1
              ? t('listening.cleanSignal')
              : t('listening.dictationAccuracy', { pct: toPercent(diagnosis.accuracy) })}
          </p>
          <DictationDiff diagnosis={diagnosis} />
          {diagnosis.extra.length > 0 ? (
            <p className="text-sm text-muted">
              {t('listening.extraWords', { words: '' })}
              <span lang="en">{diagnosis.extra.join(', ')}</span>
            </p>
          ) : null}

          {failures.map((failure, i) => (
            <div key={`${failure.expected}-${i}`} className="flex flex-col gap-1.5">
              <Label htmlFor={`cause-${i}`} className="font-normal text-muted">
                {t('listening.causeLabel', { words: failure.expected })}
              </Label>
              <Select
                id={`cause-${i}`}
                value={failure.cause}
                onChange={(event) =>
                  setFailures((all) =>
                    all.map((item, j) =>
                      j === i
                        ? { ...item, cause: event.target.value as Cause, source: 'user' }
                        : item,
                    ),
                  )
                }
              >
                {CAUSES.map((cause) => (
                  <option key={cause} value={cause}>
                    {t(CAUSE_LABEL[cause])}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={busy || (!diagnosis && typed.trim() === '')}
        className="self-stretch sm:self-end"
      >
        {!diagnosis ? t('tasks.check') : isLast ? t('common.continue') : t('tasks.next')}
      </Button>
    </form>
  );
}
