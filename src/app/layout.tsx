import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { CookieBanner } from '@/features/consent/components/cookie-banner';
import { SAFE_MODE_HEADER } from '@/features/theme/lib/custom-css';
import { getCustomThemeCss } from '@/features/theme/server/queries';
import { CONSENT_COOKIE, parseConsent } from '@/lib/consent';
import { getDictionary, htmlLang } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import { getUiPreferences } from '@/lib/preferences';
import '@/styles/globals.css';

// MASTER §3: Inter (variable) para el cuerpo y Archivo para los titulares, con su eje de anchura
// (los titulares van al 112 %).
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  display: 'swap',
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: { default: 'Señal', template: '%s · Señal' },
  description: 'Listening y reading con diagnóstico, repaso espaciado y plan diario.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // El `canvas` de MASTER: aquí hace falta el valor, no puede ser una variable CSS.
  themeColor: '#171721',
  colorScheme: 'dark light',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Leer cookies hace dinámicas todas las páginas, que es lo que exige la CSP con nonce.
  const [{ theme, locale }, cookieStore, requestHeaders, savedTheme] = await Promise.all([
    getUiPreferences(),
    cookies(),
    headers(),
    getCustomThemeCss(),
  ]);
  // El tema personalizado (ADR-0033), salvo en modo seguro (`?sin-tema`).
  const customCss = requestHeaders.has(SAFE_MODE_HEADER) ? null : savedTheme;
  // Mientras no haya decisión sobre las cookies, se pregunta (ADR-0028).
  const undecided = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value) === null;

  return (
    <html
      lang={htmlLang(locale)}
      data-theme={theme}
      className={`${inter.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-text">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          {children}
          {undecided ? <CookieBanner /> : null}
        </I18nProvider>
        {/* Al final, para que mande sobre el diseño de siempre. `checkThemeCss` no admite «<»,
            así que no puede cerrar la etiqueta; y la CSP no deja que cargue nada de fuera. */}
        {customCss ? (
          <style data-custom-theme="" dangerouslySetInnerHTML={{ __html: customCss }} />
        ) : null}
      </body>
    </html>
  );
}
