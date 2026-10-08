import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

const LESSON = 'b1-rea-001';
const TITLE = 'The Second Life of Old Games';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

/** En pantallas estrechas el texto y las preguntas se ven de uno en uno. */
async function showQuestions(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Preguntas', exact: true }).click();
}

async function answerChoice(page: Page, option: string | RegExp, next: string) {
  await page.getByRole('radio', { name: option }).check();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button', { name: next }).click();
}

test('la biblioteca muestra la lección publicada, agrupada por unidad', async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/leer');

  await expect(page.getByRole('heading', { name: 'Videojuegos y comunidades' })).toBeVisible();
  const card = page.getByRole('link', { name: new RegExp(TITLE) });
  await expect(card).toContainText('Nueva');
  await expect(card).toContainText('386 pal.');
  await expect(page.getByText('0 de 1 hechas')).toBeVisible();

  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('los filtros de la biblioteca van en la URL', async ({ page }) => {
  await signIn(page);
  await page.goto('/leer');
  const filters = page.getByRole('navigation', { name: 'Filtros' });

  await filters.getByRole('link', { name: 'Hecha' }).click();
  await expect(page).toHaveURL(/estado=done/);
  await expect(page.getByRole('heading', { name: 'Nada con esos filtros' })).toBeVisible();

  await page.getByRole('link', { name: 'Quitar filtros' }).click();
  await expect(page).toHaveURL(/\/leer$/);
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible();

  await page.goto('/leer?nivel=Z9&estado=borrada');
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible();
});

test('una lección que no existe muestra «no encontrada»', async ({ page }) => {
  await signIn(page);
  // (El código HTTP es 200 porque la página ya ha empezado a enviarse cuando se sabe que no existe.)
  for (const path of ['/leer/b1-rea-999', '/leer/b1-lis-001', '/leer/..%2F..%2Fpackage']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Aquí no hay nada' })).toBeVisible();
  }
});

test('se hace la lectura de principio a fin y se guardan intentos, nota y velocidad', async ({
  page,
  request,
  isMobile,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  // Reloj controlado: permite «leer» casi tres minutos en un instante.
  await page.clock.install();
  await page.goto(`/leer/${LESSON}`);

  // Fase 0 · Preparar
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText('Why do you think some people still play games')).toBeVisible();
  await expect(page.getByText('a change that a player makes to a video game')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Empezar el vistazo' }).click();

  // Fase 1 · Vistazo: el texto se ve primero; las preguntas, a un toque.
  await expect(page.getByText('When a video game company stops updating a game')).toBeVisible();
  await expect(page.getByText(/Quedan \d+ s/)).toBeVisible();
  await showQuestions(page, isMobile);
  await expect(page.getByText('Pregunta 1 de 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comprobar' })).toBeDisabled();
  await answerChoice(page, /How players keep old games alive/, 'Siguiente');

  await page.getByLabel('Párrafo 3').selectOption({ label: 'Reasons for doing unpaid work' });
  await page.getByLabel('Párrafo 4').selectOption({ label: 'A path to a job' });
  await page.getByLabel('Párrafo 5').selectOption({ label: 'Risks and rules' });
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status')).toContainText('Correcto');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Fase 2 · Lectura en inmersión: 170 s activos (una tecla cada 34 s).
  await expect(page.getByRole('button', { name: 'He terminado de leer' })).toBeVisible();
  await expect(page.getByText('Pregunta 1 de')).toHaveCount(0);
  for (let i = 0; i < 5; i++) {
    await page.clock.fastForward(34_000);
    await page.keyboard.press('Shift');
  }
  await expect(page.getByText('2:50')).toBeVisible();
  await page.getByRole('button', { name: 'He terminado de leer' }).click();

  // Fase 3 · Preguntas: una fallada a propósito.
  await expect(page.getByText('Pregunta 1 de 8')).toBeVisible();
  await answerChoice(page, 'Correct a problem in the game', 'Siguiente');

  await page.getByRole('radio', { name: 'researchers' }).check();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status')).toContainText('No es correcto');
  await expect(page.getByRole('status')).toContainText('them se refiere a los modders');
  await page.getByRole('button', { name: 'Ver dónde lo dice' }).click();
  await expect(page.locator('[data-ref="p3s2"]')).toBeInViewport();
  await showQuestions(page, isMobile);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await answerChoice(page, 'Earning money', 'Siguiente');
  await answerChoice(page, /stay informed about the changes/, 'Siguiente');
  await answerChoice(page, 'False', 'Siguiente');
  await answerChoice(page, 'Not given', 'Siguiente');
  await answerChoice(page, /Generally positive/, 'Siguiente');
  await answerChoice(page, /To sum up the main idea/, 'Continuar');

  // Fase 4 · Foco lingüístico: huecos con mayúsculas y una variante aceptada.
  await expect(
    page.getByRole('heading', { name: 'Conectores que cambian de dirección' }),
  ).toBeVisible();
  await page.getByLabel('Hueco 1').fill('  OF course ');
  await page.getByLabel('Hueco 2').fill('However');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status')).toContainText('Correcto');
  await page.getByRole('button', { name: 'Ver el resultado' }).click();

  // Resultado: 10 de 11 → 91 %; 386 palabras en 170 s → 136 ppm.
  const result = page.getByRole('complementary');
  await expect(result.getByText('91 %')).toBeVisible();
  await expect(result.getByText('136 ppm')).toBeVisible();
  await expect(result.getByText('Objetivo B1: 100–150 ppm')).toBeVisible();
  await expect(result.getByRole('heading', { name: 'Para repasar' })).toBeVisible();
  await expect(result.getByText('who does "them" refer to')).toBeVisible();
  await expectAccessible(page);

  // Lo guardado en la base de datos.
  const attempts = await queryDatabase<{ item_id: string; score: number; phase: string }>(
    request,
    'select item_id, score, phase from public.item_attempts order by created_at, id',
  );
  expect(attempts).toHaveLength(11);
  expect(attempts.filter((a) => a.score < 1)).toEqual([
    { item_id: `${LESSON}:q4`, score: 0, phase: 'read' },
  ]);

  const [progress] = await queryDatabase<Record<string, unknown>>(
    request,
    `select status, phase, round(score::numeric, 4)::float as score, reading_wpm, lesson_version,
            completed_at is not null as done, time_spent_s
     from public.lesson_progress where lesson_id = $1`,
    [LESSON],
  );
  expect(progress).toMatchObject({
    status: 'completed',
    phase: 5,
    score: 0.9091,
    reading_wpm: 136,
    lesson_version: 1,
    done: true,
  });
  expect(Number(progress?.time_spent_s)).toBeGreaterThanOrEqual(170);

  const journal = await queryDatabase<Record<string, unknown>>(
    request,
    'select kind, source, words, lesson_id, perceived_level, minutes from public.input_log',
  );
  expect(journal).toHaveLength(1);
  expect(journal[0]).toMatchObject({
    kind: 'intensive_reading',
    source: 'app',
    words: 386,
    lesson_id: LESSON,
    perceived_level: 'B1',
  });
  expect(Number(journal[0]?.minutes)).toBeGreaterThanOrEqual(170 / 60);

  // La biblioteca y Hoy reflejan lo hecho.
  await page.getByRole('link', { name: 'Volver a la biblioteca' }).last().click();
  const card = page.getByRole('link', { name: new RegExp(TITLE) });
  await expect(card).toContainText('Hecha');
  await expect(card).toContainText('Mejor nota: 91 %');
  await expect(page.getByText('1 de 1 hechas')).toBeVisible();

  await page.goto('/hoy');
  await expect(page.getByRole('img', { name: /Minutos de hoy: [3-9] de 45/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('una lección a medias se retoma en la fase donde se dejó', async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto(`/leer/${LESSON}`);
  await page.getByRole('button', { name: 'Empezar el vistazo' }).click();
  await showQuestions(page, isMobile);
  await answerChoice(page, /How players keep old games alive/, 'Siguiente');
  await page.getByLabel('Párrafo 3').selectOption({ label: 'A path to a job' });
  await page.getByLabel('Párrafo 4').selectOption({ label: 'A path to a job' });
  await page.getByLabel('Párrafo 5').selectOption({ label: 'Risks and rules' });
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status')).toContainText('Casi: 2 de 3');
  await expect(page.getByText('Respuesta correcta: Reasons for doing unpaid work')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('button', { name: 'He terminado de leer' })).toBeVisible();

  await page.goto('/leer');
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toContainText('Empezada');

  await page.goto(`/leer/${LESSON}`);
  await expect(page.getByRole('button', { name: 'He terminado de leer' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lectura' })).toHaveAttribute(
    'aria-current',
    'step',
  );
});

test('la lección entera se puede hacer solo con el teclado', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el recorrido con teclado se prueba en escritorio');
  await signIn(page);
  await page.goto(`/leer/${LESSON}`);

  await page.getByRole('button', { name: 'Empezar el vistazo' }).focus();
  await page.keyboard.press('Enter');

  // Radios: se llega con Tab, se elige con las flechas y Enter comprueba.
  const first = page.getByRole('radio', { name: /Why companies stop updating/ });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /How players keep old games alive/ })).toBeChecked();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Correcto');
  // Tras comprobar, el foco está en la corrección; Tab lleva a «Siguiente».
  await expect(page.getByRole('status')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Pregunta 2 de 2')).toBeVisible();
});
