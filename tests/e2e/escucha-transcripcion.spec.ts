import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Modo «con transcripción» de una lección de escucha (ADR-0013): el usuario elige ver el
// texto desde el principio. Solo entonces sale del servidor, y queda anotado.

const LESSON = 'b1-lis-001';
const SCRIPT = ['have you got a minute', "I'll pick you up at half eleven", 'tiny bits of dust'];

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function recordResponses(page: Page): Promise<string[]> {
  const bodies: string[] = [];
  await page.route('**/*', async (route) => {
    if (!['document', 'fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      bodies.push(await response.text());
      await route.fulfill({ response });
    } catch {
      // La página se cerró con la petición en vuelo.
    }
  });
  return bodies;
}

const progress = (request: Parameters<typeof queryDatabase>[0]) =>
  queryDatabase<{ status: string; phase: number; transcript_first: boolean }>(
    request,
    'select status, phase, transcript_first from public.lesson_progress where lesson_id = $1',
    [LESSON],
  );

test('al empezar se elige entre escuchar a ciegas o con transcripción', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const errors = trackErrors(page);
  const responses = await recordResponses(page);
  const scriptSent = () => SCRIPT.filter((line) => responses.some((body) => body.includes(line)));

  await signIn(page);
  await page.goto(`/escuchar/${LESSON}`);

  // Las dos formas de hacer la lección, explicadas.
  await expect(page.getByRole('heading', { name: 'A ciegas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Con transcripción' })).toBeVisible();
  await expect(page.getByText(/No mide tu oído/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar a escuchar' })).toBeVisible();
  await expectAccessible(page);

  // Mientras no se elija, el guion sigue en el servidor.
  expect(scriptSent()).toEqual([]);
  expect(await progress(request)).toEqual([]);

  await page.getByRole('button', { name: 'Escuchar con transcripción' }).click();

  // El texto se ve desde el principio, sin fases ni preguntas.
  await expect(page.getByText('Hey Leo, have you got a minute?')).toBeVisible();
  await expect.poll(() => scriptSent().length).toBe(SCRIPT.length);
  await expect(page.getByText(/Fase \d de 8/)).toHaveCount(0);
  await expect(page.getByText(/Pregunta \d+ de/)).toHaveCount(0);
  await expect(page.getByLabel('Lo que oyes')).toHaveCount(0);
  await expectAccessible(page);

  // Queda anotado que se vio antes de las escuchas a ciegas, sin avanzar el ciclo.
  expect(await progress(request)).toEqual([
    { status: 'started', phase: 0, transcript_first: true },
  ]);

  // El reproductor y el karaoke funcionan igual que en el ciclo.
  const playerRegion = page.getByRole('region', { name: 'Reproductor' });
  await page.getByRole('button', { name: 'Escuchar esta frase (1)' }).click();
  await expect(page.locator('[data-w][data-active]')).toHaveCount(1, { timeout: 10_000 });
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible({
    timeout: 15_000,
  });

  // Y el glosario, con «Añadir al repaso» (que ya no depende de la fase del ciclo).
  await page
    .locator('[data-word]')
    .filter({ hasText: /^forecast$/ })
    .first()
    .click();
  const popover = page.getByRole('dialog', { name: 'Glosario: forecast' });
  await expect(popover).toContainText('previsión (del tiempo)');
  await popover.getByRole('button', { name: 'Añadir al repaso' }).click();
  await expect(popover.getByRole('button', { name: 'Ya está en el repaso' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // Terminar: el tiempo va al diario; no hay nota ni intentos.
  await page.getByRole('button', { name: 'He terminado' }).click();
  await expect(page.getByRole('heading', { name: 'Escucha con transcripción' })).toBeVisible();
  await expect(page.getByText('Tiempo activo')).toBeVisible();
  await expectAccessible(page);

  await expect
    .poll(() => queryDatabase(request, 'select kind, source, lesson_id from public.input_log'))
    .toEqual([{ kind: 'intensive_listening', source: 'app', lesson_id: LESSON }]);
  const [attempts] = await queryDatabase<{ n: number }>(
    request,
    'select count(*)::int as n from public.item_attempts',
  );
  expect(attempts?.n).toBe(0);
  expect(await progress(request)).toEqual([
    { status: 'started', phase: 0, transcript_first: true },
  ]);
  const cards = await queryDatabase(request, 'select kind, lemma from public.srs_cards');
  expect(cards).toEqual([{ kind: 'word', lemma: 'forecast' }]);

  // Desde el resultado se puede pasar al ciclo a ciegas, con el aviso de que ya se leyó.
  await page.getByRole('button', { name: 'Hacer el ciclo a ciegas' }).click();
  await expect(page.getByText(/Ya abriste esta lección con transcripción/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar a escuchar' })).toBeVisible();

  // Y al volver otro día, el aviso sigue ahí.
  await page.reload();
  await expect(page.getByText(/Ya abriste esta lección con transcripción/)).toBeVisible();

  expect(errors).toEqual([]);
});

test('tras completar el ciclo a ciegas, releer con texto no invalida el diagnóstico', async ({
  page,
  request,
}) => {
  await signIn(page);
  // La lección, ya hecha a ciegas hasta el final.
  await queryDatabase(
    request,
    `insert into public.lesson_progress (user_id, lesson_id, status, phase, score, completed_at)
     select id, $1, 'completed', 7, 0.8, now() from auth.users`,
    [LESSON],
  );
  await page.goto(`/escuchar/${LESSON}`);
  await expect(page.getByText(/Ya abriste esta lección con transcripción/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Escuchar con transcripción' }).click();
  await expect(page.getByText('Hey Leo, have you got a minute?')).toBeVisible();

  // Ya había superado las dos escuchas: la marca no se pone.
  expect(await progress(request)).toEqual([
    { status: 'completed', phase: 7, transcript_first: false },
  ]);
});

test('en el ciclo a ciegas nada cambia: el guion no llega sin elegirlo', async ({ page }) => {
  const responses = await recordResponses(page);
  await signIn(page);
  await page.goto(`/escuchar/${LESSON}`);
  await page.getByRole('button', { name: 'Empezar a escuchar' }).click();
  await expect(page.getByText('Pregunta 1 de 2')).toBeVisible();
  // Dentro del ciclo ya no se ofrece el modo con transcripción.
  await expect(page.getByRole('button', { name: 'Escuchar con transcripción' })).toHaveCount(0);
  expect(SCRIPT.filter((line) => responses.some((body) => body.includes(line)))).toEqual([]);
});
