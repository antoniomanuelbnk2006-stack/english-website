'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { logInput } from '@/features/journal/server/actions';
import { useT } from '@/lib/i18n/client';

/** Registro detallado: título, enlace, nivel percibido y palabras leídas. */
export function JournalForm() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<'extensive_listening' | 'extensive_reading'>(
    'extensive_listening',
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '');
    const words = text('words');
    const level = text('level');

    setError(null);
    startTransition(async () => {
      const result = await logInput({
        kind,
        minutes: Number(text('minutes')),
        title: text('title'),
        url: text('url'),
        perceivedLevel: level === '' ? undefined : level,
        words: kind === 'extensive_reading' && words !== '' ? Number(words) : undefined,
      });
      if (result.ok) {
        form.reset();
        router.refresh();
      } else {
        setError(
          result.error === 'invalid_input' ? t('journal.errorInvalid') : t('errors.saveFailed'),
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-body-sm font-medium">{t('journal.kindLabel')}</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['extensive_listening', t('journal.quickListening')],
              ['extensive_reading', t('journal.quickReading')],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="size-4 accent-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-minutes">{t('journal.minutesLabel')}</Label>
        <Input
          id="journal-minutes"
          name="minutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          required
          className="tabular-nums"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-level">{t('journal.levelLabel')}</Label>
        <Select id="journal-level" name="level" defaultValue="">
          <option value="">{t('journal.levelUnknown')}</option>
          {CEFR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="journal-title">
          {t('journal.titleLabel')}{' '}
          <span className="font-normal text-muted">({t('common.optional')})</span>
        </Label>
        <Input
          id="journal-title"
          name="title"
          maxLength={200}
          placeholder={t('journal.titlePlaceholder')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-url">
          {t('journal.urlLabel')}{' '}
          <span className="font-normal text-muted">({t('common.optional')})</span>
        </Label>
        <Input id="journal-url" name="url" type="url" inputMode="url" placeholder="https://" />
      </div>

      {kind === 'extensive_reading' ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="journal-words">
            {t('journal.wordsLabel')}{' '}
            <span className="font-normal text-muted">({t('common.optional')})</span>
          </Label>
          <Input
            id="journal-words"
            name="words"
            type="number"
            inputMode="numeric"
            min={0}
            max={500000}
            className="tabular-nums"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:col-span-2">
        <FieldError id="journal-error">{error}</FieldError>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t('common.saving') : t('journal.add')}
        </Button>
      </div>
    </form>
  );
}
