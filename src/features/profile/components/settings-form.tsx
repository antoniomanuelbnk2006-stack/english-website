'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { PageSections } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import {
  INTEREST_TOPICS,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  READING_FONT_MAX,
  READING_FONT_MIN,
  type InterestTopic,
} from '@/features/profile/lib/settings';
import { updateSettings } from '@/features/profile/server/actions';
import type { Locale } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import type { Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export interface SettingsValues {
  dailyGoalMin: number;
  interests: string[];
  uiLocale: Locale;
  theme: Theme;
  readingFontPx: number;
  readerPaper: boolean;
  playbackRate: number;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setStatus(null);
  };

  const toggleInterest = (topic: InterestTopic) =>
    set(
      'interests',
      values.interests.includes(topic)
        ? values.interests.filter((item) => item !== topic)
        : [...values.interests, topic],
    );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateSettings(values);
      if (result.ok) {
        setStatus({ ok: true, text: t('settings.saved') });
        // El tema y el idioma se aplican en el servidor: hay que volver a pedir la página.
        router.refresh();
      } else {
        setStatus({
          ok: false,
          text:
            result.error === 'invalid_input' ? t('settings.errorInvalid') : t('errors.saveFailed'),
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
      <PageSections>
        <Panel className="flex flex-col gap-6">
          <PanelTitle>{t('settings.studyTitle')}</PanelTitle>

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-goal">{t('settings.goalLabel')}</Label>
            <Input
              id="settings-goal"
              type="number"
              inputMode="numeric"
              min={10}
              max={240}
              step={5}
              className="tabular-nums max-w-32"
              aria-describedby="settings-goal-hint"
              value={values.dailyGoalMin}
              onChange={(event) => set('dailyGoalMin', Number(event.target.value))}
            />
            <p id="settings-goal-hint" className="text-body-sm text-muted">
              {t('settings.goalHint')}
            </p>
          </div>

          <fieldset>
            <legend className="text-body-sm font-medium">{t('settings.interestsLabel')}</legend>
            <p className="mt-1 mb-3 text-body-sm text-muted">{t('settings.interestsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_TOPICS.map((topic) => {
                const selected = values.interests.includes(topic);
                return (
                  <label
                    key={topic}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-body-sm transition-colors duration-150',
                      selected
                        ? 'border-accent bg-surface-2 font-medium text-accent-text'
                        : 'border-transparent bg-surface-2 text-muted hover:border-border',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={selected}
                      onChange={() => toggleInterest(topic)}
                    />
                    {t(`topics.${topic}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-rate">{t('settings.playbackLabel')}</Label>
            <div className="flex items-center gap-3">
              <input
                id="settings-rate"
                type="range"
                min={PLAYBACK_RATE_MIN}
                max={PLAYBACK_RATE_MAX}
                step={0.05}
                className="h-11 w-full max-w-xs accent-accent"
                value={values.playbackRate}
                onChange={(event) => set('playbackRate', Number(event.target.value))}
              />
              <output htmlFor="settings-rate" className="tabular-nums w-14 text-body-sm">
                {values.playbackRate.toFixed(2)}×
              </output>
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-6">
          <PanelTitle>{t('settings.appearanceTitle')}</PanelTitle>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-theme">{t('settings.themeLabel')}</Label>
              <Select
                id="settings-theme"
                value={values.theme}
                onChange={(event) => set('theme', event.target.value as Theme)}
              >
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-locale">{t('settings.localeLabel')}</Label>
              <Select
                id="settings-locale"
                value={values.uiLocale}
                onChange={(event) => set('uiLocale', event.target.value as Locale)}
              >
                <option value="es">{t('settings.localeEs')}</option>
                <option value="en">{t('settings.localeEn')}</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-font">{t('settings.fontLabel')}</Label>
            <div className="flex items-center gap-3">
              <input
                id="settings-font"
                type="range"
                min={READING_FONT_MIN}
                max={READING_FONT_MAX}
                step={1}
                className="h-11 w-full max-w-xs accent-accent"
                value={values.readingFontPx}
                onChange={(event) => set('readingFontPx', Number(event.target.value))}
              />
              <output htmlFor="settings-font" className="tabular-nums w-14 text-body-sm">
                {values.readingFontPx} px
              </output>
            </div>
            <div
              data-theme={values.readerPaper ? 'paper' : undefined}
              className="rounded-card bg-surface-2 p-4"
            >
              <p
                lang="en"
                className="prose-reading"
                style={{ fontSize: `${values.readingFontPx}px`, lineHeight: 1.7 }}
              >
                {t('settings.fontSample')}
              </p>
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={values.readerPaper}
              onChange={(event) => set('readerPaper', event.target.checked)}
            />
            {t('settings.paperLabel')}
          </label>
        </Panel>
      </PageSections>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t('common.saving') : t('common.save')}
        </Button>
        {status?.ok ? (
          <p role="status" className="text-body-sm text-success">
            {status.text}
          </p>
        ) : (
          <FieldError id="settings-error">{status?.text}</FieldError>
        )}
      </div>
    </form>
  );
}
