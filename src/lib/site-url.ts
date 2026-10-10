/** `localhost`, `127.0.0.1` o `[::1]`, con o sin puerto. */
const LOCAL_HOST = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/;

/**
 * La web tiene una sola dirección (ADR-0021). Vercel conserva una dirección propia por cada
 * despliegue, congelada en esa versión, y quien entra por una de ellas ve una web antigua sin
 * saberlo. Si la petición llega por un nombre que no es el de `siteUrl`, devuelve la misma ruta
 * en la dirección buena; si no hay nada que corregir, `null`.
 *
 * Lo que llega por una dirección local nunca se redirige: no es un despliegue antiguo, y así
 * un `SITE_URL` de producción en `.env.local` no saca del ordenador a quien desarrolla.
 */
export function canonicalUrl(
  host: string | null,
  pathAndQuery: string,
  siteUrl: string | undefined,
): string | null {
  if (!siteUrl || !host) return null;
  const requested = host.trim().toLowerCase();
  const site = new URL(siteUrl);
  if (requested === site.host || LOCAL_HOST.test(requested)) return null;
  // Concatenado y no `new URL(ruta, base)`: una ruta como `//otro.sitio` cambiaría el destino.
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${site.origin}${path}`;
}
