'use client';

import { CircleCheck, CircleX, Layers, PartyPopper, Play, TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useContentLang, useContentLanguage } from '@/components/content-language';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Input, Label, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/page';
import { Chip, Panel } from '@/components/ui/panel';
import { splitPrompt } from '@/features/grammar/lib/practice';
import { formatClock, toPercent } from '@/features/lessons/lib/summary';
import { DictationDiff } from '@/features/listening/components/dictation-diff';
import { diagnoseBest, type Diagnosis } from '@/features/listening/lib/dictation';
import { splitAround, type CardContent, type CardKind } from '@/features/srs/lib/cards';
import {
  describeInterval,
  gradeForGrammar,
  GRADES,
  previewIntervals,
  review,
  REVIEW_BUDGET_MS,
  suggestAudioGrade,
  type Grade,
} from '@/features/srs/lib/scheduler';
import { submitReviews } from '@/features/srs/server/actions';
import type { ReviewCard, ReviewSession as SessionData } from '@/features/srs/server/queries';
import { matchesAny } from '@/features/tasks/lib/grade';
import { audioUrl } from '@/lib/audio/segments';
import { player } from '@/lib/audio/store';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const GRADE_LABEL: Record<Grade, TranslationKey> = {
  1: 'review.again',
  2: 'review.hard',
  3: 'review.good',
  4: 'review.easy',
};

const KIND_LABEL: Record<CardKind, TranslationKey> = {
  word: 'review.kindWord',
  chunk: 'review.kindChunk',
  audio: 'review.kindAudio',
  grammar: 'review.kindGrammar',
};

const INTERVAL_LABEL = {
  minutes: 'review.intervalMinutes',
  hours: 'review.intervalHours',
  days: 'review.intervalDays',
  months: 'review.intervalMonths',
} as const satisfies Record<string, TranslationKey>;

/** Lotes en los que se envían los repasos al servidor. */
const BATCH = 10;
/** Tope de tiempo que se anota por tarjeta: una pausa larga no es tiempo de repaso. */
const MAX_CARD_MS = 120_000;
const NO_LEMMAS: ReadonlySet<string> = new Set();

interface PendingReview {
  cardId: string;
  grade: Grade;
  reviewedAt: string;
  durationMs: number;
  clientId: string;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]')
  );
}

/**
 * Sesión de repaso: una tarjeta cada vez. El cliente programa cada respuesta con FSRS para
 * enseñar los intervalos y envía las valoraciones por lotes; el servidor vuelve a calcular.
 */
const hasGap = (prompt: string) => prompt.includes('___');

/** Tarjetas que no se teclean: se mira la respuesta y se valora uno mismo. */
function isSelfGraded(content: CardContent | undefined): boolean {
  if (!content) return false;
  if (content.kind === 'word' || content.kind === 'chunk') return true;
  return content.kind === 'grammar' && !hasGap(content.front.prompt);
}

export function ReviewSession({ session, audioBase }: { session: SessionData; audioBase: string }) {
  const language = useContentLanguage();
  const lang = useContentLang();
  const t = useT();
  const [queue, setQueue] = useState<ReviewCard[]>(session.cards);
  const [done, setDone] = useState(0);
  const [sessionMs, setSessionMs] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [budgetDismissed, setBudgetDismissed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Estado de la tarjeta en curso.
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [grammarCorrect, setGrammarCorrect] = useState<boolean | null>(null);
  const [suggested, setSuggested] = useState<Grade | null>(null);
  const [intervals, setIntervals] = useState<Record<Grade, number> | null>(null);

  const pending = useRef<PendingReview[]>([]);
  const shownAt = useRef(0);
  const loadedSrc = useRef<string | null>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const suggestedRef = useRef<HTMLButtonElement>(null);

  const card = stopped ? undefined : queue[0];
  const content = card?.content;
  const clip =
    content?.kind === 'audio'
      ? content.front.clip
      : content?.kind === 'word' || content?.kind === 'chunk'
        ? content.front.clip
        : undefined;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id, done]);

  useEffect(() => () => player.dispose(), []);

  // Tras mostrar la respuesta, el foco va a la valoración sugerida (Intro la confirma) o,
  // si no hay, al reverso de la tarjeta.
  useEffect(() => {
    if (!revealed) return;
    (suggestedRef.current ?? backRef.current)?.focus();
  }, [revealed]);

  async function flush(): Promise<void> {
    const batch = [...pending.current];
    if (batch.length === 0) return;
    const result = await submitReviews({ reviews: batch }).catch(() => null);
    if (result?.ok) {
      pending.current = pending.current.filter((item) => !batch.includes(item));
      setSaveFailed(false);
    } else {
      setSaveFailed(true);
    }
  }

  function play() {
    if (!clip) return;
    const url = audioUrl(audioBase, clip.src);
    if (loadedSrc.current !== url) {
      player.load(url, [{ start: clip.start, end: clip.end }], 1);
      loadedSrc.current = url;
    }
    player.playRange(clip.start, clip.end);
  }

  function reveal(grade: Grade | null = null) {
    if (!card) return;
    setIntervals(previewIntervals(card.state, new Date()));
    setSuggested(grade);
    setRevealed(true);
  }

  function check(event: FormEvent) {
    event.preventDefault();
    if (!content || revealed) return;
    if (content.kind === 'audio') {
      const result = diagnoseBest(
        { reference: content.back.text, typed: answer, knownLemmas: NO_LEMMAS, language },
        content.back.variants,
      );
      setDiagnosis(result);
      reveal(
        suggestAudioGrade({
          accuracy: result.accuracy,
          elapsedMs: Date.now() - shownAt.current,
          clipMs: (content.front.clip.end - content.front.clip.start) * 1000,
        }),
      );
    } else if (content.kind === 'grammar') {
      const correct = matchesAny(answer, content.back.answers);
      setGrammarCorrect(correct);
      reveal(gradeForGrammar(correct));
    }
  }

  function rate(grade: Grade) {
    if (!card || !revealed) return;
    const now = new Date();
    const durationMs = Math.min(MAX_CARD_MS, Math.max(0, now.getTime() - shownAt.current));
    const next = review(card.state, grade, now);
    pending.current.push({
      cardId: card.id,
      grade,
      reviewedAt: now.toISOString(),
      durationMs,
      clientId: crypto.randomUUID(),
    });

    // Lo que sigue en (re)aprendizaje vuelve a salir en esta misma sesión.
    const comesBack = next.state.state === 1 || next.state.state === 3;
    const rest = queue.slice(1);
    const nextQueue = comesBack ? [...rest, { ...card, state: next.state }] : rest;

    player.pause();
    setQueue(nextQueue);
    setDone((n) => n + 1);
    setSessionMs((ms) => ms + durationMs);
    setRevealed(false);
    setAnswer('');
    setDiagnosis(null);
    setGrammarCorrect(null);
    setSuggested(null);
    setIntervals(null);

    if (pending.current.length >= BATCH || nextQueue.length === 0) void flush();
  }

  function stop() {
    player.pause();
    setStopped(true);
    void flush();
  }

  // Atajos: Espacio muestra; 1–4 valoran; R reproduce (docs/03-producto/02-pantallas-y-flujos.md §4).
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !card) return;
    if (isTyping(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && !revealed && isSelfGraded(content)) {
      event.preventDefault();
      reveal();
    } else if (revealed && ['1', '2', '3', '4'].includes(key)) {
      event.preventDefault();
      rate(Number(key) as Grade);
    } else if (key === 'r' && clip) {
      event.preventDefault();
      play();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Si quedan repasos sin enviar al salir, se intenta una última vez.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pending.current.length > 0) {
        void submitReviews({ reviews: [...pending.current] })
          .then((result) => {
            if (result.ok) pending.current = [];
          })
          .catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const saveError = saveFailed ? (
    <p role="alert" data-tone="error" className="feedback flex-wrap items-center text-error">
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      {t('errors.saveFailed')}
      <Button variant="ghost" size="sm" onClick={() => void flush()}>
        {t('common.retry')}
      </Button>
    </p>
  ) : null;

  if (session.totalCards === 0 && done === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={t('review.emptyTitle')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/escuchar" className={buttonVariants({ variant: 'primary' })}>
              {t('nav.listen')}
            </Link>
            <Link href="/leer" className={buttonVariants({ variant: 'secondary' })}>
              {t('nav.read')}
            </Link>
          </div>
        }
      >
        <p>{t('review.emptyBody')}</p>
      </EmptyState>
    );
  }

  if (!card) {
    const finishedNow = done > 0;
    return (
      <div className="flex flex-col gap-4">
        {saveError}
        <EmptyState
          icon={PartyPopper}
          title={finishedNow ? t('review.doneTitle') : t('review.nothingDueTitle')}
          action={
            <Link href="/hoy" className={buttonVariants({ variant: 'secondary' })}>
              {t('errors.goHome')}
            </Link>
          }
        >
          <p role="status">
            {finishedNow
              ? t(done === 1 ? 'review.doneBodyOne' : 'review.doneBody', {
                  n: done,
                  time: formatClock(sessionMs),
                })
              : t('review.nothingDueBody')}
          </p>
        </EmptyState>
      </div>
    );
  }

  const total = done + queue.length;
  const fresh = queue.filter((item) => item.state.state === 0).length;
  const overBudget = session.spentTodayMs + sessionMs >= REVIEW_BUDGET_MS;
  const selfGraded = isSelfGraded(content);

  let front: ReactNode = null;
  let back: ReactNode = null;

  if (content?.kind === 'word' || content?.kind === 'chunk') {
    const parts = splitAround(content.front.sentence, content.front.surface);
    front = (
      <p lang={lang} className="text-subheading">
        {parts ? (
          <>
            {parts.before}
            <strong className="font-semibold text-accent-text">{parts.match}</strong>
            {parts.after}
          </>
        ) : (
          content.front.sentence
        )}
      </p>
    );
    back = (
      <>
        {content.back.def_en ? (
          <>
            <p lang={lang}>{content.back.def_en}</p>
            <details className="text-muted">
              <summary className="cursor-pointer py-1 text-body-sm">
                {t('review.translation')}
              </summary>
              <p className="mt-1">{content.back.def_es}</p>
            </details>
          </>
        ) : (
          <p>{content.back.def_es}</p>
        )}
        {content.back.example ? (
          <p lang={lang} className="prose-reading border-l-2 border-border pl-3 text-muted">
            {content.back.example}
          </p>
        ) : null}
        {content.back.note_es ? (
          <p className="text-body-sm text-muted">{content.back.note_es}</p>
        ) : null}
      </>
    );
  } else if (content?.kind === 'audio') {
    front = (
      <form onSubmit={check} className="flex flex-col gap-3">
        <Label htmlFor="review-dictation">{t('listening.dictationLabel')}</Label>
        <Textarea
          id="review-dictation"
          lang={lang}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={answer}
          readOnly={revealed}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) check(event);
          }}
        />
        {!revealed ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={answer.trim() === ''}>
              {t('tasks.check')}
            </Button>
            <Button variant="ghost" onClick={() => reveal(1)}>
              {t('review.dontKnow')}
            </Button>
          </div>
        ) : null}
      </form>
    );
    back = (
      <>
        {diagnosis ? (
          <>
            <DictationDiff diagnosis={diagnosis} />
            <p className="tabular-nums text-body-sm text-muted">
              {t('listening.dictationAccuracy', { pct: toPercent(diagnosis.accuracy) })}
            </p>
          </>
        ) : (
          <p lang={lang} className="prose-reading">
            {content.back.text}
          </p>
        )}
        {content.back.features.map((feature) => (
          <p key={feature.phrase} className="text-body-sm text-muted">
            <span lang={lang} className="font-medium text-text">
              {feature.phrase}
            </span>
            {feature.ipa ? <span className="tabular-nums"> {feature.ipa}</span> : null}
            {' — '}
            <InlineText text={feature.explanation_es} />
          </p>
        ))}
      </>
    );
  } else if (content?.kind === 'grammar' && !hasGap(content.front.prompt)) {
    front = (
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-muted">{t('review.fixSentence')}</p>
        <p lang={lang} className="text-subheading">
          {content.front.prompt}
        </p>
      </div>
    );
    back = (
      <>
        <p lang={lang} className="font-medium">
          {content.back.answers[0]}
        </p>
        {content.back.writing_id ? (
          <Link
            href={`/escribir/historial/${content.back.writing_id}` as Route}
            className="self-start text-body-sm text-accent-text underline underline-offset-4"
          >
            {t('review.openWriting')}: <span lang={lang}>{content.back.title}</span>
          </Link>
        ) : null}
      </>
    );
  } else if (content?.kind === 'grammar') {
    const prompt = splitPrompt(content.front.prompt);
    front = (
      <form onSubmit={check} className="flex flex-col gap-3">
        {content.front.context ? (
          <p lang={lang} className="prose-reading text-muted">
            {content.back.writing_id ? (
              <span lang="es" className="mr-1.5 text-body-sm">
                {t('review.yourSentence')}:
              </span>
            ) : null}
            {content.front.context}
          </p>
        ) : null}
        {content.front.hint ? (
          <p lang={lang} className="tabular-nums text-body-sm font-medium text-accent-text">
            {content.front.hint}
          </p>
        ) : null}
        <p lang={lang} className="prose-reading flex flex-wrap items-baseline gap-x-1.5 gap-y-2">
          <span>{prompt.before}</span>
          <Input
            lang={lang}
            aria-label={t('tasks.answerLabel')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="inline-block w-48"
            value={answer}
            readOnly={revealed}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <span>{prompt.after}</span>
        </p>
        {!revealed ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={answer.trim() === ''}>
              {t('tasks.check')}
            </Button>
            <Button variant="ghost" onClick={() => reveal(1)}>
              {t('review.dontKnow')}
            </Button>
          </div>
        ) : null}
      </form>
    );
    back = (
      <>
        {grammarCorrect !== null ? (
          <p
            className={cn(
              'flex items-center gap-2 font-medium',
              grammarCorrect ? 'text-success' : 'text-error',
            )}
          >
            {grammarCorrect ? (
              <CircleCheck aria-hidden="true" className="size-5" strokeWidth={2} />
            ) : (
              <CircleX aria-hidden="true" className="size-5" strokeWidth={2} />
            )}
            {grammarCorrect ? t('tasks.correct') : t('tasks.incorrect')}
          </p>
        ) : null}
        <p>
          {t('tasks.correctAnswer')}:{' '}
          <span lang={lang} className="font-medium">
            {content.back.answers[0]}
          </span>
        </p>
        <p className="text-body-sm text-muted">
          <InlineText text={content.back.rule_es} />
        </p>
        {content.back.writing_id && !content.back.grammar_id ? (
          <Link
            href={`/escribir/historial/${content.back.writing_id}` as Route}
            className="self-start text-body-sm text-accent-text underline underline-offset-4"
          >
            {t('review.openWriting')}: <span lang={lang}>{content.back.title}</span>
          </Link>
        ) : null}
        {content.back.grammar_id || content.back.uoe_id ? (
          <Link
            href={
              (content.back.grammar_id
                ? `/gramatica/${content.back.grammar_id}`
                : `/use-of-english/${content.back.uoe_id}`) as Route
            }
            className="self-start text-body-sm text-accent-text underline underline-offset-4"
          >
            {t(content.back.grammar_id ? 'review.openFicha' : 'review.openExercise')}:{' '}
            <span lang={lang}>{content.back.title}</span>
          </Link>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label={t('review.progress', { done, total })}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="progress"
        >
          <div style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
        </div>
        <p className="tabular-nums flex flex-wrap gap-x-4 text-caption text-muted">
          <span>{t('review.progress', { done, total })}</span>
          <span>{t('review.newLeft', { n: fresh })}</span>
          <span>{t('review.dueLeft', { n: queue.length - fresh })}</span>
        </p>
      </div>

      {saveError}

      {overBudget && !budgetDismissed && !revealed ? (
        <Panel className="flex flex-col gap-3 border border-warning">
          <p className="font-medium">{t('review.budgetTitle')}</p>
          <p className="text-body-sm text-muted">{t('review.budgetBody')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={stop}>
              {t('review.stopForToday')}
            </Button>
            <Button variant="ghost" onClick={() => setBudgetDismissed(true)}>
              {t('review.keepGoing')}
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel key={`${card.id}-${done}`} className="flex min-h-72 flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Chip>{t(KIND_LABEL[content?.kind ?? 'word'])}</Chip>
          {clip ? (
            <Button variant="secondary" size="sm" onClick={play}>
              <Play aria-hidden="true" strokeWidth={2} />
              {t('review.playClip')}
            </Button>
          ) : null}
        </div>

        {front}

        {revealed ? (
          <div
            ref={backRef}
            tabIndex={-1}
            aria-label={t('review.answer')}
            className="flex flex-col gap-3 border-t border-border pt-4 outline-none"
          >
            {back}
          </div>
        ) : selfGraded ? (
          <Button size="lg" className="mt-auto self-start" onClick={() => reveal()}>
            {t('review.show')}
          </Button>
        ) : null}
      </Panel>

      {revealed && intervals ? (
        <div
          role="group"
          aria-label={t('review.rate')}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {GRADES.map((grade) => {
            const interval = describeInterval(intervals[grade]);
            const isSuggested = suggested === grade;
            return (
              <Button
                key={grade}
                ref={isSuggested ? suggestedRef : undefined}
                variant={isSuggested ? 'primary' : 'secondary'}
                className="h-auto min-h-14 flex-col gap-0.5 py-2"
                onClick={() => rate(grade)}
              >
                <span>
                  <span aria-hidden="true" className="tabular-nums mr-1.5 text-caption">
                    {grade}
                  </span>
                  {t(GRADE_LABEL[grade])}
                </span>
                <span className="tabular-nums text-caption font-normal">
                  {t(INTERVAL_LABEL[interval.unit], { n: interval.n })}
                  {isSuggested ? ` · ${t('review.suggested')}` : ''}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="hidden text-caption text-muted pointer-fine:block">{t('review.shortcuts')}</p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={stop}>
          {t('review.stop')}
        </Button>
      </div>
    </div>
  );
}
