import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// La lección de escucha de estos tests sale de .e2e/content: es b1-lis-001 pasada por el
// pipeline real con un TTS de prueba (tonos en vez de voz, pero con tiempos por palabra).

const LESSON = 'b1-lis-001';
const TITLE = 'Watching the Orionids';
/** Frases del guion que no deben llegar al navegador antes de la fase 3. */
const SCRIPT = ['have you got a minute', "I'll pick you up at half eleven", 'tiny bits of dust'];

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

/** El aviso tras comprobar una respuesta (el marcador de velocidad también es un «status»). */
function feedback(page: Page) {
  return page.locator('[role="status"]');
}

async function answer(page: Page, option: string | RegExp, next: string) {
  await page.getByRole('radio', { name: option }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(feedback(page)).toBeVisible();
  await page.getByRole('button', { name: next, exact: true }).click();
}

/**
 * Todo lo que el servidor envía al navegador como documento o por fetch (HTML, datos de React
 * y respuestas de acciones). Se intercepta en la red porque `response.text()` no siempre puede
 * leer el cuerpo de una acción del servidor.
 */
async function recordResponses(page: Page): Promise<string[]> {
  const bodies: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['document', 'fetch', 'xhr'].includes(request.resourceType())) {
      await route.continue();
      return;
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      bodies.push(await response.text());
      await route.fulfill({ response });
    } catch {
      // La página se cerró con la petición en vuelo (fin del test).
    }
  });
  return bodies;
}

test('la biblioteca de escucha muestra duración, velocidad y acentos', async ({ page }) => {
  await signIn(page);
  await page.goto('/escuchar');
  await expect(page.getByRole('heading', { name: 'Cielo nocturno' })).toBeVisible();
  const card = page.getByRole('link', { name: new RegExp(TITLE) });
  await expect(card).toContainText('Nueva');
  await expect(card).toContainText('en-GB');
  await expect(card).toContainText('en-US');
  await expect(card).toContainText(/\d:\d\d/);
  await expect(card).toContainText(/1[34]\d ppm/);
  await expectAccessible(page);
});

test('ciclo de escucha completo: el guion no llega antes de la fase 3, dictado, karaoke y resultado', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  const responses = await recordResponses(page);
  const scriptSeen = () => SCRIPT.filter((line) => responses.some((body) => body.includes(line)));

  await signIn(page);
  await page.goto(`/escuchar/${LESSON}`);

  // Fase 0 · Preparar
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText('Maya · en-GB')).toBeVisible();
  await expect(page.getByText('too much artificial light at night')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Empezar a escuchar' }).click();

  // Fase 1 · Escucha global: el audio suena de verdad y el tiempo avanza.
  const playerRegion = page.getByRole('region', { name: 'Reproductor' });
  await playerRegion.getByRole('button', { name: 'Reproducir' }).click();
  await expect(playerRegion.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await expect(playerRegion.getByText(/^0:0[1-9]$/)).toBeVisible({ timeout: 10_000 });
  await playerRegion.getByRole('button', { name: 'Pausa' }).click();
  await expectAccessible(page);

  await answer(page, /To suggest a night out/, 'Siguiente');
  await answer(page, /He agrees and offers to make a drink/, 'Continuar');
  // En las dos primeras fases no se muestra la explicación (cita el guion).
  await expect(page.getByText('¿Cuánto has entendido en esta primera escucha?')).toBeVisible();
  await page.getByLabel('¿Cuánto has entendido en esta primera escucha?').fill('40');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Fase 2 · Detalle: nueve preguntas (una fallada a propósito: forty no es fourteen).
  await expect(page.getByText('Pregunta 1 de 9')).toBeVisible();
  await page.getByRole('radio', { name: '14 minutes' }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(feedback(page)).toContainText('No es correcto');
  await expect(feedback(page)).not.toContainText('FOR-ty');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await answer(page, 'Around two or three a.m.', 'Siguiente');
  await answer(page, 'False', 'Siguiente');
  await answer(page, 'Fifteen to twenty an hour', 'Siguiente');
  await answer(page, /So his eyes can adapt/, 'Siguiente');
  await answer(page, '11:30', 'Siguiente');
  await answer(page, 'False', 'Siguiente');
  await answer(page, 'Not given', 'Siguiente');
  await page.getByLabel('Hueco 1').fill('dust');
  await page.getByLabel('Hueco 2').fill('Comet');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(feedback(page)).toContainText('Correcto');

  // Hasta aquí, ni una frase del guion ha salido del servidor ni está en la página.
  expect(scriptSeen(), 'frases del guion enviadas antes de la fase 3').toEqual([]);
  for (const line of SCRIPT) await expect(page.getByText(line)).toHaveCount(0);

  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Fase 3 · Diagnóstico: tres frases dictadas.
  await expect(page.getByText('Frase 1 de 3')).toBeVisible();
  // …y ahora sí llega (lo que además prueba que el registro de respuestas ve las acciones).
  await expect
    .poll(() => scriptSeen().length, { message: 'la transcripción debe llegar ahora' })
    .toBe(SCRIPT.length);
  await page.getByRole('button', { name: 'Escuchar la frase' }).click();
  const input = page.getByLabel('Lo que oyes');

  // 1) Faltan «are» y la mitad de «gonna»: palabras conocidas no reconocidas.
  await input.fill('hmm ok thats not so bad how many meteors we going see like hundreds');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(feedback(page)).toContainText(/Precisión: \d+ %/);
  const firstCause = page.getByLabel('Por qué se te escapó «are»');
  await expect(firstCause).toHaveValue('not_recognized');
  await expect(page.getByLabel('Por qué se te escapó «gonna»')).toHaveValue('not_recognized');
  // El usuario corrige una de las causas propuestas.
  await firstCause.selectOption('speed');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

  // 2) Perfecta, con equivalencias (20 = twenty).
  await expect(page.getByText('Frase 2 de 3')).toBeVisible();
  await input.fill('It takes about 20 minutes for your eyes to get used to the dark');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(feedback(page)).toContainText('Señal limpia');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

  // 3) El error típico: half eleven no es 10:30.
  await input.fill("perfect I'll pick you up at 10:30");
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByLabel(/Por qué se te escapó/)).toHaveCount(1);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Fase 4 · Texto a la vista, con karaoke y rasgos de habla conectada.
  await expect(page.getByText('Hey Leo, have you got a minute?')).toBeVisible();
  await expect(page.locator('[data-feature]').first()).toBeVisible();
  await expect(page.getByText('/həvjə ˈɡɒtə ˈmɪnɪt/')).toBeVisible();
  // Ahora sí se ve la explicación de las preguntas.
  await expect(page.getByText(/lleva el acento en la primera sílaba/)).toBeVisible();
  await expectAccessible(page);

  // Karaoke: al sonar una frase, la palabra activa se marca en el DOM.
  await page.getByRole('button', { name: 'Escuchar esta frase (1)' }).click();
  await expect(page.locator('[data-w][data-active]')).toHaveCount(1, { timeout: 10_000 });
  // La frase se detiene sola al acabar.
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Fase 5 · Entrenamiento: las dos frases falladas, despacio y a velocidad normal.
  await expect(page.getByRole('button', { name: 'Despacio (0,75×)' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Despacio (0,75×)' }).first().click();
  await expect(playerRegion.getByText('0.75×')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Fase 6 · Escucha final y autoevaluación.
  await expect(playerRegion.getByText('1.00×')).toBeVisible();
  await page.getByLabel('¿Cuánto entiendes ahora?').fill('80');
  await page.getByRole('button', { name: 'Ver el resultado' }).click();

  // Resultado.
  await expect(page.getByText('Antes: 40 % · Ahora: 80 %')).toBeVisible();
  await expect(page.getByText('En la primera escucha')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu oído en esta lección' })).toBeVisible();
  await expect(page.getByText('La conozco, pero no la reconocí')).toBeVisible();
  await expect(page.getByText('Iba demasiado rápido')).toBeVisible();
  await expectAccessible(page);

  // Lo guardado.
  const attempts = await queryDatabase<{
    item_id: string;
    task_type: string;
    score: number;
    phase: string;
  }>(
    request,
    `select item_id, task_type, round(score::numeric, 2)::float as score, phase
     from public.item_attempts order by created_at, id`,
  );
  expect(attempts).toHaveLength(14);
  expect(attempts.filter((a) => a.task_type === 'dictation').map((a) => a.score)).toEqual([
    // La nota del dictado la calcula el servidor a partir de lo escrito.
    // «are» y el «to» de «gonna» de 17 palabras; «thats» sin apóstrofo no es un fallo.
    expect.closeTo(15 / 17, 2),
    1,
    // «10» por «eleven» (el «:30» sí vale por «half»).
    expect.closeTo(8 / 9, 2),
  ]);
  expect(attempts.find((a) => a.item_id === `${LESSON}:q3`)).toMatchObject({
    score: 0,
    phase: 'listen_2',
  });

  const diagnostics = await queryDatabase<Record<string, unknown>>(
    request,
    `select segment_id, cause, cause_source, expected, features from public.listening_diagnostics
     order by id`,
  );
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics[0]).toMatchObject({
    segment_id: 's16',
    cause: 'speed',
    cause_source: 'user',
    expected: 'are',
    features: ['reduction'],
  });
  expect(diagnostics[1]).toMatchObject({
    segment_id: 's16',
    cause: 'not_recognized',
    cause_source: 'auto',
    expected: 'gonna',
  });
  expect(diagnostics[2]).toMatchObject({ segment_id: 's28', features: ['linking'] });

  const [progress] = await queryDatabase<Record<string, unknown>>(
    request,
    `select status, phase, self_rating_initial, self_rating_final, score is not null as scored
     from public.lesson_progress where lesson_id = $1`,
    [LESSON],
  );
  expect(progress).toEqual({
    status: 'completed',
    phase: 7,
    self_rating_initial: 40,
    self_rating_final: 80,
    scored: true,
  });

  const journal = await queryDatabase(
    request,
    'select kind, source, lesson_id from public.input_log',
  );
  expect(journal).toEqual([{ kind: 'intensive_listening', source: 'app', lesson_id: LESSON }]);

  expect(errors).toEqual([]);
});

test('la transcripción no se puede pedir antes de completar las dos escuchas', async ({ page }) => {
  const responses = await recordResponses(page);
  await signIn(page);
  await page.goto(`/escuchar/${LESSON}`);
  await page.getByRole('button', { name: 'Empezar a escuchar' }).click();
  await expect(page.getByText('Pregunta 1 de 2')).toBeVisible();
  // Con el progreso en la fase 1, volver a entrar retoma ahí y sigue sin haber guion.
  await page.reload();
  await expect(page.getByText('Pregunta 1 de 2')).toBeVisible();
  expect(SCRIPT.filter((line) => responses.some((body) => body.includes(line)))).toEqual([]);
});

test('atajos de teclado del reproductor', async ({ page, isMobile }) => {
  test.skip(isMobile, 'los atajos son de escritorio');
  await signIn(page);
  await page.goto(`/escuchar/${LESSON}`);
  await page.getByRole('button', { name: 'Empezar a escuchar' }).click();
  const playerRegion = page.getByRole('region', { name: 'Reproductor' });
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });

  await page.keyboard.press('Space');
  await expect(playerRegion.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible();

  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await expect(playerRegion.getByText('1.10×')).toBeVisible();
  await page.keyboard.press('[');
  await expect(playerRegion.getByText('1.05×')).toBeVisible();

  // → salta a la frase siguiente y sigue sonando.
  await page.keyboard.press('ArrowRight');
  await expect(playerRegion.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await expect(playerRegion.getByRole('slider')).not.toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('Space');

  // Escribir en un campo no dispara atajos: las flechas de un grupo de opciones tampoco.
  await page.getByRole('radio', { name: /To suggest a night out/ }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible();
});
