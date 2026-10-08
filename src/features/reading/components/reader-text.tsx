'use client';

import { useEffect, useRef } from 'react';
import type { ReadingLesson } from '@/lib/content/loader';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/**
 * Texto de una lección de lectura: tipografía de lectura, medida de 60–72 caracteres y
 * párrafos numerados (las preguntas se refieren a ellos). Es texto real, no imágenes.
 */
export function ReaderText({
  paragraphs,
  highlight,
  fontPx,
  className,
}: {
  paragraphs: ReadingLesson['paragraphs'];
  /** Ids de frases o párrafos a resaltar (evidencia de una pregunta). */
  highlight?: readonly string[];
  fontPx: number;
  className?: string;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const marked = new Set(highlight);
  const firstMarked = highlight?.[0];

  // Lleva a la vista la primera frase resaltada.
  useEffect(() => {
    if (!firstMarked) return;
    const target = rootRef.current?.querySelector(`[data-ref="${CSS.escape(firstMarked)}"]`);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [firstMarked]);

  return (
    <div
      ref={rootRef}
      lang="en"
      className={cn('reading-md reading-measure flex flex-col gap-5', className)}
      style={{ fontSize: `${fontPx}px`, lineHeight: 1.7 }}
    >
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph.id}
          data-ref={paragraph.id}
          className={cn(
            'relative pl-7 transition-colors duration-200',
            marked.has(paragraph.id) && 'rounded-control bg-karaoke',
          )}
        >
          <span
            lang="es"
            title={t('reading.paragraphNumber', { n: index + 1 })}
            className="hud absolute top-[0.35em] left-0 text-xs text-muted select-none"
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
                marked.has(sentence.id) && 'rounded-sm bg-karaoke box-decoration-clone',
              )}
            >
              {sentence.text}{' '}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
