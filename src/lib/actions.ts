// Forma estándar de las Server Actions (docs/06-desarrollo/02-convenciones.md §4).
export type ActionError =
  'unauthorized' | 'invalid_input' | 'not_found' | 'conflict' | 'rate_limited' | 'internal';

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError; message?: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (error: ActionError, message?: string): ActionResult<never> => ({
  ok: false,
  error,
  ...(message ? { message } : {}),
});
