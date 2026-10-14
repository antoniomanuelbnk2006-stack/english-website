import {
  PREFERENCE_COOKIES,
  PREFERENCE_STORAGE_KEYS,
  allowsPreferences,
  consentCookieString,
  consentFromCookieString,
  expiredCookieString,
  type Consent,
} from '@/lib/consent';

// La decisión sobre las cookies se guarda desde el navegador (ADR-0028): así el aviso de la
// portada, que es HTML estático, y el de la app escriben exactamente la misma cookie.

const isSecure = () => window.location.protocol === 'https:';

/** ¿Se pueden guardar preferencias en este navegador? Solo si se han aceptado. */
export function preferencesAllowed(): boolean {
  return allowsPreferences(consentFromCookieString(document.cookie));
}

/**
 * Guarda la decisión. Al quedarse solo con las necesarias, borra las preferencias que hubiera:
 * rechazar tiene que deshacer lo que se aceptó antes.
 */
export function saveConsent(choice: Consent): void {
  document.cookie = consentCookieString(choice, isSecure());
  if (allowsPreferences(choice)) return;

  for (const name of PREFERENCE_COOKIES) document.cookie = expiredCookieString(name, isSecure());
  try {
    for (const key of PREFERENCE_STORAGE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento (modo privado estricto) no había nada que borrar.
  }
}
