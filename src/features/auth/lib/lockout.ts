// Bloqueo por intentos de acceso (docs/adr/0024-bloqueo-de-acceso-y-registro-de-la-ia.md).
// La cuenta y los tiempos los lleva la base de datos (`login_attempt_begin`); aquí solo está
// cómo se le cuenta la espera a quien intenta entrar. Lógica pura.

export interface LockWait {
  unit: 'minutes' | 'hours';
  n: number;
}

/**
 * Cuánto falta para poder probar otro código, redondeado hacia arriba: en minutos mientras no
 * llegue a dos horas y en horas a partir de ahí. Nunca dice menos de lo que falta.
 */
export function lockWait(seconds: number): LockWait {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes < 120
    ? { unit: 'minutes', n: minutes }
    : { unit: 'hours', n: Math.ceil(minutes / 60) };
}
