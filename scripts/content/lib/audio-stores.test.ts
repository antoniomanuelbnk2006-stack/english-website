import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_BUCKET_LIMITS, bucketNeedsLimits, supabaseStore } from './audio-stores';

// El bucket de audio de Supabase Storage y sus límites. La API de Storage se simula: ninguna
// petición sale de esta máquina.

const ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://proyecto.supabase.co/',
  SUPABASE_SECRET_KEY: 'clave-de-prueba',
};
const API = 'https://proyecto.supabase.co/storage/v1';

interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** Un Storage de mentira: responde según la ruta y apunta lo que se le pide. */
function fakeStorage(reply: (call: Call) => { status: number; json: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: Call = {
        method: init.method ?? 'GET',
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
      };
      calls.push(call);
      const { status, json } = reply(call);
      return new Response(JSON.stringify(json), { status });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bucketNeedsLimits', () => {
  it('un bucket sin límites, o con otros, los necesita', () => {
    expect(bucketNeedsLimits({ public: true, file_size_limit: null, allowed_mime_types: null })).toBe(
      true,
    );
    expect(bucketNeedsLimits({ ...AUDIO_BUCKET_LIMITS, file_size_limit: 50_000_000 })).toBe(true);
    expect(
      bucketNeedsLimits({ ...AUDIO_BUCKET_LIMITS, allowed_mime_types: ['audio/mp4', 'text/html'] }),
    ).toBe(true);
    expect(bucketNeedsLimits(null)).toBe(true);
  });

  it('con los límites puestos no hay nada que hacer', () => {
    expect(bucketNeedsLimits({ public: true, ...AUDIO_BUCKET_LIMITS })).toBe(false);
  });

  it('solo admite audio y con un tope razonable', () => {
    expect(AUDIO_BUCKET_LIMITS.allowed_mime_types).toEqual(['audio/mp4']);
    expect(AUDIO_BUCKET_LIMITS.file_size_limit).toBeGreaterThan(2 * 1024 * 1024);
    expect(AUDIO_BUCKET_LIMITS.file_size_limit).toBeLessThanOrEqual(50 * 1024 * 1024);
  });
});

describe('supabaseStore', () => {
  it('a un bucket que ya existía sin límites se los pone', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const calls = fakeStorage((call) =>
      call.method === 'GET'
        ? { status: 200, json: { id: 'senal-audio', public: true, file_size_limit: null } }
        : { status: 200, json: { message: 'Successfully updated' } },
    );
    await supabaseStore(ENV);
    expect(calls).toEqual([
      { method: 'GET', url: `${API}/bucket/senal-audio`, body: null },
      {
        method: 'PUT',
        url: `${API}/bucket/senal-audio`,
        body: { public: true, ...AUDIO_BUCKET_LIMITS },
      },
    ]);
  });

  it('si ya los tiene, no toca nada', async () => {
    const calls = fakeStorage(() => ({
      status: 200,
      json: { id: 'senal-audio', public: true, ...AUDIO_BUCKET_LIMITS },
    }));
    await supabaseStore(ENV);
    expect(calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('un bucket nuevo nace con los límites', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const calls = fakeStorage((call) =>
      call.method === 'GET'
        ? { status: 400, json: { statusCode: '404', error: 'Bucket not found' } }
        : { status: 200, json: { name: 'senal-audio' } },
    );
    await supabaseStore(ENV);
    expect(calls[1]).toEqual({
      method: 'POST',
      url: `${API}/bucket`,
      body: { id: 'senal-audio', name: 'senal-audio', public: true, ...AUDIO_BUCKET_LIMITS },
    });
  });

  it('se niega a usar un bucket privado y avisa si no puede poner los límites', async () => {
    fakeStorage(() => ({ status: 200, json: { id: 'senal-audio', public: false } }));
    await expect(supabaseStore(ENV)).rejects.toThrow(/no es público/);

    fakeStorage((call) =>
      call.method === 'GET'
        ? { status: 200, json: { id: 'senal-audio', public: true } }
        : { status: 403, json: { error: 'Unauthorized' } },
    );
    await expect(supabaseStore(ENV)).rejects.toThrow(/límites del bucket \(HTTP 403\)/);
  });

  it('sube el audio como audio/mp4, que es lo único que el bucket admite', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, headers: init.headers as Record<string, string> });
        return new Response(
          JSON.stringify({ id: 'senal-audio', public: true, ...AUDIO_BUCKET_LIMITS }),
          { status: 200 },
        );
      }),
    );
    const store = await supabaseStore(ENV);
    await store.put('audio/b1/b1-lis-001/v1.m4a', Buffer.from('audio'));
    expect(calls[1]?.url).toBe(`${API}/object/senal-audio/audio/b1/b1-lis-001/v1.m4a`);
    expect(calls[1]?.headers['Content-Type']).toBe(AUDIO_BUCKET_LIMITS.allowed_mime_types[0]);
    expect(calls[1]?.headers['x-upsert']).toBe('false');
  });
});
