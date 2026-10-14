import { LOCALES, LOCALE_NAMES, htmlLang, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Cambiar el idioma de una página pública (ADR-0032): un enlace por idioma, cada uno escrito en el
 * suyo, para que lo reconozca quien lo habla. Lleva el idioma en la dirección (`?lang=`) y vale
 * para esa página: no guarda nada. Dentro de la app, el idioma se elige en Ajustes.
 */
export function LanguageLinks({
  path,
  current,
  label,
}: {
  path: string;
  current: Locale;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-4 text-caption">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <a
                href={`${path}?lang=${locale}`}
                lang={htmlLang(locale)}
                hrefLang={htmlLang(locale)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center',
                  active
                    ? 'font-medium text-text'
                    : 'text-muted underline underline-offset-4 hover:text-text',
                )}
              >
                {LOCALE_NAMES[locale]}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
