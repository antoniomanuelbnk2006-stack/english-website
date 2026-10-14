// Consentimiento de cookies (ADR-0028). Señal guarda dos clases de cosas en el navegador:
//
//  - Necesarias: la sesión, esta misma decisión y lo que se escribe al usar la app (el borrador
//    de un writing, un examen a medias). Van siempre: sin ellas la app no funciona.
//  - De preferencias: el tema, el idioma y el acento, para recordarlos en este navegador. Solo
//    si la persona las acepta; si no, el tema y el idioma salen de su perfil.
//
// No hay cookies de análisis ni de publicidad. Lo que diga este fichero tiene que coincidir con
// la política publicada en public/landing/cookies.html y con el aviso de public/landing/app.js.

export const CONSENT_COOKIE = 'senal_consent';

/** Dónde se explica qué cookies hay: una página de la portada, pública. */
export const COOKIE_POLICY_URL = '/landing/cookies.html';

/** Sube cuando cambia lo que se pide (una categoría nueva): la decisión anterior deja de valer. */
export const CONSENT_VERSION = 1;

/** Seis meses: pasado ese tiempo se vuelve a preguntar. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;

export const CONSENT_CHOICES = ['all', 'necessary'] as const;
/** `all`: necesarias y de preferencias. `necessary`: solo las necesarias. */
export type Consent = (typeof CONSENT_CHOICES)[number];

/** Cookies de preferencias (las de src/lib/theme.ts y src/lib/i18n; un test vigila que coincidan). */
export const PREFERENCE_COOKIES = ['senal_theme', 'senal_locale'] as const;

/** Claves de `localStorage` que son preferencias (el acento de src/features/pronunciation). */
export const PREFERENCE_STORAGE_KEYS = ['senal:accent'] as const;

/** La decisión guardada en la cookie, o `null` si no hay ninguna que valga para esta versión. */
export function parseConsent(value: string | null | undefined): Consent | null {
  const parts = (value ?? '').split('.');
  if (parts.length !== 2 || parts[0] !== `v${CONSENT_VERSION}`) return null;
  return CONSENT_CHOICES.find((option) => option === parts[1]) ?? null;
}

export function serializeConsent(choice: Consent): string {
  return `v${CONSENT_VERSION}.${choice}`;
}

/** Sin decisión no se guarda nada opcional: hace falta haber aceptado. */
export function allowsPreferences(consent: Consent | null): boolean {
  return consent === 'all';
}

/** La decisión que hay en un `document.cookie` (o en una cabecera `Cookie`). */
export function consentFromCookieString(cookies: string): Consent | null {
  for (const pair of cookies.split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === CONSENT_COOKIE) {
      return parseConsent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

const attributes = (secure: boolean) => `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;

/** Lo que se asigna a `document.cookie` para guardar la decisión. */
export function consentCookieString(choice: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(choice)}; Max-Age=${CONSENT_MAX_AGE}; ${attributes(secure)}`;
}

/** Lo que se asigna a `document.cookie` para borrar una cookie de preferencias. */
export function expiredCookieString(name: string, secure: boolean): string {
  return `${name}=; Max-Age=0; ${attributes(secure)}`;
}
