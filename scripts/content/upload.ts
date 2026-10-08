// pnpm content:upload --ids b1-lis-001[,…] [--local]
// Sube el audio final a Cloudflare R2 con caché inmutable (ADR-0004).
// Con --local lo copia a public/dev-audio/ para probar sin R2 (NEXT_PUBLIC_AUDIO_BASE_URL=/dev-audio).
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { listLessonFiles, readJson, splitIds } from './lib/io';
import { CACHE_DIR } from './lib/synthesize';

function r2Client(): { client: S3Client; bucket: string } {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      'Faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY o R2_BUCKET en .env.pipeline ' +
        '(docs/06-desarrollo/04-entornos-y-despliegue.md §4). Para probar sin R2: --local.',
    );
  }
  return {
    bucket: R2_BUCKET,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
  };
}

/** Tamaño del objeto en R2, o `null` si no existe. */
async function remoteSize(client: S3Client, bucket: string, key: string): Promise<number | null> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? 0;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { ids: { type: 'string', multiple: true }, local: { type: 'boolean', default: false } },
  });
  const ids = new Set(splitIds(values.ids));
  if (ids.size === 0) {
    console.error('Uso: pnpm content:upload --ids <id>[,<id>…] [--local]');
    return 2;
  }
  const files = listLessonFiles().filter((file) => ids.has(file.id));
  const r2 = values.local ? null : r2Client();
  let problems = 0;

  for (const { file, id } of files) {
    const src = (readJson(file) as { audio?: { src?: string } }).audio?.src;
    if (!src) {
      console.error(`${id}: sin audio. Ejecuta antes: pnpm content:audio --ids ${id}`);
      problems++;
      continue;
    }
    const localFile = path.join(CACHE_DIR, 'out', src);
    if (!existsSync(localFile)) {
      console.error(`${id}: no existe ${path.relative(process.cwd(), localFile)}. Ejecuta content:audio.`);
      problems++;
      continue;
    }

    if (!r2) {
      const target = path.join(process.cwd(), 'public', 'dev-audio', src);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(localFile, target);
      console.log(`${id} → public/dev-audio/${src}`);
      continue;
    }

    const size = statSync(localFile).size;
    const existing = await remoteSize(r2.client, r2.bucket, src);
    if (existing === size) {
      console.log(`${id}: ${src} ya está subido.`);
      continue;
    }
    if (existing !== null) {
      // Las URLs son inmutables: un audio distinto necesita otra versión, nunca sobrescribir.
      console.error(`${id}: ${src} ya existe en R2 con otro contenido. Sube «version» en la lección.`);
      problems++;
      continue;
    }
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: src,
        Body: readFileSync(localFile),
        ContentType: 'audio/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`${id} → r2://${r2.bucket}/${src} (${(size / 1024).toFixed(0)} KB)`);
  }
  return problems > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
