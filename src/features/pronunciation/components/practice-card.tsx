'use client';

import { CircleAlert, CircleCheck, CircleDashed, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Panel } from '@/components/ui/panel';
import { SpeakButton } from '@/features/pronunciation/components/speak-button';
import { assess, type Assessment, type Confusion } from '@/features/pronunciation/lib/assess';
import {
  canRecognize,
  listenOnce,
  type ListenError,
  type ListenHandle,
} from '@/features/pronunciation/lib/recognition';
import { buildTips } from '@/features/pronunciation/lib/tips';
import type { Accent } from '@/features/pronunciation/lib/voices';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

type Phase =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'result'; assessment: Assessment }
  | { kind: 'error'; error: ListenError };

const ERROR_TEXT: Record<ListenError, TranslationKey> = {
  'no-speech': 'pronunciation.errorNoSpeech',
  'not-allowed': 'pronunciation.errorNotAllowed',
  'no-microphone': 'pronunciation.errorNoMicrophone',
  network: 'pronunciation.errorNetwork',
  unknown: 'pronunciation.errorUnknown',
};

const VERDICT = {
  good: { icon: CircleCheck, className: 'text-success' },
  close: { icon: CircleDashed, className: 'text-warning' },
  retry: { icon: CircleAlert, className: 'text-error' },
} as const;

const noop = () => () => {};

/** ¿Hay reconocimiento de voz? `unknown` hasta que se sabe (en el servidor y al hidratar). */
export function useRecognitionSupport(): 'unknown' | 'yes' | 'no' {
  return useSyncExternalStore(
    noop,
    () => (canRecognize() ? 'yes' : 'no'),
    () => 'unknown',
  );
}

/**
 * Una palabra o frase para decir en voz alta: se escucha el modelo, se habla al micrófono y se
 * ve qué ha entendido el reconocimiento de voz, palabra por palabra.
 */
export function PracticeCard({
  text,
  ipa,
  es,
  confusions = [],
  accent,
  onAssessed,
  assessed = false,
}: {
  text: string;
  ipa?: string;
  es?: string;
  confusions?: readonly Confusion[];
  accent: Accent;
  onAssessed?: (assessment: Assessment) => void;
  /** Ya hay un intento valorado: «Hablar» deja de ser la acción principal de la pantalla. */
  assessed?: boolean;
}) {
  const t = useT();
  const support = useRecognitionSupport();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const handle = useRef<ListenHandle | null>(null);
  const isSentence = text.trim().split(/\s+/).length > 3;

  useEffect(() => () => handle.current?.cancel(), []);

  function start() {
    window.speechSynthesis?.cancel();
    setPhase({ kind: 'listening' });
    handle.current = listenOnce({
      accent,
      onResult: (alternatives) => {
        const assessment = assess(text, alternatives, confusions);
        setPhase({ kind: 'result', assessment });
        onAssessed?.(assessment);
      },
      onError: (error) => setPhase({ kind: 'error', error }),
    });
    if (!handle.current) setPhase({ kind: 'error', error: 'unknown' });
  }

  let feedback = null;
  if (phase.kind === 'listening') {
    feedback = <p className="text-body-sm text-accent-text">{t('pronunciation.listening')}</p>;
  } else if (phase.kind === 'error') {
    feedback = <p className="text-body-sm text-error">{t(ERROR_TEXT[phase.error])}</p>;
  } else if (phase.kind === 'result') {
    const { assessment } = phase;
    const { icon: Icon, className } = VERDICT[assessment.verdict];
    const understood = assessment.words.filter((word) => word.status === 'ok').length;
    const tips = buildTips(text, assessment);
    const message =
      assessment.verdict === 'good'
        ? t('pronunciation.verdictGood')
        : assessment.hesitant
          ? t('pronunciation.verdictHesitant')
          : assessment.score === 1
            ? t('pronunciation.verdictAlmost')
            : assessment.verdict === 'close'
              ? t('pronunciation.verdictClose', {
                  ok: understood,
                  total: assessment.words.length,
                })
              : t('pronunciation.verdictRetry');
    feedback = (
      <div className="flex flex-col items-center gap-2">
        <p className={cn('flex items-center gap-2 font-medium', className)}>
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
          {message}
        </p>
        {assessment.words.length > 1 ? (
          <p lang="en" className="prose-reading flex flex-wrap justify-center gap-x-1.5">
            {assessment.words.map((word, index) => (
              <span
                key={`${word.text}-${index}`}
                className={cn(
                  word.status === 'ok' && 'text-success',
                  word.status === 'wrong' && 'text-error underline decoration-dotted',
                  word.status === 'missing' && 'text-muted line-through',
                )}
              >
                {word.text}
                <span className="sr-only"> ({t(`pronunciation.word_${word.status}`)}) </span>
              </span>
            ))}
          </p>
        ) : null}
        {assessment.verdict !== 'good' && assessment.heard ? (
          <p className="text-body-sm text-muted">
            {t('pronunciation.heard')} <span lang="en">«{assessment.heard}»</span>
          </p>
        ) : null}
        {tips.length > 0 ? (
          <section
            aria-label={t('pronunciation.tipsTitle')}
            className="mt-1 w-full max-w-prose rounded-card bg-surface-2 px-4 py-3 text-left"
          >
            <p aria-hidden="true" className="text-body-sm font-medium text-muted">
              {t('pronunciation.tipsTitle')}
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-body-sm">
              {tips.map((tip) => (
                <li key={`${tip.id}-${tip.word ?? ''}`}>
                  {tip.word ? (
                    <>
                      <strong lang="en" className="font-semibold text-text">
                        {tip.word}
                      </strong>
                      {': '}
                    </>
                  ) : null}
                  <InlineText text={tip.text_es} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <Panel className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <p
          lang="en"
          className={cn(
            'font-semibold tracking-tight',
            isSentence ? 'text-subheading sm:text-heading-sm' : 'text-heading-lg',
          )}
        >
          {text}
        </p>
        {ipa ? (
          <p lang="en" className="tabular-nums text-muted">
            {ipa}
          </p>
        ) : null}
        {es ? <p className="text-body-sm text-muted">{es}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <SpeakButton
          text={text}
          accent={accent}
          label={t('pronunciation.listenModel')}
          variant="secondary"
          size="md"
        >
          {t('pronunciation.listenModel')}
        </SpeakButton>
        <SpeakButton
          text={text}
          accent={accent}
          rate={0.6}
          label={t('pronunciation.listenSlow')}
          variant="ghost"
          size="md"
        >
          {t('pronunciation.listenSlow')}
        </SpeakButton>
        {support === 'yes' ? (
          phase.kind === 'listening' ? (
            <Button variant="danger" onClick={() => handle.current?.stop()}>
              <Square aria-hidden="true" className="size-4" strokeWidth={1.75} />
              {t('pronunciation.stop')}
            </Button>
          ) : (
            <Button
              variant={phase.kind === 'idle' && !assessed ? 'primary' : 'secondary'}
              onClick={start}
            >
              <Mic aria-hidden="true" className="size-5" strokeWidth={1.75} />
              {t(phase.kind === 'idle' ? 'pronunciation.speak' : 'pronunciation.speakAgain')}
            </Button>
          )
        ) : null}
      </div>

      <div role="status" aria-live="polite" className="min-h-6">
        {feedback}
      </div>
      {support === 'no' ? (
        <p className="max-w-prose text-body-sm text-muted">{t('pronunciation.unsupported')}</p>
      ) : null}
    </Panel>
  );
}
