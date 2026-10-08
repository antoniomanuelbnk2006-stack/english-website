'use client';

import { ArrowLeft, CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Chip, Panel, PanelTitle, Skeleton } from '@/components/ui/panel';
import { PhaseStepper } from '@/components/ui/phase-stepper';
import { useLessonSession } from '@/features/lessons/components/use-lesson-session';
import { useLexiconSession } from '@/features/lexicon/components/use-lexicon-session';
import { recordExposure } from '@/features/lexicon/server/actions';
import { formatClock, meanScore, toPercent } from '@/features/lessons/lib/summary';
import type { Cause } from '@/features/listening/lib/dictation';
import type { ListeningIntro } from '@/features/listening/lib/views';
import {
  getTranscript,
  openWithTranscript,
  saveDiagnostics,
  saveSelfRating,
  type TranscriptPayload,
} from '@/features/listening/server/actions';
import { HarvestPanel } from '@/features/srs/components/harvest-panel';
import { TaskRunner, type CheckedTask } from '@/features/tasks/components/task-runner';
import { audioUrl } from '@/lib/audio/segments';
import { player, usePlayer } from '@/lib/audio/store';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { AudioPlayer } from './audio-player';
import {
  CAUSE_LABEL,
  DictationStep,
  type DictationContext,
  type DictationResult,
} from './dictation-step';
import { Transcript } from './transcript';

const PHASE = {
  prepare: 0,
  global: 1,
  detail: 2,
  diagnosis: 3,
  transcript: 4,
  training: 5,
  final: 6,
  result: 7,
} as const;

const PHASE_LABELS: TranslationKey[] = [
  'listening.phasePrepare',
  'listening.phaseGlobal',
  'listening.phaseDetail',
  'listening.phaseDiagnosis',
  'listening.phaseTranscript',
  'listening.phaseTraining',
  'listening.phaseFinal',
  'listening.phaseResult',
];

export interface ListeningLessonProps {
  intro: ListeningIntro;
  unitTitle: string;
  /** Base pública del audio (R2 o /dev-audio). */
  audioBase: string;
  initialPhase: number;
  previous: { score: number | null; version: number } | null;
  playbackRate: number;
  /** Fichas de gramática que existen para las estructuras de esta lección. */
  grammar: { id: string; title: string }[];
  /** Ya se abrió esta lección con transcripción antes de las dos escuchas a ciegas. */
  transcriptSeen: boolean;
}

async function fetchTranscript(lessonId: string): Promise<TranscriptPayload | null> {
  try {
    const result = await getTranscript({ lessonId });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

/** «¿Cuánto entiendes?» de 0 a 100 en pasos de 10. */
function SelfRating({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={10}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-11 w-full max-w-xs accent-accent"
        />
        <output htmlFor={id} className="hud w-14 text-sm">
          {t('listening.selfRatingValue', { n: value })}
        </output>
      </div>
    </div>
  );
}

export function ListeningLesson({
  intro,
  unitTitle,
  audioBase,
  initialPhase,
  previous,
  playbackRate,
  grammar,
  transcriptSeen,
}: ListeningLessonProps) {
  const t = useT();
  const { clock, record, save, saving, error, serverScore } = useLessonSession(intro);
  const lex = useLexiconSession(intro.id);
  const loadLexicon = lex.load;
  const playing = usePlayer((state) => state.playing);

  const globalTasks = useMemo(() => intro.tasks.filter((x) => x.phase === 'listen_1'), [intro]);
  const detailTasks = useMemo(() => intro.tasks.filter((x) => x.phase === 'listen_2'), [intro]);

  const [phase, setPhase] = useState(() =>
    initialPhase > PHASE.prepare && initialPhase < PHASE.result ? initialPhase : PHASE.prepare,
  );
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [transcriptError, setTranscriptError] = useState(false);
  const [checked, setChecked] = useState<CheckedTask[]>([]);
  const [dictations, setDictations] = useState<DictationResult[]>([]);
  const [tasksDone, setTasksDone] = useState(false);
  const [selfInitial, setSelfInitial] = useState(50);
  const [selfFinal, setSelfFinal] = useState(50);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [activeMs, setActiveMs] = useState(0);
  // Modo «con transcripción» (ADR-0013): fuera del ciclo a ciegas, con el texto a la vista.
  const [assisted, setAssisted] = useState<'off' | 'on' | 'done'>('off');
  const [seenBefore, setSeenBefore] = useState(transcriptSeen);
  const [opening, setOpening] = useState(false);

  // Un único elemento de audio para toda la lección.
  useEffect(() => {
    player.load(audioUrl(audioBase, intro.audio.src), intro.segments, playbackRate);
    return () => player.dispose();
  }, [audioBase, intro.audio.src, intro.segments, playbackRate]);

  // El audio sonando cuenta como tiempo activo aunque no se toque nada.
  useEffect(() => {
    clock.setPlaying(playing);
  }, [clock, playing]);

  // Al retomar una lección a medias a partir del diagnóstico, hace falta la transcripción.
  useEffect(() => {
    if (phase < PHASE.diagnosis || transcript || transcriptError) return;
    let cancelled = false;
    void fetchTranscript(intro.id).then((data) => {
      if (cancelled) return;
      if (data) {
        setTranscript(data);
        loadLexicon(data.lexicon);
      } else {
        setTranscriptError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, transcript, transcriptError, intro.id, loadLexicon]);

  async function loadTranscript(): Promise<boolean> {
    const data = await fetchTranscript(intro.id);
    setTranscript(data);
    setTranscriptError(data === null);
    if (data) loadLexicon(data.lexicon);
    return data !== null;
  }

  function goTo(next: number) {
    player.pause();
    setTasksDone(false);
    setHighlight([]);
    if (next === PHASE.result) setActiveMs(clock.total());
    setPhase(next);
    window.scrollTo({ top: 0 });
  }

  async function advance(next: number) {
    await save({ phase: next, completed: next === PHASE.result });
    goTo(next);
  }

  /** El usuario elige ver el texto desde el principio: el servidor lo anota y lo entrega. */
  async function startAssisted() {
    setOpening(true);
    setTranscriptError(false);
    const result = await openWithTranscript({ lessonId: intro.id }).catch(() => null);
    setOpening(false);
    if (!result?.ok) {
      setTranscriptError(true);
      return;
    }
    setTranscript(result.data);
    loadLexicon(result.data.lexicon);
    setSeenBefore(true);
    setAssisted('on');
    window.scrollTo({ top: 0 });
  }

  /** Fin de la escucha con texto: se anota el tiempo, sin tocar la fase del ciclo a ciegas. */
  async function finishAssisted() {
    player.pause();
    await save({ phase: PHASE.prepare });
    setActiveMs(clock.total());
    setAssisted('done');
    window.scrollTo({ top: 0 });
  }

  function handleChecked(item: CheckedTask) {
    record(item);
    setChecked((all) => [...all.filter((c) => c.task.id !== item.task.id), item]);
  }

  /** Tras las dos escuchas: se guarda el progreso y solo entonces se pide la transcripción. */
  async function finishDetail() {
    const saved = await save({ phase: PHASE.diagnosis });
    if (!saved) return;
    if (await loadTranscript()) {
      goTo(intro.dictationCount > 0 ? PHASE.diagnosis : PHASE.transcript);
    }
  }

  function handleDictation(result: DictationResult) {
    record({
      task: result.task,
      response: { type: 'dictation', text: result.typed },
      result: {
        score: result.accuracy,
        correct: result.accuracy === 1,
        parts: { answer: result.accuracy === 1 },
      },
      durationMs: result.durationMs,
    });
  }

  async function finishDiagnosis(results: DictationResult[]) {
    setDictations(results);
    const items = results.flatMap((result) =>
      result.failures.map((failure) => ({
        segmentId: result.task.segment,
        cause: failure.cause,
        causeSource: failure.source,
        expected: failure.expected,
        typed: failure.typed,
        playbackRate: result.playbackRate,
      })),
    );
    if (items.length > 0) void saveDiagnostics({ lessonId: intro.id, items });
    await advance(PHASE.transcript);
  }

  async function finishLesson() {
    void saveSelfRating({ lessonId: intro.id, moment: 'final', value: selfFinal });
    const saved = await save({ phase: PHASE.result, completed: true });
    // Al completar: lo consultado entra en el léxico y cuenta la promoción implícita.
    if (saved) {
      void recordExposure({
        lessonId: intro.id,
        lookedUp: [...lex.marked],
        failed: failedLemmas,
      });
    }
    goTo(PHASE.result);
  }

  const dictationContext = useMemo((): DictationContext | null => {
    if (!transcript) return null;
    const accentOf = new Map(intro.speakers.map((speaker) => [speaker.id, speaker.accent]));
    return {
      segmentIndex: new Map(intro.segments.map((segment, index) => [segment.id, index])),
      knownLemmas: new Set(transcript.knownLemmas),
      lemmas: new Map(
        transcript.segments.map((segment) => [
          segment.id,
          Object.fromEntries(segment.tokens.map((token) => [token.t.toLowerCase(), token.l])),
        ]),
      ),
      features: new Map(
        transcript.segments.map((segment) => [
          segment.id,
          transcript.connectedSpeech.filter((f) => f.ref === segment.id).map((f) => f.type),
        ]),
      ),
      accents: new Map(
        transcript.segments.map((segment) => [
          segment.id,
          accentOf.get(segment.speaker) ?? 'en-US',
        ]),
      ),
    };
  }, [transcript, intro]);

  const score = (tasks: readonly CheckedTask[]) =>
    meanScore(tasks.map((c) => ({ id: c.task.id, focus: c.task.focus, score: c.result.score })));
  const firstListen = score(checked.filter((c) => c.task.phase === 'listen_1'));
  const overall = score(checked);
  const dictationScore =
    dictations.length > 0
      ? dictations.reduce((sum, d) => sum + d.accuracy, 0) / dictations.length
      : null;
  const failed = dictations.filter((d) => d.failures.length > 0);
  const causeCounts = new Map<Cause, number>();
  for (const failure of dictations.flatMap((d) => d.failures)) {
    causeCounts.set(failure.cause, (causeCounts.get(failure.cause) ?? 0) + 1);
  }

  const failures = useMemo(
    () =>
      dictations.flatMap((d) =>
        d.failures.map((failure) => ({ segmentId: d.task.segment, cause: failure.cause })),
      ),
    [dictations],
  );
  /** Lemas de las palabras falladas en el dictado: rompen su racha de «vista sin consultar». */
  const failedLemmas = dictations.flatMap((d) => {
    const lemmas = dictationContext?.lemmas.get(d.task.segment) ?? {};
    return d.failures.flatMap((failure) =>
      failure.expected.split(' ').map((word) => lemmas[word] ?? word),
    );
  });
  const segmentText = (segmentId: string) =>
    transcript?.segments.find((segment) => segment.id === segmentId)?.text;

  const blind = assisted === 'off';
  const showPlayer = blind ? phase >= PHASE.global && phase <= PHASE.final : assisted === 'on';
  const needsTranscript = blind && phase >= PHASE.diagnosis && phase < PHASE.result;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/escuchar"
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('lesson.back')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 lang="en" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {intro.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="hud">{intro.level}</Chip>
            <Chip className="hud">{formatClock(intro.audio.duration_s * 1000)}</Chip>
            <Chip className="hud">{t('lesson.wpm', { n: Math.round(intro.audio.wpm) })}</Chip>
          </div>
        </div>
        {blind ? (
          <PhaseStepper
            phases={PHASE_LABELS.map((key) => t(key))}
            current={phase}
            label={t('lesson.phaseOf', { n: phase + 1, total: PHASE_LABELS.length })}
          />
        ) : (
          <Chip className="self-start border-accent text-accent">
            {t('listening.modeTranscript')}
          </Chip>
        )}
      </header>

      {error || transcriptError ? (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
          {error ? t(error) : t('listening.transcriptUnavailable')}
          {transcriptError ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // En las fases con texto, quitar el error vuelve a pedirlo (ver el efecto).
                if (phase === PHASE.detail) void finishDetail();
                else if (phase === PHASE.prepare) void startAssisted();
                else setTranscriptError(false);
              }}
            >
              {t('common.retry')}
            </Button>
          ) : null}
        </p>
      ) : null}

      {blind && phase === PHASE.prepare ? (
        <Panel className="flex max-w-2xl flex-col gap-5">
          <div>
            <PanelTitle>{unitTitle}</PanelTitle>
            <p className="mt-2">{intro.summary_es}</p>
          </div>
          {previous?.score != null ? (
            <p className="text-sm text-muted">
              {t('lesson.lastResult', { pct: toPercent(previous.score) })}
              {previous.version !== intro.version ? ` ${t('lesson.newVersion')}` : ''}
            </p>
          ) : null}
          <div>
            <PanelTitle>{t('listening.speakers')}</PanelTitle>
            <ul className="mt-2 flex flex-wrap gap-2">
              {intro.speakers.map((speaker) => (
                <li key={speaker.id}>
                  <Chip>
                    {speaker.name} · <span className="hud ml-1">{speaker.accent}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
          {intro.prediction_prompt ? (
            <div>
              <PanelTitle>{t('listening.beforeListening')}</PanelTitle>
              <p lang="en" className="reading-md mt-2">
                {intro.prediction_prompt}
              </p>
            </div>
          ) : null}
          {intro.preTeach.length > 0 ? (
            <div>
              <PanelTitle>{t('listening.keyWords')}</PanelTitle>
              <dl className="mt-2 flex flex-col gap-2">
                {intro.preTeach.map((entry) => (
                  <div key={entry.word}>
                    <dt lang="en" className="font-medium text-accent">
                      {entry.word}
                    </dt>
                    {entry.def_en ? (
                      <dd className="text-sm text-muted">
                        <span lang="en">{entry.def_en}</span> — {entry.def_es}
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <PanelTitle>{t('listening.modeTitle')}</PanelTitle>
            {seenBefore ? (
              <p className="text-sm text-warning">{t('listening.modeSeenBefore')}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-control border border-border bg-surface-2 p-4">
                <div>
                  <h3 className="font-medium">{t('listening.modeBlind')}</h3>
                  <p className="mt-1 text-sm text-muted">{t('listening.modeBlindBody')}</p>
                </div>
                <Button
                  size="lg"
                  className="mt-auto"
                  disabled={saving || opening}
                  onClick={() => void advance(PHASE.global)}
                >
                  {t('listening.startListening')}
                </Button>
              </div>
              <div className="flex flex-col gap-3 rounded-control border border-border bg-surface-2 p-4">
                <div>
                  <h3 className="font-medium">{t('listening.modeTranscript')}</h3>
                  <p className="mt-1 text-sm text-muted">{t('listening.modeTranscriptBody')}</p>
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  className="mt-auto"
                  disabled={saving || opening}
                  onClick={() => void startAssisted()}
                >
                  {t('listening.startWithTranscript')}
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {showPlayer ? (
        <AudioPlayer peaks={intro.audio.peaks} duration={intro.audio.duration_s} />
      ) : null}

      {blind && phase === PHASE.global ? (
        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('listening.globalHint')}</p>
          {tasksDone || globalTasks.length === 0 ? (
            <>
              <SelfRating
                id="self-initial"
                label={t('listening.selfRatingInitial')}
                value={selfInitial}
                onChange={setSelfInitial}
              />
              <Button
                size="lg"
                className="self-start"
                disabled={saving}
                onClick={() => {
                  void (async () => {
                    await advance(PHASE.detail);
                    void saveSelfRating({
                      lessonId: intro.id,
                      moment: 'initial',
                      value: selfInitial,
                    });
                  })();
                }}
              >
                {t('common.continue')}
              </Button>
            </>
          ) : (
            <TaskRunner
              tasks={globalTasks}
              onChecked={handleChecked}
              onDone={() => setTasksDone(true)}
              doneLabel={t('common.continue')}
              busy={saving}
            />
          )}
        </Panel>
      ) : null}

      {blind && phase === PHASE.detail ? (
        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('listening.detailHint')}</p>
          {detailTasks.length > 0 ? (
            <TaskRunner
              tasks={detailTasks}
              onChecked={handleChecked}
              onDone={() => void finishDetail()}
              doneLabel={t('common.continue')}
              busy={saving}
            />
          ) : (
            <Button
              size="lg"
              className="self-start"
              disabled={saving}
              onClick={() => void finishDetail()}
            >
              {t('common.continue')}
            </Button>
          )}
        </Panel>
      ) : null}

      {needsTranscript && !transcript && !transcriptError ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : null}

      {phase === PHASE.diagnosis && transcript && dictationContext ? (
        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('listening.diagnosisHint')}</p>
          <DictationStep
            tasks={transcript.dictations}
            context={dictationContext}
            onChecked={handleDictation}
            onDone={(results) => void finishDiagnosis(results)}
            busy={saving}
          />
        </Panel>
      ) : null}

      {phase === PHASE.transcript && transcript ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <Panel className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('listening.transcriptHint')}</p>
            <p className="text-sm text-muted">{t('lexicon.helpHint')}</p>
            <Transcript
              segments={transcript.segments}
              speakers={intro.speakers}
              features={transcript.connectedSpeech}
              highlight={highlight}
              words={{ lexicon: lex, glossary: transcript.glossary }}
            />
          </Panel>
          <Panel className="flex flex-col gap-4 xl:sticky xl:top-6">
            {checked.length > 0 ? (
              <>
                <PanelTitle>{t('listening.reviewQuestions')}</PanelTitle>
                <ul className="flex flex-col gap-4">
                  {checked.map(({ task, result }) => (
                    <li key={task.id} className="flex flex-col gap-1 text-sm">
                      <span className="flex items-start gap-2">
                        {result.correct ? (
                          <CircleCheck
                            aria-label={t('tasks.correct')}
                            className="mt-0.5 size-4 shrink-0 text-success"
                            strokeWidth={2}
                          />
                        ) : (
                          <CircleX
                            aria-label={t('tasks.incorrect')}
                            className="mt-0.5 size-4 shrink-0 text-danger"
                            strokeWidth={2}
                          />
                        )}
                        <span lang="en" className="font-medium">
                          {task.prompt}
                        </span>
                      </span>
                      <span className="text-muted">
                        <InlineText text={transcript.rationales[task.id] ?? ''} />
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          setHighlight(task.evidence);
                          const first = intro.segments.find((s) => s.id === task.evidence[0]);
                          if (first) player.seek(first.start);
                        }}
                      >
                        {t('listening.whereItWas')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <Button size="lg" disabled={saving} onClick={() => void advance(PHASE.training)}>
              {t('common.continue')}
            </Button>
          </Panel>
        </div>
      ) : null}

      {phase === PHASE.training && transcript ? (
        <Panel className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            {failed.length > 0 ? t('listening.trainingHint') : t('listening.trainingNone')}
          </p>
          {failed.map(({ task }) => {
            const index = intro.segments.findIndex((segment) => segment.id === task.segment);
            const features = transcript.connectedSpeech.filter((f) => f.ref === task.segment);
            const playAt = (rate: number) => {
              player.setRate(rate);
              player.playSegment(index);
            };
            return (
              <div key={task.id} className="flex flex-col gap-2 border-t border-border pt-4">
                <p lang="en" className="reading-md">
                  {task.reference}
                </p>
                {features.map((feature) => (
                  <p key={feature.phrase} className="text-sm text-muted">
                    <span lang="en" className="font-medium text-text">
                      {feature.phrase}
                    </span>
                    {feature.ipa ? <span className="hud"> {feature.ipa}</span> : null}
                    {' — '}
                    <InlineText text={feature.explanation_es} />
                  </p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => playAt(0.75)}>
                    {t('listening.playSlow')}
                  </Button>
                  <Button variant="secondary" onClick={() => playAt(1)}>
                    {t('listening.playNormal')}
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            size="lg"
            className="self-start"
            disabled={saving}
            onClick={() => {
              player.setRate(playbackRate);
              void advance(PHASE.final);
            }}
          >
            {t('common.continue')}
          </Button>
        </Panel>
      ) : null}

      {phase === PHASE.final ? (
        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('listening.finalHint')}</p>
          <SelfRating
            id="self-final"
            label={t('listening.selfRatingFinal')}
            value={selfFinal}
            onChange={setSelfFinal}
          />
          <Button
            size="lg"
            className="self-start"
            disabled={saving}
            onClick={() => void finishLesson()}
          >
            {t('listening.seeResult')}
          </Button>
        </Panel>
      ) : null}

      {phase === PHASE.result ? (
        <Panel className="flex flex-col gap-5">
          <PanelTitle>{t('lesson.resultTitle')}</PanelTitle>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ['listening.firstListen', firstListen],
                ['listening.overall', serverScore ?? overall],
                ['listening.dictationScore', dictationScore],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{t(label)}</dt>
                <dd className="hud text-3xl">{value === null ? '—' : `${toPercent(value)} %`}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-muted">{t('lesson.timeLabel')}</dt>
              <dd className="hud text-3xl">{formatClock(activeMs)}</dd>
            </div>
          </dl>
          <p className="hud text-sm text-muted">
            {t('listening.improvement', { before: selfInitial, after: selfFinal })}
          </p>
          <div>
            <h3 className="text-sm font-medium">{t('listening.yourEar')}</h3>
            {causeCounts.size === 0 ? (
              <p className="mt-2 text-sm text-success">{t('listening.noFailures')}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {[...causeCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([cause, count]) => (
                    <li key={cause} className="flex justify-between gap-3">
                      <span className="text-muted">{t(CAUSE_LABEL[cause])}</span>
                      <span className="hud">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          {grammar.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium">{t('grammar.inThisLesson')}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {grammar.map((ficha) => (
                  <li key={ficha.id}>
                    <Link
                      href={`/gramatica/${ficha.id}`}
                      lang="en"
                      className="text-accent underline underline-offset-4"
                    >
                      {ficha.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {transcript ? (
            <HarvestPanel
              skill="listening"
              lexicon={lex}
              glossary={transcript.glossary}
              failures={failures}
              segmentText={segmentText}
            />
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
            <Link href="/escuchar" className={buttonVariants({ variant: 'secondary' })}>
              {t('lesson.backToLibrary')}
            </Link>
          </div>
        </Panel>
      ) : null}

      {assisted === 'on' && transcript ? (
        <Panel className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('listening.assistedHint')}</p>
          <p className="text-sm text-muted">{t('lexicon.helpHint')}</p>
          <Transcript
            segments={transcript.segments}
            speakers={intro.speakers}
            features={transcript.connectedSpeech}
            words={{ lexicon: lex, glossary: transcript.glossary }}
          />
          <Button
            size="lg"
            className="self-start"
            disabled={saving}
            onClick={() => void finishAssisted()}
          >
            {t('listening.assistedDone')}
          </Button>
        </Panel>
      ) : null}

      {assisted === 'done' && transcript ? (
        <Panel className="flex flex-col gap-5">
          <PanelTitle>{t('listening.assistedResult')}</PanelTitle>
          <dl>
            <dt className="text-sm text-muted">{t('lesson.timeLabel')}</dt>
            <dd className="hud text-3xl">{formatClock(activeMs)}</dd>
          </dl>
          <p className="text-sm text-muted">{t('listening.assistedNote')}</p>
          <HarvestPanel skill="listening" lexicon={lex} glossary={transcript.glossary} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAssisted('on')}>
              {t('listening.listenAgain')}
            </Button>
            <Button variant="outline" onClick={() => setAssisted('off')}>
              {t('listening.doBlindCycle')}
            </Button>
            <Link href="/escuchar" className={buttonVariants({ variant: 'ghost' })}>
              {t('lesson.backToLibrary')}
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
