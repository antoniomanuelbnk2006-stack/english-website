'use client';

import { Play } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { InlineText } from '@/components/ui/inline-text';
import type { ListeningTranscript } from '@/features/listening/lib/views';
import { wordAt } from '@/lib/audio/segments';
import { player, usePlayer } from '@/lib/audio/store';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

type Segment = ListeningTranscript['segments'][number];
type Feature = ListeningTranscript['connectedSpeech'][number];

/** Índices de los tokens del segmento que caen dentro de alguna frase con rasgo marcado. */
function featuredTokens(segment: Segment, features: readonly Feature[]): Set<number> {
  const marked = new Set<number>();
  const text = segment.text.toLowerCase();
  for (const feature of features) {
    const from = text.indexOf(feature.phrase.toLowerCase());
    if (from < 0) continue;
    const to = from + feature.phrase.length;
    let offset = 0;
    segment.tokens.forEach((token, index) => {
      const start = offset;
      offset += token.t.length + (token.sp ? 1 : 0);
      if (start < to && start + token.t.length > from && /[\p{L}\p{N}]/u.test(token.t)) {
        marked.add(index);
      }
    });
  }
  return marked;
}

/**
 * Transcripción con karaoke por palabra. La palabra activa se marca con un atributo sobre su
 * nodo (solo cambian dos nodos por paso): la transcripción no vuelve a renderizarse al sonar.
 */
export function Transcript({
  segments,
  speakers,
  features,
  highlight,
}: {
  segments: readonly Segment[];
  speakers: readonly { id: string; name: string }[];
  features: readonly Feature[];
  /** Ids de segmentos a destacar (donde estaba la respuesta de una pregunta). */
  highlight?: readonly string[];
}) {
  const t = useT();
  const rootRef = useRef<HTMLOListElement>(null);
  const segmentIndex = usePlayer((state) => state.segmentIndex);
  const playing = usePlayer((state) => state.playing);
  const names = useMemo(() => new Map(speakers.map((s) => [s.id, s.name])), [speakers]);
  const marked = new Set(highlight);

  // Inicios de las palabras con tiempo, en una lista plana y ordenada.
  const starts = useMemo(
    () =>
      segments.flatMap((segment) =>
        segment.tokens.flatMap((token) => (token.s === undefined ? [] : [token.s])),
      ),
    [segments],
  );

  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[data-w]');
    if (!nodes) return;
    let active = -1;
    const paint = (time: number) => {
      const index = wordAt(starts, time);
      if (index === active) return;
      if (active >= 0) nodes[active]?.removeAttribute('data-active');
      if (index >= 0) nodes[index]?.setAttribute('data-active', '');
      active = index;
    };
    const unsubscribe = player.onTime(paint);
    return () => {
      unsubscribe();
      if (active >= 0) nodes[active]?.removeAttribute('data-active');
    };
  }, [starts]);

  // Mantiene a la vista la frase que suena.
  useEffect(() => {
    if (!playing) return;
    const node = rootRef.current?.children[segmentIndex];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [segmentIndex, playing]);

  // Lleva a la vista la frase destacada.
  const firstMarked = highlight?.[0];
  useEffect(() => {
    if (!firstMarked) return;
    rootRef.current
      ?.querySelector(`[data-segment="${CSS.escape(firstMarked)}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [firstMarked]);

  return (
    <ol ref={rootRef} className="flex flex-col gap-4">
      {segments.map((segment, index) => {
        const own = features.filter((feature) => feature.ref === segment.id);
        const underlined = featuredTokens(segment, own);
        return (
          <li
            key={segment.id}
            data-segment={segment.id}
            className={cn(
              'flex gap-3 rounded-control p-2 transition-colors duration-200',
              marked.has(segment.id) && 'bg-karaoke',
            )}
          >
            <button
              type="button"
              aria-label={`${t('listening.playSegment')} (${index + 1})`}
              onClick={() => player.playSegment(index)}
              className="mt-1 grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              <Play aria-hidden="true" className="size-4" strokeWidth={2} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hud text-xs text-muted">
                {names.get(segment.speaker) ?? segment.speaker}
              </p>
              <p lang="en" className="reading-md">
                {segment.tokens.map((token, i) => {
                  const timed = token.s !== undefined;
                  return (
                    <span key={i}>
                      <span
                        data-w={timed ? '' : undefined}
                        data-feature={underlined.has(i) ? '' : undefined}
                      >
                        {token.t}
                      </span>
                      {token.sp ? ' ' : ''}
                    </span>
                  );
                })}
              </p>
              {own.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1 text-sm text-muted">
                  {own.map((feature) => (
                    <li key={feature.phrase}>
                      <span lang="en" className="font-medium text-text">
                        {feature.phrase}
                      </span>
                      {feature.ipa ? <span className="hud"> {feature.ipa}</span> : null}
                      {' — '}
                      <InlineText text={feature.explanation_es} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
