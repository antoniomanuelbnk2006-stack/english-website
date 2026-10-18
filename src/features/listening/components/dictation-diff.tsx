'use client';

import type { Diagnosis } from '@/features/listening/lib/dictation';
import { useT } from '@/lib/i18n/client';
import { useContentLang } from '@/components/content-language';

/** Frase de referencia con cada palabra marcada según cómo se escribió. */
export function DictationDiff({ diagnosis }: { diagnosis: Diagnosis }) {
  const t = useT();
  const lang = useContentLang();
  return (
    <p lang={lang} className="prose-reading">
      {diagnosis.words.map((word, index) => (
        <span key={index}>
          {word.status === 'ok' ? (
            word.text
          ) : word.status === 'typo' ? (
            <span
              className="underline decoration-warning decoration-dotted decoration-2 underline-offset-4"
              title={t('listening.wrote', { typed: word.typed ?? '' })}
            >
              {word.text}
            </span>
          ) : word.status === 'wrong' ? (
            <>
              <del className="text-error">{word.typed}</del>{' '}
              <ins className="font-medium text-success no-underline">{word.text}</ins>
            </>
          ) : (
            <span className="font-medium text-error underline decoration-dashed underline-offset-4">
              {word.text}
              <span lang="es" className="sr-only">
                {' '}
                ({t('listening.missing')})
              </span>
            </span>
          )}{' '}
        </span>
      ))}
    </p>
  );
}
