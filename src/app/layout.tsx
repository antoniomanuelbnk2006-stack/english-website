import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist_Mono, Literata, Wix_Madefor_Text } from 'next/font/google';
import { cookies } from 'next/headers';
import { getDictionary } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from '@/lib/theme';
import '@/styles/globals.css';

const madefor = Wix_Madefor_Text({ variable: '--font-madefor', subsets: ['latin'] });
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const literata = Literata({ variable: '--font-literata', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Señal', template: '%s · Señal' },
  description: 'Listening y reading con diagnóstico, repaso espaciado y plan diario.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#fcf9f2',
  colorScheme: 'dark light',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Leer cookies hace dinámicas todas las páginas, que es lo que exige la CSP con nonce.
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${madefor.variable} ${fraunces.variable} ${geistMono.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
