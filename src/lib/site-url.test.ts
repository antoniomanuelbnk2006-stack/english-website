import { describe, expect, it } from 'vitest';
import { canonicalUrl } from './site-url';

const SITE = 'https://senal.example.dev';

describe('canonicalUrl', () => {
  it('no hace nada si la petición ya llega por la dirección de la web', () => {
    expect(canonicalUrl('senal.example.dev', '/hoy', SITE)).toBeNull();
    expect(canonicalUrl('SENAL.example.dev', '/login?error=enlace', SITE)).toBeNull();
  });

  it('manda a la dirección de la web lo que llega por otra, con su ruta y su consulta', () => {
    expect(canonicalUrl('senal-abc123-equipo.vercel.app', '/login', SITE)).toBe(
      'https://senal.example.dev/login',
    );
    expect(canonicalUrl('senal-git-main-equipo.vercel.app', '/leer/b2-r-001?fase=2', SITE)).toBe(
      'https://senal.example.dev/leer/b2-r-001?fase=2',
    );
  });

  it('el puerto forma parte de la dirección', () => {
    expect(canonicalUrl('senal.example.dev:8443', '/', `${SITE}:8443`)).toBeNull();
    expect(canonicalUrl('senal.example.dev:8443', '/', SITE)).toBe('https://senal.example.dev/');
  });

  it('lo que llega por una dirección local nunca se redirige', () => {
    for (const local of [
      'localhost',
      'localhost:3000',
      '127.0.0.1:3100',
      '127.1.2.3',
      '[::1]:3000',
    ]) {
      expect(canonicalUrl(local, '/hoy', SITE)).toBeNull();
      expect(canonicalUrl(local, '/hoy', 'http://localhost:3100')).toBeNull();
    }
    // Un nombre que solo se le parece sí es otra dirección.
    expect(canonicalUrl('localhost.example.dev', '/hoy', SITE)).toBe(
      'https://senal.example.dev/hoy',
    );
  });

  it('ignora la ruta que traiga la dirección configurada', () => {
    expect(canonicalUrl('otra.example.dev', '/hoy', `${SITE}/algo/`)).toBe(
      'https://senal.example.dev/hoy',
    );
  });

  it('nunca manda fuera de la web, aunque la ruta parezca otra dirección', () => {
    expect(canonicalUrl('otra.example.dev', '//malo.example.com/x', SITE)).toBe(
      'https://senal.example.dev//malo.example.com/x',
    );
    expect(canonicalUrl('otra.example.dev', 'https://malo.example.com', SITE)).toBe(
      'https://senal.example.dev/https://malo.example.com',
    );
  });

  it('sin dirección configurada, o sin saber por cuál llega la petición, no redirige', () => {
    expect(canonicalUrl('lo-que-sea.vercel.app', '/hoy', undefined)).toBeNull();
    expect(canonicalUrl(null, '/hoy', SITE)).toBeNull();
  });
});
