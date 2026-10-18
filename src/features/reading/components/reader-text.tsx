'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { LexiconSession } from '@/features/lexicon/components/use-lexicon-session';
import { WordLayer, Words } from '@/features/lexicon/components/word-layer';
import type { ReadingLesson } from '@/lib/content/loader';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { useContentLang } from '@/components/content-language';

/**
 * Texto de una lección de lectura: tipografía de lectura, medida de 60–72 caracteres y
 * párrafos numerados (las preguntas se refieren a ellos). Es texto real, no imágenes.
 * Con `words`, cada palabra se puede marcar como desconocida y, en modo «help», abre su glosario.
 */
export function ReaderText({
  paragraphs,
  highlight,
  fontPx,
  className,
  words,
}: {
  paragraphs: ReadingLesson['paragraphs'];
  /** Ids de frases o párrafos a resaltar (evidencia de una pregunta). */
  highlight?: readonly string[];
  fontPx: number;
  className?: string;
  words?: {
    mode: 'immersion' | 'help';
    lexicon: LexiconSession;
    glossary: ReadingLesson['glossary'];
  };
}) {
  const t = useT();
  const lang = useContentLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const marked = new Set(highlight);
  const firstMarked = highlight?.[0];
  const sentences = useMemo(() => paragraphs.flatMap((p) => p.sentences), [paragraphs]);

  // Lleva a la vista la primera frase resaltada.
  useEffect(() => {
    if (!firstMarked) return;
    const target = rootRef.current?.querySelector(`[data-ref="${CSS.escape(firstMarked)}"]`);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [firstMarked]);

  const body = (
    <div
      ref={rootRef}
      lang={lang}
      className={cn('prose-reading flex flex-col gap-5', className)}
      style={{ fontSize: `${fontPx}px`, lineHeight: 1.7 }}
    >
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph.id}
          data-ref={paragraph.id}
          className={cn(
            'relative pl-7 transition-colors duration-200',
            marked.has(paragraph.id) && 'rounded-card bg-accent/25',
          )}
        >
          <span
            lang="es"
            title={t('reading.paragraphNumber', { n: index + 1 })}
            className="tabular-nums absolute top-[0.35em] left-0 text-caption text-muted select-none"
          >
            <span aria-hidden="true">{index + 1}</span>
            <span className="sr-only">{t('reading.paragraphNumber', { n: index + 1 })}. </span>
          </span>
          {paragraph.sentences.map((sentence) => (
            <span
              key={sentence.id}
              data-ref={sentence.id}
              className={cn(
                'transition-colors duration-200',
                marked.has(sentence.id) && 'rounded-structure bg-accent/25 box-decoration-clone',
              )}
            >
              {words ? <Words sentence={sentence} /> : sentence.text}{' '}
            </span>
          ))}
        </p>
      ))}
    </div>
  );

  if (!words) return body;
  return (
    <WordLayer
      mode={words.mode}
      sentences={sentences}
      glossary={words.glossary}
      lexicon={words.lexicon}
    >
      {body}
    </WordLayer>
  );
}
