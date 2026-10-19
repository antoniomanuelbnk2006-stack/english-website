/**
 * Dónde pide la portada (public/landing/app.js) la copia de «Hoy» que enseña dentro del portátil
 * a quien tiene la sesión abierta (preview.ts). Sin sesión responde 204, sin nada: lo resuelve el
 * proxy (src/lib/supabase/proxy.ts), que por eso importa este módulo y no el de la copia.
 */
export const TODAY_PREVIEW_PATH = '/api/portada/hoy';
