'use client';

import { Eye, Mic, MicOff, SkipForward, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { BAND_LABEL } from '@/features/exams/lib/labels';
import { isPass, scaleBand, toScale, type ScaleBand } from '@/features/exams/lib/scale';
import { saveSpeakingExam } from '@/features/exams/server/actions';
import { formatClock } from '@/features/lessons/lib/summary';
import { canSpeak, speakText } from '@/features/pronunciation/lib/speech';
import { useContentLang, useContentLanguage } from '@/components/content-language';
import type {
  ExamSystem,
  ScaleTable,
  SpeakingCriterion,
  SpeakingKind,
} from '@/lib/content/exam-formats';
import type { SpeakingPart } from '@/lib/content/exam-schema';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export interface SpeakingFormat {
  system: ExamSystem;
  exam: string;
  minutes: number;
  parts: { kind: SpeakingKind; name: string; minutes: number }[];
  criteria: { key: SpeakingCriterion; weight: number }[];
  /** Tabla de conversión a la escala Cambridge y nota de aprobado; `null` si no hay escala. */
  scale: ScaleTable | null;
  pass: number | null;
}

type Phase = 'examiner' | 'prep' | 'answer';
type Stage = 'intro' | 'running' | 'review' | 'saved';

interface Result {
  marks: number;
  total: number;
  scale: number | null;
  band: ScaleBand | null;
}

const CRITERION: Record<SpeakingCriterion, { name: TranslationKey; hint: TranslationKey }> = {
  grammar_vocabulary: {
    name: 'exams.critGrammarVocabulary',
    hint: 'exams.critGrammarVocabularyHint',
  },
  grammatical_resource: { name: 'exams.critGrammar', hint: 'exams.critGrammarHint' },
  lexical_resource: { name: 'exams.critLexical', hint: 'exams.critLexicalHint' },
  discourse_management: { name: 'exams.critDiscourse', hint: 'exams.critDiscourseHint' },
  pronunciation: { name: 'exams.critPronunciation', hint: 'exams.critPronunciationHint' },
  interactive_communication: { name: 'exams.critInteraction', hint: 'exams.critInteractionHint' },
  global_achievement: { name: 'exams.critGlobal', hint: 'exams.critGlobalHint' },
  coherence: { name: 'exams.critCoherence', hint: 'exams.critCoherenceHint' },
  fluency: { name: 'exams.critFluency', hint: 'exams.critFluencyHint' },
  accuracy: { name: 'exams.critAccuracy', hint: 'exams.critAccuracyHint' },
  range: { name: 'exams.critRange', hint: 'exams.critRangeHint' },
  holistic: { name: 'exams.critHolistic', hint: 'exams.critHolisticHint' },
};

const BANDS = [0, 1, 2, 3, 4, 5];
const subscribeNothing = () => () => undefined;

/** Lo que tarda el examinador en decir una frase, por si la voz del navegador no avisa al acabar. */
const speechMs = (text: string) => 2500 + text.split(/\s+/).length * 450;

/**
 * Simulador de la prueba de Speaking: el examinador pregunta en voz alta, corre el tiempo de
 * cada turno y el micrófono graba la respuesta para escucharla después. Las grabaciones no
 * salen del navegador. Al final, la nota la pone el propio usuario con los criterios del examen.
 */
export function SpeakingRunner({
  paperId,
  version,
  parts,
  format,
}: {
  paperId: string;
  version: number;
  parts: SpeakingPart[];
  format: SpeakingFormat;
}) {
  const t = useT();
  const language = useContentLanguage();
  const lang = useContentLang();
  const turns = useMemo(
    () => parts.flatMap((part, partIndex) => part.turns.map((turn) => ({ part: partIndex, turn }))),
    [parts],
  );

  const [stage, setStage] = useState<Stage>('intro');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('examiner');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [clips, setClips] = useState<Record<number, string>>({});
  const [ratings, setRatings] = useState<Partial<Record<SpeakingCriterion, number>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const sitting = useRef<{ id: string; startedAt: number } | null>(null);
  const controls = useRef<{
    begin: () => Promise<void>;
    skip: () => void;
    finish: () => void;
  } | null>(null);
  // En el servidor (y al hidratar) se da por hecho que hay voz: el aviso solo sale si falta.
  const speaks = useSyncExternalStore(subscribeNothing, canSpeak, () => true);

  // El motor de la prueba vive fuera del pintado: voz, cuentas atrás, micrófono y grabaciones.
  // Al salir de la página se para todo y se suelta el micrófono.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let at: { index: number; phase: Phase } = { index: 0, phase: 'examiner' };
    const urls: string[] = [];

    const stopRecording = () => {
      if (recorder?.state === 'recording') recorder.stop();
      recorder = null;
    };

    const record = (turnIndex: number) => {
      if (!stream || typeof MediaRecorder === 'undefined') return;
      try {
        const chunks: Blob[] = [];
        const instance = new MediaRecorder(stream);
        instance.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        instance.onstop = () => {
          if (!alive || chunks.length === 0) return;
          const url = URL.createObjectURL(new Blob(chunks, { type: instance.mimeType }));
          urls.push(url);
          setClips((current) => ({ ...current, [turnIndex]: url }));
        };
        instance.start();
        recorder = instance;
      } catch {
        recorder = null;
      }
    };

    const finish = () => {
      window.clearTimeout(timer);
      if (canSpeak()) window.speechSynthesis.cancel();
      stopRecording();
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      setEndsAt(null);
      setStage('review');
    };

    /** Pasa a una fase de un turno y pone en marcha lo que le toca (voz, cuenta atrás, grabación). */
    const enter = (turnIndex: number, next: Phase) => {
      if (!alive) return;
      window.clearTimeout(timer);
      const item = turns[turnIndex];
      if (!item) {
        finish();
        return;
      }
      const { turn } = item;
      at = { index: turnIndex, phase: next };
      setIndex(turnIndex);
      setPhase(next);

      if (next === 'examiner') {
        setRevealed(false);
        setEndsAt(null);
        let moved = false;
        const go = () => {
          if (moved) return;
          moved = true;
          enter(turnIndex, turn.prep_s ? 'prep' : 'answer');
        };
        const spoken = speakText(turn.examiner, {
          accent: 'en-GB',
          language,
          rate: 0.95,
          onEnd: go,
        });
        // Sin voz, se deja tiempo para leer; con voz, un margen por si no avisa al terminar.
        timer = window.setTimeout(go, speechMs(turn.examiner) * (spoken ? 2 : 1));
      } else if (next === 'prep') {
        const seconds = turn.prep_s ?? 0;
        setEndsAt(Date.now() + seconds * 1000);
        timer = window.setTimeout(() => enter(turnIndex, 'answer'), seconds * 1000);
      } else {
        record(turnIndex);
        setEndsAt(Date.now() + turn.answer_s * 1000);
        timer = window.setTimeout(() => {
          stopRecording();
          enter(turnIndex + 1, 'examiner');
        }, turn.answer_s * 1000);
      }
    };

    controls.current = {
      async begin() {
        sitting.current = { id: crypto.randomUUID(), startedAt: Date.now() };
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicOk(true);
        } catch {
          // Sin micrófono se puede hacer igual: corre el tiempo, pero no hay grabación.
          stream = null;
          setMicOk(false);
        }
        if (!alive) {
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }
        setNow(Date.now());
        setStage('running');
        enter(0, 'examiner');
      },
      skip() {
        if (at.phase === 'answer') {
          stopRecording();
          enter(at.index + 1, 'examiner');
        } else {
          if (canSpeak()) window.speechSynthesis.cancel();
          const prep = at.phase === 'examiner' && turns[at.index]?.turn.prep_s;
          enter(at.index, prep ? 'prep' : 'answer');
        }
      },
      finish,
    };

    return () => {
      alive = false;
      controls.current = null;
      window.clearTimeout(timer);
      if (canSpeak()) window.speechSynthesis.cancel();
      stopRecording();
      stream?.getTracks().forEach((track) => track.stop());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [turns, language]);

  useEffect(() => {
    if (stage !== 'running') return;
    const ticker = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(ticker);
  }, [stage]);

  async function save() {
    if (!sitting.current) return;
    setBusy(true);
    setFailed(false);
    const response = await saveSpeakingExam({
      paperId,
      version,
      sitting: sitting.current.id,
      ratings,
      durationMs: Math.min(Date.now() - sitting.current.startedAt, 10_800_000),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    const { marks, total } = response.data;
    const scale =
      format.scale && format.pass !== null ? toScale(format.scale, marks, format.pass) : null;
    setResult({
      marks,
      total,
      scale,
      band: format.pass === null || !format.scale ? null : scaleBand(scale, format.pass),
    });
    setStage('saved');
  }

  if (stage === 'intro') {
    const seconds = turns.reduce(
      (sum, { turn }) => sum + (turn.prep_s ?? 0) + turn.answer_s + speechMs(turn.examiner) / 1000,
      0,
    );
    return (
      <Panel className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-body-lg font-medium">
          <Mic aria-hidden="true" className="size-5 text-accent-text" strokeWidth={1.75} />
          {t('exams.speakingIntroTime', {
            official: format.minutes,
            min: Math.round(seconds / 60),
          })}
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-muted">
          {(
            [
              'exams.speakingRuleVoice',
              'exams.speakingRuleTime',
              'exams.speakingRuleMic',
              'exams.speakingRuleSelf',
            ] as const
          ).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
          {speaks ? null : (
            <li className="text-warning">
              {t(format.system === 'dele' ? 'exams.speakingNoVoiceDele' : 'exams.speakingNoVoice')}
            </li>
          )}
        </ul>
        <ol className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {format.parts.map((part, partIndex) => (
            <li key={partIndex} className="flex flex-col gap-1 px-3 py-2 text-body-sm">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="tabular-nums w-16 shrink-0 text-muted">
                  {t('exams.part', { n: partIndex + 1 })}
                </span>
                <span lang={lang} className="min-w-0 flex-1 font-medium">
                  {part.name}
                </span>
                <span className="tabular-nums text-caption text-muted">
                  {t('lesson.minutes', { n: part.minutes })}
                </span>
              </span>
              <span className="text-muted">{parts[partIndex]?.about_es}</span>
            </li>
          ))}
        </ol>
        <Button size="lg" className="self-start" onClick={() => void controls.current?.begin()}>
          {t('exams.start')}
        </Button>
      </Panel>
    );
  }

  if (stage === 'running') {
    const item = turns[index];
    if (!item) return null;
    const { turn, part } = item;
    const left = endsAt === null ? null : Math.max(0, endsAt - now);
    const showText = revealed || !speaks || turn.shown !== undefined || phase !== 'examiner';
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-subheading">
            {t('exams.part', { n: part + 1 })}
            <span lang={lang} className="ml-2 font-normal text-muted">
              {format.parts[part]?.name}
            </span>
          </h2>
          <span className="tabular-nums text-body-sm text-muted">
            {t('exams.turn', { n: index + 1, total: turns.length })}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-caption text-muted">
            {micOk ? (
              <Mic aria-hidden="true" className="size-4 text-success" strokeWidth={2} />
            ) : (
              <MicOff aria-hidden="true" className="size-4 text-warning" strokeWidth={2} />
            )}
            {t(micOk ? 'exams.micOn' : 'exams.micOff')}
          </span>
        </div>

        <Panel className="flex flex-col gap-4">
          <p role="status" className="flex items-center gap-2 text-body-sm font-medium">
            {phase === 'examiner' ? (
              <>
                <Volume2 aria-hidden="true" className="size-4 text-accent-text" strokeWidth={2} />
                {t('exams.examinerSpeaking')}
              </>
            ) : phase === 'prep' ? (
              t('exams.lookAtTask')
            ) : (
              <>
                <span aria-hidden="true" className="size-2.5 rounded-full bg-error" />
                {t('exams.yourTurn')}
              </>
            )}
            {left !== null ? (
              <span
                role="timer"
                className={cn(
                  'tabular-nums ml-auto text-body-lg',
                  left <= 10_000 ? 'text-warning' : 'text-text',
                )}
              >
                {formatClock(left)}
              </span>
            ) : null}
          </p>

          {showText ? (
            <p lang={lang} className="prose-reading">
              {turn.examiner}
            </p>
          ) : (
            <Button variant="ghost" className="self-start" onClick={() => setRevealed(true)}>
              <Eye aria-hidden="true" strokeWidth={2} />
              {t('exams.showQuestion')}
            </Button>
          )}

          {turn.shown ? (
            <p
              lang={lang}
              className="rounded-card border border-accent bg-surface-2 px-4 py-3 font-medium"
            >
              {turn.shown}
            </p>
          ) : null}
          {turn.visuals ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {turn.visuals.map((visual) => (
                <li
                  key={visual.label}
                  className="flex flex-col gap-1 rounded-card bg-surface-2 px-4 py-3"
                >
                  <span lang={lang} className="tabular-nums text-caption text-accent-text">
                    {visual.label}
                  </span>
                  <span lang={lang}>{visual.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {turn.prompts ? (
            <ul className="flex flex-wrap gap-2">
              {turn.prompts.map((prompt) => (
                <li key={prompt} lang={lang} className="tag min-h-8 px-3 text-body-sm text-text">
                  {prompt}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => controls.current?.skip()}>
            <SkipForward aria-hidden="true" strokeWidth={2} />
            {t(phase === 'answer' ? 'exams.endAnswer' : 'exams.skipWait')}
          </Button>
          <Button variant="ghost" onClick={() => controls.current?.finish()}>
            {t('exams.endTest')}
          </Button>
        </div>
      </div>
    );
  }

  const complete = format.criteria.every(({ key }) => ratings[key] !== undefined);

  return (
    <div className="flex flex-col gap-6">
      {stage === 'saved' && result ? (
        <Panel role="status" className="flex flex-col gap-2 border border-accent">
          <p className="tabular-nums text-heading-sm">
            {t('exams.speakingScore', { marks: result.marks, total: result.total })}
          </p>
          {result.band ? (
            <p className={cn('font-medium', isPass(result.band) ? 'text-success' : 'text-warning')}>
              {result.scale !== null ? `${t('exams.scaleLine', { scale: result.scale })} · ` : null}
              {t(BAND_LABEL[result.band])}
            </p>
          ) : null}
          <p className="text-body-sm text-muted">{t('exams.speakingSelfNote')}</p>
          <Link
            href="/examenes"
            className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}
          >
            {t('exams.backToIndex')}
          </Link>
        </Panel>
      ) : null}

      <section aria-labelledby="speaking-listen" className="flex flex-col gap-4">
        <h2 id="speaking-listen" className="text-subheading">
          {t('exams.listenBack')}
        </h2>
        {micOk === false ? (
          <p className="text-body-sm text-warning">{t('exams.noRecordings')}</p>
        ) : null}
        {parts.map((part, partIndex) => (
          <Panel key={partIndex} className="flex flex-col gap-4">
            <h3 className="font-medium">
              {t('exams.part', { n: partIndex + 1 })}
              <span lang={lang} className="ml-2 font-normal text-muted">
                {format.parts[partIndex]?.name}
              </span>
            </h3>
            <ol className="flex flex-col gap-4">
              {turns.map(({ part: owner, turn }, turnIndex) =>
                owner === partIndex ? (
                  <li key={turnIndex} className="flex flex-col gap-2">
                    <p lang={lang}>{turn.examiner}</p>
                    {turn.shown ? (
                      <p lang={lang} className="text-body-sm font-medium">
                        {turn.shown}
                      </p>
                    ) : null}
                    {clips[turnIndex] ? (
                      <audio
                        controls
                        src={clips[turnIndex]}
                        aria-label={t('exams.recordingOf', { n: turnIndex + 1 })}
                        className="h-10 w-full max-w-md"
                      />
                    ) : (
                      <p className="text-caption text-muted">{t('exams.noClip')}</p>
                    )}
                  </li>
                ) : null,
              )}
            </ol>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h4 className="text-body-sm font-medium text-muted">{t('exams.usefulLanguage')}</h4>
              <ul className="flex flex-wrap gap-2">
                {part.useful_language.map((phrase) => (
                  <li key={phrase} lang={lang} className="tag min-h-8 px-3 text-body-sm text-text">
                    {phrase}
                  </li>
                ))}
              </ul>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-muted">
                {part.tips_es.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </section>

      {stage === 'review' ? (
        <section aria-labelledby="speaking-assess" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="speaking-assess" className="text-subheading">
              {t('exams.selfAssess')}
            </h2>
            <p className="text-body-sm text-muted">{t('exams.selfAssessBody')}</p>
          </div>
          {format.criteria.map(({ key }) => (
            <fieldset key={key} className="flex flex-col gap-2">
              <legend className="font-medium">{t(CRITERION[key].name)}</legend>
              <p className="text-body-sm text-muted">{t(CRITERION[key].hint)}</p>
              <div className="flex flex-wrap gap-2">
                {BANDS.map((band) => (
                  <label
                    key={band}
                    className={cn(
                      'option size-11 cursor-pointer justify-center p-0',
                      ratings[key] === band && 'border-accent font-medium text-accent-text',
                    )}
                  >
                    <input
                      type="radio"
                      name={key}
                      className="sr-only"
                      checked={ratings[key] === band}
                      onChange={() => setRatings((current) => ({ ...current, [key]: band }))}
                    />
                    <span className="tabular-nums">{band}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-caption text-muted">{t('exams.bandLegend')}</p>
          {failed ? (
            <p role="alert" className="text-body-sm text-error">
              {t('errors.saveFailed')}
            </p>
          ) : null}
          <Button
            size="lg"
            className="self-start"
            disabled={busy || !complete}
            onClick={() => void save()}
          >
            {busy ? t('common.saving') : t('exams.saveAssessment')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
