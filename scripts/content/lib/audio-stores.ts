import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Dónde se sube el audio final: Cloudflare R2 (ADR-0004) o el Storage del proyecto de Supabase
// (ADR-0019). En los dos casos las URL son inmutables: un audio distinto necesita otra versión.

/** Un año: el audio de una versión no cambia nunca. */
const MAX_AGE_S = 31_536_000;

export interface AudioStore {
  /** Nombre para los mensajes: «r2://senal-audio». */
  label: string;
  /** Tamaño en bytes del objeto, o `null` si no existe. */
  size(key: string): Promise<number | null>;
  put(key: string, body: Buffer): Promise<void>;
}

export function r2Store(env: NodeJS.ProcessEnv = process.env): AudioStore {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      'Faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY o R2_BUCKET en .env.pipeline ' +
        '(docs/06-desarrollo/04-entornos-y-despliegue.md §4). Para probar sin R2: --local; ' +
        'para subir al Storage de Supabase: --supabase.',
    );
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return {
    label: `r2://${R2_BUCKET}`,
    async size(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        return head.ContentLength ?? 0;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: 'audio/mp4',
          CacheControl: `public, max-age=${MAX_AGE_S}, immutable`,
        }),
      );
    },
  };
}

/** URL pública de un bucket de Supabase Storage: lo que va en NEXT_PUBLIC_AUDIO_BASE_URL. */
export function supabasePublicBase(projectUrl: string, bucket: string): string {
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}`;
}

/**
 * Lo que admite el bucket de audio: solo `audio/mp4` (lo que genera el pipeline) y con un tope
 * de tamaño. Storage rechaza cualquier otra cosa antes de guardarla, la suba quien la suba. La
 * grabación más larga ronda los 2 MB; 20 MB dejan margen de sobra.
 */
export const AUDIO_BUCKET_LIMITS = {
  file_size_limit: 20 * 1024 * 1024,
  allowed_mime_types: ['audio/mp4'],
};

/** ¿Le faltan al bucket esos límites (o tiene otros)? */
export function bucketNeedsLimits(bucket: unknown): boolean {
  const { file_size_limit: size, allowed_mime_types: types } = (bucket ?? {}) as {
    file_size_limit?: unknown;
    allowed_mime_types?: unknown;
  };
  return (
    size !== AUDIO_BUCKET_LIMITS.file_size_limit ||
    !Array.isArray(types) ||
    types.length !== AUDIO_BUCKET_LIMITS.allowed_mime_types.length ||
    types.some((type, index) => type !== AUDIO_BUCKET_LIMITS.allowed_mime_types[index])
  );
}

/** Storage responde «no existe» con un 400 o un 404 según la ruta: se mira también el cuerpo. */
function isNotFound(status: number, body: unknown): boolean {
  if (status === 404) return true;
  const code = (body as { statusCode?: unknown; error?: unknown } | null)?.statusCode;
  const error = (body as { error?: unknown } | null)?.error;
  return String(code) === '404' || error === 'not_found' || error === 'Bucket not found';
}

/**
 * El Storage del proyecto de Supabase, con la clave *secret* (solo en este script, nunca en la
 * app). Crea el bucket público si no existe y, exista o no, lo deja con sus límites de tamaño
 * y de tipo de fichero (`AUDIO_BUCKET_LIMITS`).
 */
export async function supabaseStore(env: NodeJS.ProcessEnv = process.env): Promise<AudioStore> {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env;
  const bucket = env.SUPABASE_AUDIO_BUCKET || 'senal-audio';
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.pipeline ' +
        '(docs/06-desarrollo/04-entornos-y-despliegue.md §4).',
    );
  }
  const api = `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1`;
  const auth = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };

  /** Hace la petición y lee la respuesta una sola vez (el cuerpo de un error también importa). */
  const call = async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { ...auth, ...init.headers } });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Una respuesta que no es JSON se trata como texto.
    }
    return { ok: response.ok, status: response.status, body, text };
  };
  const fail = (what: string, result: { status: number; text: string }): never => {
    throw new Error(`Supabase Storage: ${what} (HTTP ${result.status}) ${result.text.slice(0, 300)}`);
  };

  const found = await call(`${api}/bucket/${bucket}`);
  if (found.ok) {
    if ((found.body as { public?: boolean } | null)?.public === false) {
      throw new Error(`El bucket «${bucket}» existe pero no es público: la app no podría leer el audio.`);
    }
    if (bucketNeedsLimits(found.body)) {
      const updated = await call(`${api}/bucket/${bucket}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: true, ...AUDIO_BUCKET_LIMITS }),
      });
      if (!updated.ok) fail('no se pudieron poner los límites del bucket', updated);
      console.log(`Bucket «${bucket}»: límites de tamaño y de tipo de fichero actualizados.`);
    }
  } else if (isNotFound(found.status, found.body)) {
    const created = await call(`${api}/bucket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true, ...AUDIO_BUCKET_LIMITS }),
    });
    if (!created.ok) fail('no se pudo crear el bucket', created);
    console.log(`Bucket público «${bucket}» creado.`);
  } else {
    fail('no se pudo leer el bucket', found);
  }

  return {
    label: `supabase://${bucket}`,
    async size(key) {
      const result = await call(`${api}/object/info/${bucket}/${key}`);
      if (result.ok) {
        const info = result.body as { size?: number; metadata?: { size?: number } } | null;
        return info?.size ?? info?.metadata?.size ?? 0;
      }
      if (isNotFound(result.status, result.body)) return null;
      return fail(`no se pudo comprobar ${key}`, result);
    },
    async put(key, body) {
      const result = await call(`${api}/object/${bucket}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/mp4',
          'cache-control': `max-age=${MAX_AGE_S}`,
          'x-upsert': 'false',
        },
        body: new Uint8Array(body),
      });
      if (!result.ok) fail(`no se pudo subir ${key}`, result);
    },
  };
}
