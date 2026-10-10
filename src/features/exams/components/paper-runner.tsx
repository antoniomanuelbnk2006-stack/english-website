'use client';

import { ArrowLeft, ArrowRight, Clock, Headphones } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { isAnswered } from '@/features/exams/lib/grade';
import { buildSchedule, recordingsOf, scheduleSeconds } from '@/features/exams/lib/schedule';
import { submitExamPaper } from '@/features/exams/server/actions';
import { formatClock } from '@/features/lessons/lib/summary';
import type { PartFormat } from '@/lib/content/exam-formats';
import type { PublicExamPart, PublicQuestionPaper } from '@/lib/content/exam-schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { ListeningTape } from './listening-tape';
import { PartView } from './part-view';
import { useSitting } from './use-sitting';

export interface RunnerFormat {
  /** «B2 First». */
  exam: string;
  /** «Reading and Use of English». */
  title: string;
  minutes: number;
  /** Listening: segundos finales para revisar. */
  reviewS: number;
  parts: PartFormat[];
}

function numbersOf(part: PublicExamPart): number[] {
  switch (part.type) {
    case 'mcq':
      return part.groups.flatMap((group) => group.questions.map((question) => question.n));
    case 'key_word_transformation':
      return part.items.map((item) => item.n);
    case 'matching':
      return part.tasks.flatMap((task) => task.questions.map((question) => question.n));
    case 'writing':
      return [part.n];
    default:
      return part.gaps.map((gap) => gap.n);
  }
}

/**
 * Un silencio de una décima de segundo. Reproducirlo en el clic de «Empezar» da permiso al
 * navegador para que la cinta siga sola después (la CSP admite `blob:`, no `data:`).
 */
function silence(): string {
  const samples = 800;
  const bytes = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) => bytes.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  bytes.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 1, true);
  bytes.setUint32(24, 8000, true);
  bytes.setUint32(28, 16_000, true);
  bytes.setUint16(32, 2, true);
  bytes.setUint16(34, 16, true);
  text(36, 'data');
  bytes.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([bytes.buffer], { type: 'audio/wav' }));
}

/**
 * Una prueba de Reading o de Listening en condiciones de examen: todas las partes a la vista,
 * el reloj oficial (o la cinta) corriendo y una sola entrega. La corrección se ve después, en
 * la página de resultado.
 */
export function PaperRunner({
  paper,
  format,
  audioBase,
}: {
  paper: PublicQuestionPaper;
  format: RunnerFormat;
  audioBase: string;
}) {
  const t = useT();
  const router = useRouter();
  const listening = paper.paper === 'listening';
  const { sitting, answers, start, answer, clear } = useSitting(
    paper.id,
    paper.version,
    !listening,
  );

  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Se acabó el tiempo (o la cinta) y no había nada que entregar. */
  const [empty, setEmpty] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const sending = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const numbers = useMemo(() => paper.parts.map(numbersOf), [paper.parts]);
  const writing = useMemo(
    () => new Set(paper.parts.flatMap((part) => (part.type === 'writing' ? [part.n] : []))),
    [paper.parts],
  );
  const scored = useMemo(() => numbers.flat().filter((n) => !writing.has(n)), [numbers, writing]);
  const answered = scored.filter((n) => isAnswered(answers[n])).length;

  const steps = useMemo(
    () => (listening ? buildSchedule(paper.parts, format.parts, format.reviewS) : []),
    [listening, paper.parts, format.parts, format.reviewS],
  );
  const hasAudio = paper.parts.flatMap(recordingsOf).every((recording) => recording.src !== null);

  const deadline = sitting && !listening ? sitting.startedAt + format.minutes * 60_000 : null;
  const remaining = deadline === null ? null : Math.max(0, deadline - now);
  const running = sitting !== null && !empty;

  async function submit(auto: boolean) {
    if (sending.current || !sitting) return;
    const entries = scored.flatMap((n) => {
      const value = answers[n];
      return isAnswered(value) ? [{ n, value }] : [];
    });
    if (entries.length === 0) {
      if (auto) {
        clear();
        setEmpty(true);
      }
      return;
    }
    sending.current = true;
    setBusy(true);
    setFailed(false);
    const response = await submitExamPaper({
      paperId: paper.id,
      version: paper.version,
      sitting: sitting.id,
      answers: entries,
      durationMs: Math.min(Date.now() - sitting.startedAt, 10_800_000),
    }).catch(() => null);
    if (!response?.ok) {
      sending.current = false;
      setBusy(false);
      setFailed(true);
      return;
    }
    try {
      // Las redacciones no se guardan en el servidor: viajan a la página de resultado por aquí.
      const texts = Object.fromEntries([...writing].map((n) => [n, String(answers[n] ?? '')]));
      window.sessionStorage.setItem(`senal:exam:${paper.id}:writing`, JSON.stringify(texts));
    } catch {
      // Sin almacenamiento, el resultado enseña solo el modelo.
    }
    clear();
    router.push(`/examenes/${paper.id}/resultado` as Route);
  }
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  // El reloj del Reading: al llegar a cero se entrega lo que haya.
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() >= deadline) {
        setTimeUp(true);
        void submitRef.current(true);
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  // Con la prueba en marcha, salir de la página pide confirmación.
  useEffect(() => {
    if (!running || busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running, busy]);

  function begin() {
    if (listening) {
      // El primer `play()` tiene que salir de un gesto del usuario: luego la cinta sigue sola.
      const element = new Audio(silence());
      element.preload = 'auto';
      void element.play().catch(() => undefined);
      audio.current = element;
    }
    setNow(Date.now());
    start();
  }

  function goTo(index: number) {
    setCurrent(Math.max(0, Math.min(paper.parts.length - 1, index)));
    topRef.current?.scrollIntoView({ block: 'start' });
  }

  if (empty) {
    return (
      <Panel className="flex flex-col items-start gap-4">
        <p role="status">{t('exams.emptySitting')}</p>
        <Link href="/examenes" className={buttonVariants({ variant: 'secondary' })}>
          {t('exams.backToIndex')}
        </Link>
      </Panel>
    );
  }

  if (!sitting) {
    const seconds = listening ? scheduleSeconds(steps) : format.minutes * 60;
    return (
      <div className="flex flex-col gap-5">
        <Panel className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-lg font-medium">
            {listening ? (
              <Headphones aria-hidden="true" className="size-5 text-accent" strokeWidth={1.75} />
            ) : (
              <Clock aria-hidden="true" className="size-5 text-accent" strokeWidth={1.75} />
            )}
            {listening
              ? t('exams.introListeningTime', { min: Math.round(seconds / 60) })
              : t('exams.introTime', { min: format.minutes })}
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
            {(listening
              ? ([
                  'exams.ruleTape',
                  'exams.ruleTwice',
                  'exams.ruleReview',
                  'exams.ruleOnce',
                ] as const)
              : ([
                  'exams.ruleClock',
                  'exams.ruleFree',
                  'exams.ruleResume',
                  'exams.ruleOnce',
                ] as const)
            ).map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <ol className="flex flex-col divide-y divide-border rounded-control border border-border">
            {format.parts.map((part, index) => (
              <li
                key={index}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="hud w-16 shrink-0 text-muted">
                  {t('exams.part', { n: index + 1 })}
                </span>
                <span lang="en" className="min-w-0 flex-1 font-medium">
                  {part.name}
                </span>
                <span className="hud text-xs text-muted">
                  {part.type === 'writing'
                    ? t('exams.unscored')
                    : t('exams.partMarks', {
                        questions: part.questions,
                        marks: part.questions * part.marksEach,
                      })}
                </span>
              </li>
            ))}
          </ol>
          {listening && !hasAudio ? (
            <p role="alert" className="text-sm text-warning">
              {t('exams.noAudio')}
            </p>
          ) : null}
          <Button
            size="lg"
            className="self-start"
            disabled={listening && !hasAudio}
            onClick={begin}
          >
            {t('exams.start')}
          </Button>
        </Panel>
      </div>
    );
  }

  const part = paper.parts[current];
  const partFormat = format.parts[current];
  const locked = timeUp || busy;

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={topRef}
        className="sticky top-14 z-10 -mx-4 flex scroll-mt-16 flex-col gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 md:scroll-mt-2 lg:-mx-8 lg:px-8"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {listening ? (
            !audioFailed ? (
              <div className="min-w-0 flex-1">
                <ListeningTape
                  steps={steps}
                  audio={audio}
                  audioBase={audioBase}
                  onPart={(n) => setCurrent(n - 1)}
                  onFinished={() => {
                    setTimeUp(true);
                    void submitRef.current(true);
                  }}
                  onError={() => setAudioFailed(true)}
                />
              </div>
            ) : (
              <p role="alert" className="min-w-0 flex-1 text-sm text-danger">
                {t('exams.audioError')}
              </p>
            )
          ) : (
            <p
              role="timer"
              aria-label={t('exams.timeLeftLabel')}
              className={cn(
                'hud flex items-center gap-2 text-lg',
                remaining !== null && remaining <= 5 * 60_000 ? 'text-warning' : 'text-text',
              )}
            >
              <Clock aria-hidden="true" className="size-4" strokeWidth={2} />
              {formatClock(remaining ?? 0)}
            </p>
          )}
          <span className="hud text-sm text-muted">
            {t('exams.answered', { done: answered, total: scored.length })}
          </span>
          <Button
            variant="secondary"
            className="ml-auto"
            disabled={busy || answered === 0}
            onClick={() => setConfirming(true)}
          >
            {t('exams.finish')}
          </Button>
        </div>

        <nav aria-label={t('exams.partsLabel')}>
          <ul className="flex flex-wrap gap-1.5">
            {paper.parts.map((item, index) => {
              const own = numbers[index] ?? [];
              const done = own.filter((n) => isAnswered(answers[n])).length;
              return (
                <li key={index}>
                  <button
                    type="button"
                    aria-current={index === current ? 'true' : undefined}
                    onClick={() => goTo(index)}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors duration-150 pointer-coarse:h-11',
                      index === current
                        ? 'border-accent bg-surface-2 font-medium text-accent'
                        : 'border-border text-muted hover:border-subtle hover:text-text',
                    )}
                  >
                    {t('exams.part', { n: index + 1 })}
                    <span className={cn('hud text-xs', done === own.length && 'text-success')}>
                      {done}/{own.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {timeUp ? (
        <p role="status" className="text-sm font-medium text-warning">
          {t(listening ? 'exams.tapeOver' : 'exams.timeOver')}
        </p>
      ) : null}
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          {t('errors.saveFailed')}
          <Button variant="secondary" disabled={busy} onClick={() => void submit(false)}>
            {t('exams.retry')}
          </Button>
        </div>
      ) : null}

      {confirming ? (
        <Panel
          role="alertdialog"
          aria-labelledby="exam-confirm"
          className="flex flex-col gap-3 border-accent"
        >
          <h2 id="exam-confirm" className="text-lg font-medium">
            {t('exams.confirmTitle')}
          </h2>
          <p className="text-sm text-muted">
            {answered < scored.length
              ? t('exams.confirmMissing', { n: scored.length - answered })
              : t('exams.confirmAll')}{' '}
            {t('exams.confirmOnce')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void submit(false)}>
              {busy ? t('common.saving') : t('exams.confirmSubmit')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {t('exams.confirmBack')}
            </Button>
          </div>
        </Panel>
      ) : null}

      {part && partFormat ? (
        <section aria-labelledby="exam-part" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 id="exam-part" className="text-xl font-semibold tracking-tight">
              {t('exams.part', { n: current + 1 })}
              <span lang="en" className="ml-2 font-normal text-muted">
                {partFormat.name}
              </span>
            </h2>
            <p lang="en" className="text-sm text-muted">
              {part.rubric}
            </p>
          </header>
          <fieldset disabled={locked} className="min-w-0">
            <PartView part={part} format={partFormat} answers={answers} onAnswer={answer} />
          </fieldset>
        </section>
      ) : null}

      <div className="flex justify-between gap-2">
        <Button variant="ghost" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <ArrowLeft aria-hidden="true" strokeWidth={2} />
          {t('exams.prevPart')}
        </Button>
        <Button
          variant="ghost"
          disabled={current === paper.parts.length - 1}
          onClick={() => goTo(current + 1)}
        >
          {t('exams.nextPart')}
          <ArrowRight aria-hidden="true" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
