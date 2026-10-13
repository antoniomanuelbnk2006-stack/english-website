'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { AccentPicker, useAccent } from '@/features/pronunciation/components/accent-picker';
import { PracticeCard } from '@/features/pronunciation/components/practice-card';
import { cleanFreeText, FREE_TEXT_MAX } from '@/features/pronunciation/lib/free-text';
import { useT } from '@/lib/i18n/client';

/** Práctica libre: se escribe cualquier palabra o frase en inglés y se practica. No se guarda. */
export function FreePractice({ initial }: { initial: string }) {
  const t = useT();
  const accent = useAccent();
  const [draft, setDraft] = useState(initial);
  const [text, setText] = useState(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    setText(cleanFreeText(draft));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="free-text">{t('pronunciation.freeLabel')}</Label>
          <Input
            id="free-text"
            lang="en"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            maxLength={FREE_TEXT_MAX}
            placeholder={t('pronunciation.freePlaceholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={cleanFreeText(draft) === ''}>
          {t('pronunciation.freeButton')}
        </Button>
      </form>

      <AccentPicker />

      {text ? (
        <PracticeCard key={`${text}-${accent}`} text={text} accent={accent} />
      ) : (
        <p className="text-body-sm text-muted">{t('pronunciation.freeHint')}</p>
      )}
      <p className="text-caption text-muted">{t('pronunciation.privacy')}</p>
    </div>
  );
}
