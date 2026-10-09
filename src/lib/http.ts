// Utilidades para Route Handlers. Las Server Actions ya comprueban el origen por su cuenta;
// un Route Handler que cambia datos tiene que hacerlo a mano.

/**
 * ¿Viene la petición de la propia app? Un navegador moderno lo dice en `Sec-Fetch-Site`; si
 * no, se compara `Origin` con el host. Una petición sin ninguna de las dos se rechaza.
 */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site');
  if (site !== null) return site === 'same-origin';

  const origin = headers.get('origin');
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (origin === null || host === null || !URL.canParse(origin)) return false;
  return new URL(origin).host === host;
}
