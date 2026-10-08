'use client';

import { ArrowLeft, Timer, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { PhaseStepper } from '@/components/ui/phase-stepper';
import { useLessonSession } from '@/features/lessons/components/use-lesson-session';
import { byFocus, formatClock, meanScore, toPercent } from '@/features/lessons/lib/summary';
import { READING_WPM_TARGET, SKIM_SECONDS } from '@/features/reading/lib/targets';
import { TaskRunner, type CheckedTask } from '@/features/tasks/components/task-runner';
import { isPlausibleWpm, wordsPerMinute } from '@/lib/active-time';
import type { ReadingLesson as ReadingLessonData } from '@/lib/content/loader';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ReaderText } from './reader-text';

const PHASE = { prepare: 0, skim: 1, read: 2, questions: 3, focus: 4, result: 5 } as const;

const PHASE_LABELS: TranslationKey[] = [
  'reading.phasePrepare',
  'reading.phaseSkim',
  'reading.phaseRead',
  'reading.phaseQuestions',
  'reading.phaseFocus',
  'reading.phaseResult',
];

export interface ReadingLessonProps {
  lesson: ReadingLessonData;
  unitTitle: string;
  /** Fase guardada de una sesión anterior sin terminar. */
  initialPhase: number;
  /** Resultado de la última vez que se completó, si la hay. */
  previous: { score: number | null; version: number } | null;
  fontPx: number;
  paper: boolean;
}

export function ReadingLesson({
  lesson,
  unitTitle,
  initialPhase,
  previous,
  fontPx,
  paper,
}: ReadingLessonProps) {
  const t = useT();
  const { clock, record, save, saving, error, serverScore } = useLessonSession(lesson);

  const skimTasks = useMemo(() => lesson.tasks.filter((task) => task.phase === 'skim'), [lesson]);
  const readTasks = useMemo(() => lesson.tasks.filter((task) => task.phase === 'read'), [lesson]);
  const postTasks = useMemo(() => lesson.tasks.filter((task) => task.phase === 'post'), [lesson]);
  const hasFocus = postTasks.length > 0 || lesson.language_focus.length > 0;

  /** Salta las fases que esta lección no tiene. */
  const resolvePhase = (phase: number): number => {
    if (phase === PHASE.skim && skimTasks.length === 0) return PHASE.read;
    if (phase === PHASE.questions && readTasks.length === 0) return resolvePhase(PHASE.focus);
    if (phase === PHASE.focus && !hasFocus) return PHASE.result;
    return phase;
  };

  // Una sesión a medias se retoma al principio de su fase; el resultado no se «retoma».
  const [phase, setPhase] = useState(() =>
    initialPhase > PHASE.prepare && initialPhase < PHASE.result ? resolvePhase(initialPhase) : 0,
  );
  const [checked, setChecked] = useState<CheckedTask[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [pane, setPane] = useState<'text' | 'tasks'>('text');
  const [wpm, setWpm] = useState<number | null>(null);
  const [readStartMs, setReadStartMs] = useState(0);
  const [readMs, setReadMs] = useState(0);
  const [skimLeft, setSkimLeft] = useState(SKIM_SECONDS);
  const [activeMs, setActiveMs] = useState(0);

  // Cuenta atrás suave del vistazo: informa, no bloquea.
  useEffect(() => {
    if (phase !== PHASE.skim) return;
    const timer = setInterval(() => setSkimLeft((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Cronómetro de lectura (solo tiempo activo).
  useEffect(() => {
    if (phase !== PHASE.read) return;
    const timer = setInterval(() => setReadMs(clock.total() - readStartMs), 1000);
    return () => clearInterval(timer);
  }, [phase, clock, readStartMs]);

  function goTo(next: number) {
    const target = resolvePhase(next);
    setEvidence([]);
    // En pantallas estrechas: primero el texto mientras se lee; las preguntas, después.
    setPane(target === PHASE.skim || target === PHASE.read ? 'text' : 'tasks');
    if (target === PHASE.read) {
      setReadStartMs(clock.total());
      setReadMs(0);
    }
    if (target === PHASE.skim) setSkimLeft(SKIM_SECONDS);
    if (target === PHASE.result) setActiveMs(clock.total());
    setPhase(target);
    window.scrollTo({ top: 0 });
  }

  function handleChecked(item: CheckedTask) {
    record(item);
    setChecked((all) => [...all.filter((c) => c.task.id !== item.task.id), item]);
  }

  /** Guarda y avanza. Si el guardado falla, se avanza igual: los intentos quedan en cola. */
  async function advance(next: number, extra: { readingWpm?: number } = {}) {
    const target = resolvePhase(next);
    await save({ phase: target, completed: target === PHASE.result, ...extra });
    goTo(target);
  }

  function finishReading() {
    const elapsed = clock.total() - readStartMs;
    const measured = wordsPerMinute(lesson.word_count, elapsed);
    const valid = isPlausibleWpm(measured) ? measured : null;
    setWpm(valid);
    void advance(PHASE.questions, valid === null ? {} : { readingWpm: valid });
  }

  function showEvidence(refs: string[]) {
    setEvidence(refs);
    setPane('text');
  }

  const scored = checked.map((c) => ({
    id: c.task.id,
    focus: c.task.focus,
    score: c.result.score,
  }));
  const localScore = meanScore(scored);
  const finalScore = serverScore ?? localScore;
  const missed = checked.filter((c) => c.result.score < 1);
  const target = READING_WPM_TARGET[lesson.level];
  const inImmersion = phase === PHASE.read;
  const showText = phase >= PHASE.skim;
  const showAside = phase !== PHASE.prepare && phase !== PHASE.read;

  const text = (
    <ReaderText
      paragraphs={lesson.paragraphs}
      highlight={evidence}
      fontPx={fontPx}
      className={inImmersion ? 'mx-auto' : undefined}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/leer"
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('lesson.back')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 lang="en" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {lesson.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="hud">{lesson.level}</Chip>
            <Chip>{t(`genres.${lesson.genre}`)}</Chip>
            <Chip className="hud">{t('lesson.words', { n: lesson.word_count })}</Chip>
          </div>
        </div>
        <PhaseStepper
          phases={PHASE_LABELS.map((key) => t(key))}
          current={phase}
          label={t('lesson.phaseOf', { n: phase + 1, total: PHASE_LABELS.length })}
        />
      </header>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
          {t(error)}
        </p>
      ) : null}

      {phase === PHASE.prepare ? (
        <Panel className="flex max-w-2xl flex-col gap-5">
          <div>
            <PanelTitle>{unitTitle}</PanelTitle>
            <p className="mt-2">{lesson.summary_es}</p>
          </div>
          {previous?.score != null ? (
            <p className="text-sm text-muted">
              {t('lesson.lastResult', { pct: toPercent(previous.score) })}
              {previous.version !== lesson.version ? ` ${t('lesson.newVersion')}` : ''}
            </p>
          ) : null}
          {lesson.prediction_prompt ? (
            <div>
              <PanelTitle>{t('reading.beforeReading')}</PanelTitle>
              <p lang="en" className="reading-md mt-2">
                {lesson.prediction_prompt}
              </p>
            </div>
          ) : null}
          {lesson.pre_teach.length > 0 ? (
            <div>
              <PanelTitle>{t('reading.keyWords')}</PanelTitle>
              <dl className="mt-2 flex flex-col gap-2">
                {lesson.pre_teach.map((word) => {
                  const entry = lesson.glossary.find((g) => g.lemma === word);
                  return (
                    <div key={word}>
                      <dt lang="en" className="font-medium text-accent">
                        {word}
                      </dt>
                      {entry ? (
                        <dd className="text-sm text-muted">
                          <span lang="en">{entry.def_en}</span> — {entry.def_es}
                        </dd>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : null}
          <Button
            size="lg"
            className="self-start"
            disabled={saving}
            onClick={() => void advance(PHASE.skim)}
          >
            {t('reading.startSkim')}
          </Button>
        </Panel>
      ) : null}

      {phase === PHASE.skim ? (
        // Encima de los dos paneles: en móvil se ve tanto con el texto como con las preguntas.
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-sm text-muted">
            {skimLeft > 0 ? t('reading.skimHint', { s: SKIM_SECONDS }) : t('reading.skimTimeUp')}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${(skimLeft / SKIM_SECONDS) * 100}%` }}
            />
          </div>
          <p className="hud text-xs text-muted">{t('reading.skimTimeLeft', { s: skimLeft })}</p>
        </div>
      ) : null}

      {showText ? (
        <>
          {/* En pantallas estrechas se ve una cosa cada vez: el texto o las preguntas. */}
          {showAside ? (
            <div
              role="group"
              aria-label={`${t('reading.textTab')} / ${t('reading.questionsTab')}`}
              className="grid grid-cols-2 gap-1 rounded-control border border-border bg-surface p-1 xl:hidden"
            >
              {(['text', 'tasks'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={pane === name}
                  onClick={() => setPane(name)}
                  className={cn(
                    'h-9 rounded-[7px] text-sm transition-colors duration-150',
                    pane === name ? 'bg-surface-2 font-medium text-accent' : 'text-muted',
                  )}
                >
                  {t(name === 'text' ? 'reading.textTab' : 'reading.questionsTab')}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              'grid gap-6',
              showAside && 'xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start',
            )}
          >
            <section
              aria-label={t('reading.textTab')}
              className={cn('min-w-0', showAside && pane !== 'text' && 'hidden xl:block')}
            >
              {inImmersion ? (
                <div className="mx-auto mb-5 flex max-w-[68ch] flex-col gap-3">
                  <p className="text-sm text-muted">{t('reading.readHint')}</p>
                  <p className="hud flex items-center gap-2 text-sm text-muted">
                    <Timer aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    <span className="sr-only">{t('reading.readingTime')}: </span>
                    {formatClock(readMs)}
                  </p>
                </div>
              ) : null}

              {paper ? (
                <div data-theme="paper" className="rounded-panel p-5 sm:p-8">
                  {text}
                </div>
              ) : (
                text
              )}

              {inImmersion ? (
                <div className="mx-auto mt-8 flex max-w-[68ch] justify-end">
                  <Button size="lg" disabled={saving} onClick={finishReading}>
                    {t('reading.finishedReading')}
                  </Button>
                </div>
              ) : null}
            </section>

            {showAside ? (
              <aside
                className={cn('min-w-0 xl:sticky xl:top-6', pane !== 'tasks' && 'hidden xl:block')}
              >
                {phase === PHASE.skim ? (
                  <Panel className="flex flex-col gap-4">
                    <TaskRunner
                      tasks={skimTasks}
                      onChecked={handleChecked}
                      onDone={() => void advance(PHASE.read)}
                      onShowEvidence={showEvidence}
                      doneLabel={t('common.continue')}
                      busy={saving}
                    />
                  </Panel>
                ) : null}

                {phase === PHASE.questions ? (
                  <Panel className="flex flex-col gap-4">
                    <p className="text-sm text-muted">{t('reading.questionsHint')}</p>
                    <TaskRunner
                      tasks={readTasks}
                      onChecked={handleChecked}
                      onDone={() => void advance(PHASE.focus)}
                      onShowEvidence={showEvidence}
                      doneLabel={t('common.continue')}
                      busy={saving}
                    />
                  </Panel>
                ) : null}

                {phase === PHASE.focus ? (
                  <Panel className="flex flex-col gap-5">
                    <p className="text-sm text-muted">{t('reading.focusHint')}</p>
                    {lesson.language_focus.map((focus) => (
                      <div key={focus.title_es} className="flex flex-col gap-2">
                        <h3 className="font-medium">{focus.title_es}</h3>
                        <p className="text-sm text-muted">
                          <InlineText text={focus.explanation_es} />
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          onClick={() => showEvidence(focus.refs)}
                        >
                          {t('tasks.showEvidence')}
                        </Button>
                      </div>
                    ))}
                    {postTasks.length > 0 ? (
                      <TaskRunner
                        tasks={postTasks}
                        onChecked={handleChecked}
                        onDone={() => void advance(PHASE.result)}
                        onShowEvidence={showEvidence}
                        doneLabel={t('reading.seeResult')}
                        busy={saving}
                      />
                    ) : (
                      <Button
                        size="lg"
                        disabled={saving}
                        onClick={() => void advance(PHASE.result)}
                      >
                        {t('reading.seeResult')}
                      </Button>
                    )}
                  </Panel>
                ) : null}

                {phase === PHASE.result ? (
                  <Panel className="flex flex-col gap-5">
                    <PanelTitle>{t('lesson.resultTitle')}</PanelTitle>

                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-muted">{t('lesson.scoreLabel')}</dt>
                        <dd className="hud text-3xl">
                          {finalScore === null ? '—' : `${toPercent(finalScore)} %`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted">{t('reading.speedLabel')}</dt>
                        <dd className="hud text-3xl">
                          {wpm === null ? '—' : t('lesson.wpm', { n: wpm })}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-sm text-muted">
                      {wpm === null
                        ? t('reading.speedUnknown')
                        : t('reading.speedTarget', {
                            level: lesson.level,
                            min: target.min,
                            max: target.max,
                          })}
                      {' · '}
                      {t('lesson.timeLabel')}: <span className="hud">{formatClock(activeMs)}</span>
                    </p>

                    {scored.length > 0 ? (
                      <div>
                        <h3 className="text-sm font-medium">{t('lesson.byFocus')}</h3>
                        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                          {byFocus(scored).map((group) => (
                            <li key={group.focus} className="flex justify-between gap-3">
                              <span className="text-muted">
                                {t(`focus.${group.focus}` as TranslationKey)}
                              </span>
                              <span className="hud">
                                {t('lesson.focusScore', { hits: group.hits, total: group.total })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {missed.length > 0 ? (
                      <div>
                        <h3 className="text-sm font-medium">{t('lesson.missedTitle')}</h3>
                        <ul className="mt-2 flex flex-col gap-3">
                          {missed.map(({ task }) => (
                            <li key={task.id} className="flex flex-col gap-1 text-sm">
                              <span lang="en" className="font-medium">
                                {task.prompt}
                              </span>
                              <span className="text-muted">
                                <InlineText text={task.rationale_es} />
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="self-start"
                                onClick={() => showEvidence(task.evidence)}
                              >
                                {t('tasks.showEvidence')}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : scored.length > 0 ? (
                      <p className="text-sm text-success">{t('lesson.allCorrect')}</p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {error ? (
                        <Button
                          disabled={saving}
                          onClick={() => void save({ phase: PHASE.result, completed: true })}
                        >
                          {saving ? t('lesson.saving') : t('common.retry')}
                        </Button>
                      ) : null}
                      <Link href="/leer" className={buttonVariants({ variant: 'secondary' })}>
                        {t('lesson.backToLibrary')}
                      </Link>
                    </div>
                  </Panel>
                ) : null}
              </aside>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
