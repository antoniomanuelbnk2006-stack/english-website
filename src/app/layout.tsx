import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { CookieBanner } from '@/features/consent/components/cookie-banner';
import { CONSENT_COOKIE, parseConsent } from '@/lib/consent';
import { getDictionary } from '@/lib/i18n';
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
  const [{ theme, locale }, cookieStore] = await Promise.all([getUiPreferences(), cookies()]);
  // Mientras no haya decisión sobre las cookies, se pregunta (ADR-0028).
  const undecided = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value) === null;

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${inter.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-text">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          {children}
          {undecided ? <CookieBanner /> : null}
        </I18nProvider>
      </body>
    </html>
  );
}
