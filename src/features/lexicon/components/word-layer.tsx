'use client';

import { BookmarkPlus, Check, CircleHelp, Play, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/panel';
import { kindOfEntry } from '@/features/srs/lib/cards';
import { glossaryForSentence, type TextToken } from '@/features/lexicon/lib/glossary';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import type { LexiconSession } from './use-lexicon-session';

// Capa de palabras de un texto: cada palabra es un botón real. En modo «help» abre su
// glosario; en cualquier modo, la pulsación larga, el clic derecho o la tecla M la marcan como
// desconocida (docs/03-producto/02-pantallas-y-flujos.md §2.4 y §4). Con el teclado, el texto
// es una sola parada del tabulador y las flechas mueven de palabra en palabra.

export interface GlossaryEntry {
  lemma: string;
  surface: string;
  pos: string;
  def_en: string;
  def_es: string;
  example?: string;
  note_es?: string;
  ref: string;
}

export interface WordToken extends TextToken {
  /** Categoría gramatical. */
  p: string;
  /** Inicio y fin en el audio, si la lección lo tiene. */
  s?: number;
  e?: number;
}

export interface WordSentence {
  id: string;
  text: string;
  tokens: readonly WordToken[];
}

interface Active {
  element: HTMLElement;
  sentence: WordSentence;
  token: WordToken;
  entry: GlossaryEntry | null;
}

interface LayerValue {
  mode: 'immersion' | 'help';
  glossary: readonly GlossaryEntry[];
  lexicon: LexiconSession;
}

const LayerContext = createContext<LayerValue | null>(null);

const LONG_PRESS_MS = 550;
const isWord = (text: string) => /[\p{L}\p{N}]/u.test(text);

const POS_LABEL: Record<string, TranslationKey> = {
  noun: 'lexicon.posNoun',
  verb: 'lexicon.posVerb',
  adjective: 'lexicon.posAdjective',
  adverb: 'lexicon.posAdverb',
  phrasal_verb: 'lexicon.posPhrasalVerb',
  phrase: 'lexicon.posPhrase',
};

const STATUS_LABEL = {
  new: 'lexicon.statusNew',
  learning: 'lexicon.statusLearning',
  known: 'lexicon.statusKnown',
  ignored: 'lexicon.statusIgnored',
} as const satisfies Record<string, TranslationKey>;

export function WordLayer({
  mode,
  sentences,
  glossary,
  lexicon,
  onPlayWord,
  onPlaySentence,
  children,
}: {
  mode: 'immersion' | 'help';
  /** Todas las frases que se pintan dentro (para saber qué palabra se ha tocado). */
  sentences: readonly WordSentence[];
  glossary: readonly GlossaryEntry[];
  lexicon: LexiconSession;
  /** Reproduce una palabra en su contexto (solo si la lección tiene audio con tiempos). */
  onPlayWord?: (token: WordToken) => void;
  onPlaySentence?: (sentenceId: string) => void;
  children: ReactNode;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const [active, setActive] = useState<Active | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(sentences.map((s) => [s.id, s])), [sentences]);
  const value = useMemo(() => ({ mode, glossary, lexicon }), [mode, glossary, lexicon]);

  // El texto es una sola parada del tabulador: la primera palabra, o la última visitada.
  useEffect(() => {
    const root = rootRef.current;
    if (root && !root.querySelector('[data-word][tabindex="0"]')) {
      root.querySelector('[data-word]')?.setAttribute('tabindex', '0');
    }
  });

  const wordFrom = (target: EventTarget | null) =>
    target instanceof HTMLElement ? target.closest<HTMLElement>('[data-word]') : null;

  const resolve = (element: HTMLElement): Omit<Active, 'element'> | null => {
    const sentence = byId.get(element.dataset.sentence ?? '');
    const index = Number(element.dataset.index);
    const token = sentence?.tokens[index];
    if (!sentence || !token) return null;
    const entryIndex = glossaryForSentence(sentence, glossary).get(index);
    return {
      sentence,
      token,
      entry: entryIndex === undefined ? null : (glossary[entryIndex] ?? null),
    };
  };

  const markUnknown = (element: HTMLElement) => {
    const found = resolve(element);
    if (!found) return;
    const lemma = found.entry?.lemma ?? found.token.l;
    void lexicon.setStatus(lemma, 'new');
    setAnnouncement(t('lexicon.markedUnknown', { word: lemma }));
  };

  const open = (element: HTMLElement) => {
    const found = resolve(element);
    if (!found) return;
    lexicon.mark(found.entry?.lemma ?? found.token.l);
    setActive({ element, ...found });
  };

  const onClick = (event: MouseEvent) => {
    const element = wordFrom(event.target);
    if (!element) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (mode === 'help') open(element);
  };

  const onContextMenu = (event: MouseEvent) => {
    const element = wordFrom(event.target);
    if (!element) return;
    event.preventDefault();
    // En táctil, la pulsación larga ya la ha marcado (y también dispara este evento).
    if (!suppressClick.current) markUnknown(element);
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    const element = wordFrom(event.target);
    if (!element) return;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      markUnknown(element);
    }, LONG_PRESS_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const element = wordFrom(event.target);
    if (!element || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (key === 'arrowright' || key === 'arrowleft') {
      const words = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-word]') ?? [])];
      const next = words[words.indexOf(element) + (key === 'arrowright' ? 1 : -1)];
      // Las flechas son del texto mientras el foco está en él (no del reproductor).
      event.preventDefault();
      event.stopPropagation();
      next?.focus();
    } else if (key === 'm') {
      event.preventDefault();
      markUnknown(element);
    } else if (key === 'g' && mode === 'help') {
      event.preventDefault();
      open(element);
    }
  };

  const onFocus = (event: FocusEvent) => {
    const element = wordFrom(event.target);
    if (!element) return;
    rootRef.current
      ?.querySelectorAll('[data-word][tabindex="0"]')
      .forEach((other) => other.setAttribute('tabindex', '-1'));
    element.setAttribute('tabindex', '0');
  };

  const lemma = active ? (active.entry?.lemma ?? active.token.l) : '';
  const status = active ? lexicon.statusOf(lemma) : undefined;
  const level = active ? lexicon.levelOf(lemma) : undefined;
  const cardKey = active?.entry ? `${kindOfEntry(active.entry)}:${active.entry.lemma}` : null;
  const hasCard = cardKey ? lexicon.hasCard(cardKey) : false;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  return (
    <LayerContext.Provider value={value}>
      <div
        ref={rootRef}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      >
        {children}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Popover.Root open={active !== null} onOpenChange={(next) => !next && setActive(null)}>
        <Popover.Anchor virtualRef={{ current: active?.element ?? null }} />
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label={t('lexicon.glossaryOf', { word: lemma })}
            className="z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 text-body-sm"
          >
            {active ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      lang="en"
                      className="prose-reading text-body-lg font-medium text-accent-text"
                    >
                      {active.entry?.lemma ?? active.token.l}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {active.entry && POS_LABEL[active.entry.pos] ? (
                        <Chip>{t(POS_LABEL[active.entry.pos] ?? 'lexicon.posPhrase')}</Chip>
                      ) : null}
                      {level ? <Chip className="tabular-nums">{level}</Chip> : null}
                      {status ? <Chip>{t(STATUS_LABEL[status])}</Chip> : null}
                    </div>
                  </div>
                  <Popover.Close
                    aria-label={t('common.close')}
                    className="btn-icon -mt-2 -mr-2 hover:bg-surface"
                  >
                    <X aria-hidden="true" className="size-4" strokeWidth={2} />
                  </Popover.Close>
                </div>

                {active.entry ? (
                  <div className="flex flex-col gap-1.5">
                    <p lang="en">{active.entry.def_en}</p>
                    <p className="text-muted">{active.entry.def_es}</p>
                    {active.entry.example ? (
                      <p
                        lang="en"
                        className="prose-reading border-l-2 border-border pl-3 text-muted"
                      >
                        {active.entry.example}
                      </p>
                    ) : null}
                    {active.entry.note_es ? (
                      <p className="text-muted">{active.entry.note_es}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted">{t('lexicon.notInGlossary')}</p>
                )}

                {onPlayWord && active.token.s !== undefined ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onPlayWord(active.token)}>
                      <Play aria-hidden="true" strokeWidth={2} />
                      {t('lexicon.playWord')}
                    </Button>
                    {onPlaySentence ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPlaySentence(active.sentence.id)}
                      >
                        <Play aria-hidden="true" strokeWidth={2} />
                        {t('lexicon.playSentence')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {active.entry ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || hasCard}
                      onClick={() =>
                        void run(() =>
                          lexicon.addToReview([{ kind: 'word', lemma: active.entry?.lemma ?? '' }]),
                        )
                      }
                    >
                      <BookmarkPlus aria-hidden="true" strokeWidth={2} />
                      {hasCard ? t('lexicon.inReview') : t('lexicon.addToReview')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || status === 'known'}
                    onClick={() => void run(() => lexicon.setStatus(lemma, 'known'))}
                  >
                    <Check aria-hidden="true" strokeWidth={2} />
                    {t('lexicon.iKnowIt')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || status === 'new' || status === 'learning'}
                    onClick={() => void run(() => lexicon.setStatus(lemma, 'new'))}
                  >
                    <CircleHelp aria-hidden="true" strokeWidth={2} />
                    {t('lexicon.iDontKnowIt')}
                  </Button>
                </div>
                {lexicon.failed ? (
                  <p role="alert" className="text-error">
                    {t('errors.saveFailed')}
                  </p>
                ) : null}
              </>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </LayerContext.Provider>
  );
}

/**
 * Las palabras de una frase dentro de un `WordLayer`. Fuera de él (o en una fase sin ayudas)
 * hay que pintar el texto tal cual, no este componente.
 */
export function Words({
  sentence,
  wordProps,
}: {
  sentence: WordSentence;
  /** Atributos extra por token (karaoke, rasgos de habla conectada). */
  wordProps?: (token: WordToken, index: number) => Record<string, string | undefined>;
}) {
  const layer = useContext(LayerContext);
  if (!layer) throw new Error('<Words> se ha usado fuera de <WordLayer>');
  const { lexicon, glossary } = layer;

  const entries = useMemo(() => glossaryForSentence(sentence, glossary), [sentence, glossary]);

  return (
    <>
      {sentence.tokens.map((token, index) => {
        const space = token.sp ? ' ' : '';
        if (!isWord(token.t)) {
          return (
            <span key={index} {...wordProps?.(token, index)}>
              {token.t}
              {space}
            </span>
          );
        }
        const entry = entries.get(index);
        const lemma = entry === undefined ? token.l : (glossary[entry]?.lemma ?? token.l);
        const status = lexicon.statusOf(lemma);
        return (
          <span key={index}>
            <button
              type="button"
              tabIndex={-1}
              data-word=""
              data-sentence={sentence.id}
              data-index={index}
              data-lex={status === 'new' || status === 'learning' ? status : undefined}
              data-gloss={entry === undefined ? undefined : ''}
              {...wordProps?.(token, index)}
            >
              {token.t}
            </button>
            {space}
          </span>
        );
      })}
    </>
  );
}
