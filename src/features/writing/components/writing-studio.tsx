'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { formatClock } from '@/features/lessons/lib/summary';
import {
  SubmissionReview,
  type ReviewResult,
} from '@/features/writing/components/submission-review';
import {
  EMPTY_PLAN,
  useStoredDraft,
  writeDraft,
  type Draft,
} from '@/features/writing/components/use-draft';
import {
  feedbackErrorOf,
  type WritingFeedbackError,
  type WritingFeedbackResponse,
} from '@/features/writing/lib/api';
import { MAX_CHARS, MIN_CHARS } from '@/features/writing/lib/input';
import { submitSelfReview } from '@/features/writing/server/actions';
import type { AiStatus } from '@/features/writing/server/queries';
import { countWords, type PublicWritingPrompt } from '@/lib/content/writing-schema';
import type { Translate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { useActiveClock } from '@/lib/use-active-clock';
import { cn } from '@/lib/utils';
import { useContentLang } from '@/components/content-language';

/** Tras dejar de teclear este tiempo, el borrador se guarda en el dispositivo. */
const AUTOSAVE_MS = 600;

interface Done {
  id: string;
  text: string;
  result: ReviewResult;
  modelAnswer: string;
  cards: { front: string; back: string }[];
  notSaved: boolean;
}

function aiErrorMessage(t: Translate, error: WritingFeedbackError, limit: number): string {
  switch (error) {
    case 'daily_limit':
      return t('writing.errorDaily', { limit });
    case 'monthly_budget':
      return t('writing.errorBudget');
    case 'ai_refused':
      return t('writing.errorRefused');
    case 'ai_truncated':
      return t('writing.errorTruncated');
    case 'ai_disabled':
      return t('writing.errorDisabled');
    default:
      return t('writing.errorAi');
  }
}

/**
 * La pantalla de un writing: consigna, plan opcional, editor con contador, autoguardado local
 * y modo examen; al entregar, la corrección con la reescritura al lado (07-writing §2.2).
 */
export function WritingStudio({
  prompt,
  ai,
  fichas,
}: {
  prompt: PublicWritingPrompt;
  ai: AiStatus;
  fichas: Record<string, string>;
}) {
  const t = useT();
  const lang = useContentLang();
  const router = useRouter();
  const id = useId();
  const clock = useActiveClock();
  const stored = useStoredDraft(prompt.id);

  // Mientras no se toque nada, lo que se ve es el borrador guardado (si lo hay).
  const [edited, setEdited] = useState<Draft | null>(null);
  const [exam, setExam] = useState<{ deadline: number } | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<'ai' | 'self' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef<Draft | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const draft = edited ?? stored ?? { text: '', plan: EMPTY_PLAN };
  const restored = edited === null && stored !== null && stored.text.trim() !== '';
  const words = countWords(draft.text);
  const remaining = exam ? Math.max(0, exam.deadline - now) : null;
  const aiAvailable = ai.enabled && ai.budgetLeft && ai.usedToday < ai.dailyLimit;
  // En un ensayo las notas ya vienen en el enunciado: no hace falta repetirlas debajo.
  const pointsInTask = prompt.points.every((point) => prompt.prompt_en.includes(point));

  // Cuenta atrás del modo examen.
  useEffect(() => {
    if (!exam) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [exam]);

  // Al salir de la pantalla con cambios sin guardar, se guardan.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (unsaved.current) writeDraft(prompt.id, unsaved.current);
    },
    [prompt.id],
  );

  // Al llegar la corrección, el foco va a ella para que se lea (y se anuncie) lo primero.
  useEffect(() => {
    if (done) resultRef.current?.focus();
  }, [done]);

  function change(next: Draft) {
    setEdited(next);
    setDraftSaved(false);
    setError(null);
    unsaved.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeDraft(prompt.id, next);
      unsaved.current = null;
      setDraftSaved(true);
    }, AUTOSAVE_MS);
  }

  function forgetDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    unsaved.current = null;
    writeDraft(prompt.id, null);
    setDraftSaved(false);
  }

  function toggleExam(on: boolean) {
    if (!on) {
      setExam(null);
      return;
    }
    const start = Date.now();
    setNow(start);
    setExam({ deadline: start + prompt.time_min * 60_000 });
  }

  async function submit(kind: 'ai' | 'self') {
    const text = draft.text.trim();
    if (text.length < MIN_CHARS) return setError(t('writing.tooShort'));
    if (text.length > MAX_CHARS) return setError(t('writing.tooLong'));

    setBusy(kind);
    setError(null);
    const payload = {
      promptId: prompt.id,
      text,
      examMode: exam !== null,
      activeSeconds: Math.round(clock.total() / 1000),
    };

    let next: Done | null = null;
    if (kind === 'self') {
      const response = await submitSelfReview(payload).catch(() => null);
      if (response?.ok) {
        const { id: submissionId, review, modelAnswer, cards } = response.data;
        next = {
          id: submissionId,
          text,
          result: { kind: 'self', review, scores: null, points: [] },
          modelAnswer,
          cards,
          notSaved: false,
        };
      } else {
        setError(t('errors.saveFailed'));
      }
    } else {
      const response = await fetch('/api/ai/writing-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
      const body: unknown = response ? await response.json().catch(() => null) : null;
      if (response?.ok && body) {
        const data = body as WritingFeedbackResponse;
        next = {
          id: data.id,
          text,
          result: { kind: 'ai', feedback: data.feedback },
          modelAnswer: data.modelAnswer,
          cards: data.cards,
          notSaved: !data.saved,
        };
      } else {
        setError(aiErrorMessage(t, feedbackErrorOf(body), ai.dailyLimit));
      }
      // El contador de correcciones de hoy ha cambiado, haya salido bien o no.
      router.refresh();
    }

    setBusy(null);
    if (next) {
      forgetDraft();
      setDone(next);
    }
  }

  function again() {
    setDone(null);
    setEdited({ text: '', plan: EMPTY_PLAN });
    setExam(null);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        <SubmissionReview
          submissionId={done.id}
          text={done.text}
          targetLevel={prompt.level}
          points={prompt.points}
          result={done.result}
          modelAnswer={done.modelAnswer}
          cards={done.cards}
          rewriteText={null}
          fichas={fichas}
          notSaved={done.notSaved}
          footer={
            <>
              <Button variant="secondary" onClick={again}>
                {t('writing.writeAgain')}
              </Button>
              <Link href="/escribir/historial" className={buttonVariants({ variant: 'ghost' })}>
                {t('writing.seeHistory')}
              </Link>
              <Link href="/escribir" className={buttonVariants({ variant: 'ghost' })}>
                {t('writing.backToIndex')}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const lengthStatus =
    words < prompt.words_min
      ? { text: t('writing.lengthShort', { n: prompt.words_min - words }), tone: 'text-muted' }
      : words > prompt.words_max
        ? { text: t('writing.lengthLong', { n: words - prompt.words_max }), tone: 'text-warning' }
        : { text: t('writing.lengthOk'), tone: 'text-success' };

  return (
    // La consigna a un lado y el texto al otro, como después la corrección.
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <PanelLabel>{t('writing.situation')}</PanelLabel>
            <p>{prompt.context_es}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <PanelLabel>{t('writing.task')}</PanelLabel>
            <p lang={lang} className="prose-reading whitespace-pre-line">
              {prompt.prompt_en}
            </p>
          </div>
          {pointsInTask ? null : (
            <div className="flex flex-col gap-1.5">
              <PanelLabel>{t('writing.pointsTitle')}</PanelLabel>
              <ul lang={lang} className="list-disc pl-5">
                {prompt.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {exam ? (
          <p className="text-body-sm text-muted">{t('writing.helpHiddenExam')}</p>
        ) : (
          <details className="rounded-card bg-surface px-6 py-4 sm:px-8">
            <summary className="cursor-pointer font-medium">
              {t('writing.tipsTitle')} · {t('writing.usefulTitle')}
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <PanelLabel>{t('writing.tipsTitle')}</PanelLabel>
                <ul className="list-disc pl-5 text-body-sm">
                  {prompt.tips_es.map((tip) => (
                    <li key={tip}>
                      <InlineText text={tip} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-1.5">
                <PanelLabel>{t('writing.usefulTitle')}</PanelLabel>
                <ul lang={lang} className="list-disc pl-5 text-body-sm">
                  {prompt.useful_language.map((phrase) => (
                    <li key={phrase}>{phrase}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        )}

        <details className="rounded-card bg-surface px-6 py-4 sm:px-8">
          <summary className="cursor-pointer font-medium">{t('writing.planTitle')}</summary>
          <p className="mt-2 text-body-sm text-muted">{t('writing.planHint')}</p>
          <div className="mt-3 flex flex-col gap-2">
            {draft.plan.map((idea, index) => (
              <Input
                key={index}
                lang={lang}
                aria-label={t('writing.planIdea', { n: index + 1 })}
                placeholder={t('writing.planIdea', { n: index + 1 })}
                value={idea}
                maxLength={200}
                onChange={(event) =>
                  change({
                    ...draft,
                    plan: draft.plan.map((value, i) => (i === index ? event.target.value : value)),
                  })
                }
              />
            ))}
          </div>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <Label htmlFor={`${id}-text`}>{t('writing.editorLabel')}</Label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm">
              <input
                type="checkbox"
                checked={exam !== null}
                onChange={(event) => toggleExam(event.target.checked)}
                className="size-4 shrink-0 accent-accent"
              />
              <span>
                {t('writing.examMode')}{' '}
                <span className="text-muted">
                  ({t('writing.examModeHint', { min: prompt.time_min })})
                </span>
              </span>
            </label>
          </div>

          {remaining !== null ? (
            <p
              className={cn(
                'tabular-nums text-body-sm',
                remaining === 0 ? 'text-warning' : 'text-muted',
              )}
            >
              {t('writing.timeLeft', { time: formatClock(remaining) })}
            </p>
          ) : null}
          {remaining === 0 ? (
            <p role="alert" className="text-body-sm text-warning">
              {t('writing.timeUp')}
            </p>
          ) : null}

          {restored ? (
            <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
              {t('writing.draftRestored')}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  forgetDraft();
                  setEdited({ text: '', plan: EMPTY_PLAN });
                }}
              >
                {t('writing.discardDraft')}
              </Button>
            </p>
          ) : null}

          <Textarea
            id={`${id}-text`}
            lang={lang}
            rows={14}
            maxLength={MAX_CHARS}
            spellCheck={exam === null}
            autoCapitalize="sentences"
            placeholder={t('writing.editorPlaceholder')}
            aria-describedby={`${id}-count`}
            value={draft.text}
            onChange={(event) => change({ ...draft, text: event.target.value })}
            className="prose-reading"
          />
          <p
            id={`${id}-count`}
            className="tabular-nums flex flex-wrap gap-x-3 gap-y-1 text-body-sm"
          >
            <span>
              {words === 1 ? t('writing.wordCountOne') : t('writing.wordCount', { n: words })}
              <span className="text-muted">
                {' '}
                / {t('writing.words', { min: prompt.words_min, max: prompt.words_max })}
              </span>
            </span>
            {words > 0 ? <span className={lengthStatus.tone}>{lengthStatus.text}</span> : null}
            {draftSaved ? <span className="text-muted">{t('writing.draftSaved')}</span> : null}
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {aiAvailable ? (
            <Button size="lg" disabled={busy !== null} onClick={() => void submit('ai')}>
              {busy === 'ai' ? t('writing.submittingAi') : t('writing.submitAi')}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={aiAvailable ? 'secondary' : 'primary'}
            disabled={busy !== null}
            onClick={() => void submit('self')}
          >
            {busy === 'self' ? t('writing.submitting') : t('writing.submitSelf')}
          </Button>
          {ai.enabled ? (
            <span className="tabular-nums text-caption text-muted">
              {t('writing.aiToday', { used: ai.usedToday, limit: ai.dailyLimit })}
            </span>
          ) : null}
        </div>

        <p role="status" className="text-body-sm text-muted">
          {busy === 'ai' ? t('writing.submittingAi') : null}
          {busy === null && !ai.enabled ? t('writing.aiOffBody') : null}
          {busy === null && ai.enabled && !ai.budgetLeft ? t('writing.aiBudget') : null}
          {busy === null && ai.enabled && ai.budgetLeft && ai.usedToday >= ai.dailyLimit
            ? t('writing.errorDaily', { limit: ai.dailyLimit })
            : null}
        </p>
      </div>
    </div>
  );
}
