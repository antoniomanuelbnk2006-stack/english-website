'use client';

import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ChangeEvent } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { FieldError, Label, Textarea } from '@/components/ui/input';
import {
  MAX_THEME_CHARS,
  SAFE_MODE_PARAM,
  THEME_CATALOG_URL,
  checkThemeCss,
  type ThemeProblem,
} from '@/features/theme/lib/custom-css';
import {
  EXAMPLE_THEMES,
  THEME_VARIABLES,
  type ExampleThemeId,
} from '@/features/theme/lib/examples';
import { clearCustomTheme, saveCustomTheme } from '@/features/theme/server/actions';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const PROBLEMS: Record<ThemeProblem, TranslationKey> = {
  too_long: 'customTheme.errorTooLong',
  markup: 'customTheme.errorMarkup',
  import: 'customTheme.errorImport',
  script: 'customTheme.errorScript',
};

const EXAMPLE_NAMES: Record<ExampleThemeId, TranslationKey> = {
  sepia: 'customTheme.exampleSepia',
  contrast: 'customTheme.exampleContrast',
  neon: 'customTheme.exampleNeon',
};

const isProblem = (value: string | undefined): value is ThemeProblem =>
  value !== undefined && value in PROBLEMS;

/**
 * Tema personalizado (ADR-0033): CSS propio que cambia el aspecto de toda la app. Se puede subir
 * un archivo, partir de un ejemplo, probarlo sin guardar, guardarlo y quitarlo. `saved` es el que
 * hay guardado; `safeMode`, si la página se ha abierto con `?sin-tema`.
 */
export function CustomTheme({ saved, safeMode }: { saved: string; safeMode: boolean }) {
  const t = useT();
  const router = useRouter();
  const [css, setCss] = useState(saved);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState<TranslationKey | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Probar sin guardar: el CSS va a una hoja al final de la página mientras dura la prueba.
  useEffect(() => {
    if (!previewing) return;
    const sheet = document.createElement('style');
    sheet.dataset.customThemePreview = '';
    sheet.textContent = css;
    document.body.append(sheet);
    return () => sheet.remove();
  }, [previewing, css]);

  // Lo que se va a probar o guardar pasa antes la misma comprobación que en el servidor.
  function checked(): string | null {
    const result = checkThemeCss(css);
    if (result.ok) return result.css;
    setError(PROBLEMS[result.reason]);
    setPreviewing(false);
    return null;
  }

  function pick(next: string) {
    setCss(next);
    setFileName(null);
    setStatus(null);
    setError(null);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_THEME_CHARS * 4) {
      setError('customTheme.errorTooLong');
      return;
    }
    try {
      pick(await file.text());
      setFileName(file.name);
    } catch {
      setError('customTheme.errorFile');
    }
  }

  function preview() {
    setStatus(null);
    setError(null);
    if (previewing) {
      setPreviewing(false);
      return;
    }
    if (checked() !== null) setPreviewing(true);
  }

  function save() {
    setStatus(null);
    setError(null);
    const clean = checked();
    if (clean === null) return;
    startTransition(async () => {
      const result = await saveCustomTheme({ css: clean });
      if (!result.ok) {
        setError(
          isProblem(result.message) ? PROBLEMS[result.message] : 'customTheme.errorInternal',
        );
        return;
      }
      setPreviewing(false);
      setStatus(clean === '' ? 'customTheme.removed' : 'customTheme.saved');
      // El servidor vuelve a pintar la página con el tema ya guardado.
      router.refresh();
    });
  }

  function remove() {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      const result = await clearCustomTheme();
      if (!result.ok) {
        setError('customTheme.errorInternal');
        return;
      }
      setPreviewing(false);
      pick('');
      setStatus('customTheme.removed');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-muted">{t('customTheme.intro')}</p>
      <p className="text-body-sm text-muted">
        {t('customTheme.safeHint')}{' '}
        <a
          href={`/ajustes?${SAFE_MODE_PARAM}`}
          className="text-accent-text underline underline-offset-4"
        >
          /ajustes?{SAFE_MODE_PARAM}
        </a>
      </p>
      {safeMode && saved !== '' ? (
        <p role="status" className="rounded-card bg-surface-2 p-4 text-body-sm">
          {t('customTheme.safeMode')}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-medium">{t('customTheme.examples')}</span>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_THEMES.map((example) => (
            <Button key={example.id} variant="ghost" onClick={() => pick(example.css)}>
              {t(EXAMPLE_NAMES[example.id])}
            </Button>
          ))}
        </div>
        <p className="text-body-sm text-muted">
          {t('customTheme.catalogHint')}{' '}
          <a
            href={THEME_CATALOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-text underline underline-offset-4"
          >
            {t('customTheme.catalogLink')}
            <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          </a>
        </p>
      </div>

      {/* El botón nativo saldría en el idioma del navegador: se esconde y hace de botón su
          etiqueta, que lleva el foco del campo. */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="custom-theme-file"
          type="file"
          accept=".css,text/css"
          onChange={upload}
          className="peer sr-only"
        />
        <label
          htmlFor="custom-theme-file"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          )}
        >
          {t('customTheme.fileLabel')}
        </label>
        {fileName ? <span className="text-body-sm break-all text-muted">{fileName}</span> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="custom-theme-css">{t('customTheme.cssLabel')}</Label>
        <Textarea
          id="custom-theme-css"
          value={css}
          onChange={(event) => pick(event.target.value)}
          rows={10}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder=":root, [data-theme] { --accent: #cf2c88; }"
          className="font-[ui-monospace,_SFMono-Regular,_Menlo,_Consolas,_monospace] text-body-sm"
          aria-describedby={error ? 'custom-theme-error' : undefined}
        />
        <FieldError id="custom-theme-error">{error ? t(error) : null}</FieldError>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={preview} aria-pressed={previewing} disabled={pending}>
          {previewing ? t('customTheme.stopPreview') : t('customTheme.preview')}
        </Button>
        <Button variant="secondary" onClick={save} disabled={pending}>
          {pending ? t('customTheme.saving') : t('customTheme.save')}
        </Button>
        {saved !== '' ? (
          <Button variant="ghost" onClick={remove} disabled={pending}>
            {t('customTheme.remove')}
          </Button>
        ) : null}
      </div>
      <p role="status" className="min-h-5 text-body-sm text-muted">
        {previewing ? t('customTheme.previewOn') : status ? t(status) : null}
      </p>

      <details className="text-body-sm text-muted">
        <summary className="cursor-pointer text-text">{t('customTheme.guideTitle')}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p>{t('customTheme.guideBody')}</p>
          <p>{t('customTheme.guideLimits')}</p>
          <p className="text-text">{t('customTheme.guideVariables')}</p>
          <ul className="flex flex-wrap gap-2">
            {THEME_VARIABLES.map((name) => (
              <li key={name}>
                <code className="tag">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
