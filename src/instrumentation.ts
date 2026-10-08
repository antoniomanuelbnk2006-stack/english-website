/** Valida las variables de entorno al arrancar el servidor: si falta alguna, falla aquí y no a mitad de una petición. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env');
  }
}
