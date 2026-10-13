'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { MAX_CHARS, MIN_CHARS } from '@/features/writing/lib/input';
import { saveRewrite } from '@/features/writing/server/actions';
import { countWords } from '@/lib/content/writing-schema';
import { useT } from '@/lib/i18n/client';

/** La reescritura: el usuario corrige su propio texto con el feedback delante. */
export function RewritePanel({
  submissionId,
  original,
  saved,
}: {
  submissionId: string;
  original: string;
  /** La reescritura ya guardada, si la hay. */
  saved: string | null;
}) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState(saved ?? original);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [savedWords, setSavedWords] = useState<number | null>(null);

  const length = text.trim().length;
  const invalid = length < MIN_CHARS || length > MAX_CHARS;
  const words = countWords(text);

  async function save() {
    setState('saving');
    const response = await saveRewrite({ submissionId, text }).catch(() => null);
    if (response?.ok) {
      setSavedWords(response.data.words);
      setState('idle');
    } else {
      setState('failed');
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-body-lg font-medium">
        {t('writing.rewriteTitle')}
      </h2>
      <p className="text-body-sm text-muted">{t('writing.rewriteHint')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-text`}>{t('writing.rewriteLabel')}</Label>
        <Textarea
          id={`${id}-text`}
          lang="en"
          rows={12}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSavedWords(null);
          }}
          className="prose-reading"
        />
        <p className="tabular-nums text-caption text-muted">
          {words === 1 ? t('writing.wordCountOne') : t('writing.wordCount', { n: words })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={state === 'saving' || invalid} onClick={() => void save()}>
          {state === 'saving' ? t('common.saving') : t('writing.saveRewrite')}
        </Button>
        <p role="status" className="text-body-sm">
          {savedWords !== null ? (
            <span className="text-success">{t('writing.rewriteSaved', { n: savedWords })}</span>
          ) : state === 'failed' ? (
            <span className="text-error">{t('errors.saveFailed')}</span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
