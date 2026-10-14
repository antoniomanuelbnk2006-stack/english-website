// Tema personalizado (ADR-0033): CSS que el usuario sube o pega en Ajustes y que la app aplica en
// todas las pantallas, encima del diseño de MASTER. Aquí solo se decide si se puede guardar. Lo
// que impide que un tema cargue algo de otra web (y con ello rastree o se lleve datos) es la CSP
// de la app, que no admite imágenes, fuentes ni estilos de fuera: esto es la primera barrera.

/** Lo más largo que se guarda: de sobra para un tema, y poco para el perfil. */
export const MAX_THEME_CHARS = 50_000;

/** Con `?sin-tema` en la dirección, la página se pinta sin el tema (para poder quitarlo). */
export const SAFE_MODE_PARAM = 'sin-tema';
/** Cabecera con la que el proxy avisa al renderizado de que es el modo seguro. */
export const SAFE_MODE_HEADER = 'x-senal-sin-tema';

export type ThemeProblem = 'too_long' | 'markup' | 'import' | 'script';
export type ThemeCheck = { ok: true; css: string } | { ok: false; reason: ThemeProblem };

/**
 * ¿Se puede guardar este CSS? Devuelve el CSS limpio (saltos de línea normales y sin espacios
 * al principio ni al final) o el motivo para rechazarlo. Una cadena vacía vale: es «sin tema».
 */
export function checkThemeCss(raw: string): ThemeCheck {
  const css = raw.replace(/\r\n?/g, '\n').trim();
  if (css.length > MAX_THEME_CHARS) return { ok: false, reason: 'too_long' };
  // Va dentro de una etiqueta <style>: un «<» podría cerrarla y meter HTML en la página.
  if (css.includes('<')) return { ok: false, reason: 'markup' };
  // Todo el tema en un solo sitio: nada de traer más hojas (tampoco con la @ escapada).
  if (/@\s*(import|\\)/i.test(css)) return { ok: false, reason: 'import' };
  // Restos de navegadores antiguos que ejecutaban código desde el CSS.
  if (/javascript\s*:|expression\s*\(|-moz-binding|behavior\s*:/i.test(css)) {
    return { ok: false, reason: 'script' };
  }
  return { ok: true, css };
}

/** El tema guardado en `profiles.settings`, si lo hay y sigue siendo válido. */
export function savedThemeCss(settings: unknown): string | null {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return null;
  const value = (settings as Record<string, unknown>).custom_css;
  if (typeof value !== 'string') return null;
  const checked = checkThemeCss(value);
  return checked.ok && checked.css !== '' ? checked.css : null;
}
