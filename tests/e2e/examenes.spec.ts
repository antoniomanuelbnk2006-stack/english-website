import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Simulacros de examen de Cambridge (ADR-0017). El contenido de prueba solo tiene el B2 First;
// el usuario de prueba es de nivel B1, así que también se ve un nivel sin simulacro.

const READING = 'b2-exam-01-reading';
const LISTENING = 'b2-exam-01-listening';
const SPEAKING = 'b2-exam-01-speaking';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

const partTab = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Parte ${n}\\b`) });

test('el índice enseña el examen de cada nivel con su formato y su tiempo oficial', async ({
  page,
  isMobile,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/examenes');

  // Sin nivel en la URL, el examen del nivel del usuario (B1); de ese aún no hay simulacro.
  await expect(page.getByRole('heading', { level: 1, name: 'Exámenes' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'B1 Preliminary', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Aún no hay simulacro de B1 Preliminary' }),
  ).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('link', { name: 'B2', exact: true }).click();
  await expect(page).toHaveURL(/nivel=B2/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'B2 First', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Se aprueba con 160 puntos/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulacro 1' })).toBeVisible();

  // Cada prueba, con el tiempo, las partes, las preguntas y los puntos del examen de verdad.
  const row = (title: string) => page.getByRole('listitem').filter({ hasText: title });
  const reading = row('Reading and Use of English');
  for (const chip of ['75 min', '7 partes', '52 preguntas', '70 puntos']) {
    await expect(reading.getByText(chip, { exact: true })).toBeVisible();
  }
  const listening = row('La cinta suena sola');
  for (const chip of ['unos 40 min', '4 partes', '30 preguntas', '30 puntos']) {
    await expect(listening.getByText(chip, { exact: true })).toBeVisible();
  }
  const speaking = row('El examinador pregunta en voz alta');
  for (const chip of ['14 min', '4 partes', '60 puntos']) {
    await expect(speaking.getByText(chip, { exact: true })).toBeVisible();
  }
  // El Writing se hace en su sección, con el tiempo oficial a la vista.
  await expect(page.getByText('80 min', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a Escribir' })).toHaveAttribute(
    'href',
    '/escribir?nivel=B2',
  );
  await expectAccessible(page);

  // Cambridge no tiene A1 para adultos: se dice claramente.
  await page.getByRole('link', { name: 'A1', exact: true }).click();
  await expect(page.getByText(/Cambridge no tiene examen de A1 para adultos/)).toBeVisible();

  // Está en el menú (en móvil, bajo «Más»).
  await page.goto('/hoy');
  if (isMobile) await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('link', { name: 'Exámenes' }).click();
  await expect(page).toHaveURL(/\/examenes$/);
  expect(errors).toEqual([]);
});

test('Reading and Use of English: reloj oficial, una sola entrega y corrección con la escala Cambridge', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto(`/examenes/${READING}`);

  await expect(
    page.getByRole('heading', { level: 1, name: 'B2 First · Reading and Use of English' }),
  ).toBeVisible();
  await expect(page.getByText('Tienes 75 minutos, el tiempo oficial de la prueba.')).toBeVisible();
  await expect(page.getByText('Key word transformations')).toBeVisible();
  await expect(page.getByText('6 preguntas · 12 puntos').first()).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Empezar la prueba' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^7[45]:\d\d$/);
  await expect(page.getByText('0 de 52 respondidas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entregar' })).toBeDisabled();
  // Ni las respuestas ni las explicaciones están en la página mientras dura la prueba.
  expect(await page.content()).not.toContain('colocación fija');

  // Parte 1 · elegir la palabra.
  await page.getByLabel('Pregunta 1', { exact: true }).selectOption({ label: 'B. tight' });
  await expect(page.getByText('1 de 52 respondidas')).toBeVisible();
  await expect(partTab(page, 1)).toContainText('1/8');

  // Parte 4 · transformaciones, con el contador de palabras.
  await partTab(page, 4).click();
  await expect(page.getByText(/Entre 2 y 5 palabras/)).toBeVisible();
  await page.getByLabel('Pregunta 25', { exact: true }).fill('must have left');
  await expect(page.getByText('3 palabras').first()).toBeVisible();

  // Parte 5 · texto largo con preguntas de cuatro opciones.
  await partTab(page, 5).click();
  await expect(page.getByRole('heading', { name: 'A different kind of work' })).toBeVisible();
  await page
    .getByRole('group', { name: /What does Hannah say about her previous job/ })
    .getByRole('radio')
    .nth(2)
    .check();

  // Parte 6 · devolver cada frase a su hueco.
  await page.getByRole('button', { name: 'Parte siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'Frases que faltan' })).toBeVisible();
  await page.getByLabel('Pregunta 37', { exact: true }).selectOption('C');

  // Parte 7 · emparejar preguntas con textos.
  await partTab(page, 7).click();
  await page.getByLabel('Pregunta 43', { exact: true }).selectOption('A');
  await expect(page.getByText('5 de 52 respondidas')).toBeVisible();
  await expectAccessible(page);

  // Recargar no pierde la prueba: siguen las respuestas y el reloj.
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText('5 de 52 respondidas')).toBeVisible();
  await expect(page.getByLabel('Pregunta 1', { exact: true })).toHaveValue('1');

  // Una sola entrega, con aviso de lo que queda en blanco.
  await page.getByRole('button', { name: 'Entregar' }).click();
  const confirm = page.getByRole('alertdialog', { name: '¿Entregar la prueba?' });
  await expect(confirm).toContainText('Te quedan 47 preguntas sin responder');
  await confirm.getByRole('button', { name: 'Seguir con la prueba' }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole('button', { name: 'Entregar' }).click();
  await confirm.getByRole('button', { name: 'Entregar ahora' }).click();

  // La corrección: 1 + 2 + 2 + 2 + 1 puntos, repartidos por sección como en el examen.
  await expect(page).toHaveURL(new RegExp(`/examenes/${READING}/resultado$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Corrección del simulacro' }),
  ).toBeVisible();
  await expect(page.getByText('Puntos: 8 de 70 (11 %)')).toBeVisible();
  await expect(page.getByText('6 de 42 puntos')).toBeVisible();
  await expect(page.getByText('2 de 28 puntos').first()).toBeVisible();
  await expect(page.getByText('No aprobado: por debajo de lo que certifica el examen')).toHaveCount(
    2,
  );
  await expect(
    page.getByText(/tablas que Cambridge publica.*B2 First \(aprobado: 160\)/),
  ).toBeVisible();
  // Ahora sí: respuesta correcta y explicación de cada pregunta, también de las que falló.
  await expect(page.getByText(/«Money is tight» es la colocación fija/)).toBeVisible();
  await expect(page.getByText('B. verge').or(page.getByText('C. source'))).toBeVisible();
  await page.getByText('Ver el texto resuelto').first().click();
  await expect(page.getByText(/only when money was/)).toBeVisible();
  await expectAccessible(page);

  // Lo guardado: el progreso de la prueba y un intento por respuesta, todos de la misma entrega.
  const progress = await queryDatabase<{ status: string; score: number; attempts: number }>(
    request,
    'select status, score, attempts from public.lesson_progress where lesson_id = $1',
    [READING],
  );
  expect(progress).toHaveLength(1);
  expect(progress[0]).toMatchObject({ status: 'completed', attempts: 1 });
  expect(progress[0]?.score).toBeCloseTo(8 / 70, 4);
  const attempts = await queryDatabase<{
    item_id: string;
    skill: string;
    task_type: string;
    score: number;
    sitting: string;
  }>(
    request,
    `select item_id, skill, task_type, score, response->>'sitting' as sitting
       from public.item_attempts where lesson_id = $1 order by id`,
    [READING],
  );
  expect(attempts.map((row) => [row.item_id, row.skill, row.task_type, row.score])).toEqual([
    [`${READING}:1`, 'reading', 'exam_mcq_cloze', 1],
    [`${READING}:25`, 'grammar', 'exam_key_word_transformation', 1],
    [`${READING}:31`, 'reading', 'exam_mcq', 1],
    [`${READING}:37`, 'reading', 'exam_gapped_text', 1],
    [`${READING}:43`, 'reading', 'exam_matching', 1],
  ]);
  expect(new Set(attempts.map((row) => row.sitting)).size).toBe(1);
  // Un examen no mueve el nivel estimado: las destrezas siguen como estaban.
  expect(
    await queryDatabase(request, 'select distinct rating, items_count from public.skill_ratings'),
  ).toEqual([{ rating: 1100, items_count: 0 }]);

  // La corrección se puede volver a ver desde el índice, y la prueba se puede repetir.
  await page.getByRole('link', { name: 'Volver a Exámenes' }).first().click();
  await expect(page).toHaveURL(/\/examenes\?nivel=B2$/);
  await expect(page.getByText('Última nota: 11 %')).toBeVisible();
  await page.getByRole('link', { name: 'Ver la corrección' }).click();
  await expect(page.getByText('Puntos: 8 de 70 (11 %)')).toBeVisible();
  await page.getByRole('link', { name: 'Repetir la prueba' }).click();
  await expect(page.getByRole('button', { name: 'Empezar la prueba' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('al acabarse el tiempo la prueba se entrega sola', async ({ page, request }) => {
  const errors = trackErrors(page);
  await page.clock.install({ time: new Date('2026-10-10T10:00:00') });
  await signIn(page);

  // Sin ninguna respuesta no hay nada que corregir ni que guardar.
  await page.goto(`/examenes/${READING}`);
  await page.getByRole('button', { name: 'Empezar la prueba' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.fastForward('01:15:05');
  await expect(
    page.getByText('Se ha acabado el tiempo sin ninguna respuesta: no hay nada que corregir.'),
  ).toBeVisible();
  expect(await queryDatabase(request, 'select 1 from public.lesson_progress')).toEqual([]);

  // Con respuestas, se entrega lo que haya y se va a la corrección.
  await page.goto(`/examenes/${READING}`);
  await page.getByRole('button', { name: 'Empezar la prueba' }).click();
  await page.getByLabel('Pregunta 2', { exact: true }).selectOption({ label: 'C. source' });
  await page.clock.fastForward('01:10:00');
  // A falta de cinco minutos el reloj avisa con el color; la prueba sigue.
  await expect(page.getByRole('timer')).toHaveText(/^[0-4]:\d\d$/);
  await page.clock.fastForward('05:05');
  await expect(page).toHaveURL(new RegExp(`/examenes/${READING}/resultado$`));
  await expect(page.getByText('Puntos: 1 de 70 (1 %)')).toBeVisible();

  expect(errors).toEqual([]);
});

test('Listening: la cinta suena sola y el guion solo aparece en la corrección', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto(`/examenes/${LISTENING}`);

  await expect(page.getByRole('heading', { level: 1, name: 'B2 First · Listening' })).toBeVisible();
  await expect(
    page.getByText(/La prueba dura unos \d+ minutos y no se puede parar\./),
  ).toBeVisible();
  await expect(page.getByText('Sentence completion')).toBeVisible();
  await expectAccessible(page);

  const audio = page.waitForRequest((request) =>
    /\/audio\/exams\/b2\/.+\/r01\.m4a/.test(request.url()),
  );
  await page.getByRole('button', { name: 'Empezar la prueba' }).click();

  // Primero, tiempo para leer la pregunta; luego la grabación, sin controles para pararla.
  await expect(page.getByText('Parte 1 · lee las preguntas')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Avance de la prueba' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pausa|Reproducir/ })).toHaveCount(0);
  // El guion no ha viajado al navegador.
  expect(await page.content()).not.toContain('Daniel Reeves');

  await page
    .getByRole('group', { name: /You hear two friends talking about a film/ })
    .getByRole('radio')
    .nth(1)
    .check();
  await audio;
  await expect(page.getByText('Parte 1 · primera escucha')).toBeVisible({ timeout: 20_000 });
  await expectAccessible(page);

  // Parte 2 · completar frases; parte 3 · emparejar hablantes con afirmaciones.
  await partTab(page, 2).click();
  await page.getByLabel('Pregunta 9', { exact: true }).fill('Pharmacist');
  await partTab(page, 3).click();
  await expect(page.getByText('the pace of life')).toBeVisible();
  await page.getByLabel('Pregunta 19', { exact: true }).selectOption('A');

  await page.getByRole('button', { name: 'Entregar' }).click();
  await page
    .getByRole('alertdialog', { name: '¿Entregar la prueba?' })
    .getByRole('button', { name: 'Entregar ahora' })
    .click();

  await expect(page).toHaveURL(new RegExp(`/examenes/${LISTENING}/resultado$`));
  await expect(page.getByText('Puntos: 2 de 30 (7 %)')).toBeVisible();
  await expect(page.getByText('2 de 30 puntos').first()).toBeVisible();
  // Ya corregida, se puede leer lo que se dijo.
  await page.getByText('Ver la transcripción').first().click();
  await expect(page.getByText(/I wasn't expecting much from Daniel Reeves/)).toBeVisible();
  await expectAccessible(page);

  const attempts = await queryDatabase<{ item_id: string; skill: string; score: number }>(
    request,
    'select item_id, skill, score from public.item_attempts where lesson_id = $1 order by id',
    [LISTENING],
  );
  expect(attempts.map((row) => [row.item_id, row.skill, row.score])).toEqual([
    [`${LISTENING}:1`, 'listening', 1],
    [`${LISTENING}:9`, 'listening', 1],
    [`${LISTENING}:19`, 'listening', 0],
  ]);

  expect(errors).toEqual([]);
});

test('Speaking: el examinador pregunta, corre el tiempo, te grabas y te puntúas', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  // La voz del navegador se sustituye por una que «termina» al momento y apunta lo que dice.
  await page.addInitScript(() => {
    const scope = window as unknown as { __spoken: string[] };
    scope.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel: () => undefined,
        speak: (utterance: SpeechSynthesisUtterance) => {
          scope.__spoken.push(utterance.text);
          setTimeout(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent), 30);
        },
      },
    });
  });
  await signIn(page);
  await page.goto(`/examenes/${SPEAKING}`);

  await expect(page.getByRole('heading', { level: 1, name: 'B2 First · Speaking' })).toBeVisible();
  await expect(page.getByText(/La prueba oficial dura 14 minutos por pareja/)).toBeVisible();
  await expect(page.getByText('Collaborative task')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Empezar la prueba' }).click();

  // Parte 1: la pregunta se oye; el turno corre con su tiempo y se graba.
  await expect(page.getByText('Turno 1 de 14')).toBeVisible();
  await expect(page.getByText('Tu turno')).toBeVisible();
  await expect(page.getByText('Grabando tus respuestas')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^0:(2\d|30)$/);
  await expect(
    page.getByText(/Where are you from, and what do you like about living there\?/),
  ).toBeVisible();
  await expectAccessible(page);

  const next = page.getByRole('button', { name: /^(He terminado|Continuar)$/ });
  // Se dejan correr unos segundos de respuesta para que haya algo grabado.
  await page.waitForTimeout(1200);
  for (let turn = 1; turn <= 5; turn++) await next.click();

  // Parte 2: dos fotos (descritas) y la pregunta escrita, con un minuto.
  await expect(page.getByRole('heading', { name: /Parte 2/ })).toBeVisible();
  await expect(
    page.getByText('What are the people enjoying about learning in these ways?'),
  ).toBeVisible();
  await expect(page.getByText(/A group of adults in a cooking class/)).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^(1:00|0:5\d)$/);
  await next.click();
  await next.click();

  // Parte 3: primero se mira la tarea; después, dos minutos para comentarla.
  await expect(page.getByRole('heading', { name: /Parte 3/ })).toBeVisible();
  await expect(page.getByText('Mira la tarea')).toBeVisible();
  await expect(page.getByText('creating more parks')).toBeVisible();
  await next.click();
  await expect(page.getByText('Tu turno')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^(2:00|1:5\d)$/);

  // El resto de turnos, hasta el final.
  for (let step = 0; step < 20; step++) {
    if (await page.getByRole('heading', { name: 'Escúchate' }).isVisible()) break;
    await next.click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByRole('heading', { name: 'Escúchate' })).toBeVisible();
  // Las grabaciones se quedan en el navegador (blob:), listas para escucharse.
  await expect(page.locator('audio').first()).toHaveAttribute('src', /^blob:/);
  await expect(page.getByText('Shall we start with…?')).toBeVisible();
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken).toHaveLength(14);
  expect(spoken[1]).toBe('What do you enjoy doing in your free time?');

  // Autoevaluación con los criterios y los pesos del B2 First.
  const save = page.getByRole('button', { name: 'Guardar mi nota' });
  await expect(save).toBeDisabled();
  for (const criterion of [
    'Grammar and Vocabulary',
    'Discourse Management',
    'Pronunciation',
    'Interactive Communication',
    'Global Achievement',
  ]) {
    await page.getByRole('group', { name: criterion }).getByText('3', { exact: true }).click();
  }
  await expectAccessible(page);
  await save.click();

  await expect(page.getByText('Speaking: 36 de 60 puntos')).toBeVisible();
  await expect(page.getByText(/Escala Cambridge: 160 · Aprobado con Grade C/)).toBeVisible();

  const progress = await queryDatabase<{ status: string; score: number }>(
    request,
    'select status, score from public.lesson_progress where lesson_id = $1',
    [SPEAKING],
  );
  expect(progress[0]).toMatchObject({ status: 'completed' });
  expect(progress[0]?.score).toBeCloseTo(0.6, 4);
  const attempts = await queryDatabase<{ skill: string; task_type: string; score: number }>(
    request,
    'select skill, task_type, score from public.item_attempts where lesson_id = $1',
    [SPEAKING],
  );
  expect(attempts).toHaveLength(5);
  expect(
    attempts.every((row) => row.skill === 'speaking' && row.task_type === 'exam_speaking'),
  ).toBe(true);
  // No se ha enviado ninguna grabación al servidor: solo la nota.
  expect(JSON.stringify(attempts)).not.toContain('blob');

  expect(errors).toEqual([]);
});
