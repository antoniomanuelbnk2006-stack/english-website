import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { acceptPrivacy, queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Elegir el nivel (A1–C2) y los ejercicios de Use of English con formato de examen.
// El contenido de prueba solo tiene lecciones B1 y ejercicios B2: así se ve también qué pasa
// cuando de un nivel todavía no hay nada.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

// El nivel es por idioma (ADR-0037): estos tests son de inglés. Con `null` es el primer acceso.
const setLevel = (request: APIRequestContext, level: string | null) =>
  level === null
    ? queryDatabase(request, 'delete from public.language_levels')
    : queryDatabase(
        request,
        `insert into public.language_levels (user_id, language, declared_level)
         select id, 'en', $1 from public.profiles
         on conflict (user_id, language) do update set declared_level = excluded.declared_level`,
        [level],
      );

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Enviarme el correo' }).click();
  await page.getByLabel('Código de 6 dígitos').fill(E2E.otp);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('en el primer acceso se elige el nivel, y decide lo que se ve primero', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await setLevel(request, null);
  await logIn(page);

  // Sin nivel, «Hoy» lleva a elegirlo.
  await expect(page).toHaveURL(/\/nivel$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Elige tu nivel' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Nivel elegido/ })).toHaveCount(0);
  // El contenido de prueba tiene inglés y español: antes del nivel se elige el idioma, que
  // empieza en inglés (ADR-0036).
  const languages = page.getByRole('group', { name: '¿Qué idioma quieres practicar?' });
  await expect(languages.getByRole('radio')).toHaveCount(2);
  await expect(languages.getByRole('radio', { name: 'Inglés' })).toBeChecked();
  await expect(languages.getByRole('radio', { name: 'Español' })).not.toBeChecked();
  const levels = page.getByRole('group', { name: 'Elige tu nivel' });
  const options = levels.getByRole('radio');
  await expect(options).toHaveCount(6);
  await expect(levels.getByRole('radio', { checked: true })).toHaveCount(0);
  const save = page.getByRole('button', { name: 'Guardar nivel' });
  await expect(save).toBeDisabled();
  // Cada nivel dice qué se entiende en él y cuánto contenido hay.
  await expect(page.getByText('Es el nivel del B2 First.')).toBeVisible();
  await expect(page.getByText(/\d+ contenidos?/).first()).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('radio', { name: /B2 · Avanzado/ }).check();
  await save.click();
  await expect(page).toHaveURL(/\/hoy$/);
  await expect(page.getByRole('link', { name: /Tu nivel: B2/ })).toBeVisible();
  // La cabecera enseña el nivel elegido, no la estimación (que arranca en B1).
  await expect(page.getByRole('img', { name: 'Nivel elegido: B2' })).toBeVisible();
  expect(
    await queryDatabase(request, 'select language, declared_level from public.language_levels'),
  ).toEqual([{ language: 'en', declared_level: 'B2' }]);

  // Las bibliotecas enseñan primero el nivel elegido; si no hay nada, lo dicen.
  await page.goto('/leer');
  await expect(
    page.getByRole('heading', { name: 'Aún no hay nada de nivel B2 aquí' }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('link', { name: 'Ver todos los niveles' }).click();
  await expect(page).toHaveURL(/nivel=todos/);
  await expect(page.getByRole('link', { name: /The Second Life of Old Games/ })).toBeVisible();

  // Se puede cambiar cuando se quiera.
  await page.goto('/hoy');
  await page.getByRole('link', { name: /Tu nivel: B2/ }).click();
  await expect(page.getByRole('radio', { name: /B2 · Avanzado/ })).toBeChecked();
  await page.getByRole('radio', { name: /B1 · Umbral/ }).check();
  await save.click();
  await expect(page.getByRole('link', { name: /Tu nivel: B1/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Nivel elegido: B1' })).toBeVisible();
  await page.goto('/leer');
  await expect(page).toHaveURL(/\/leer$/);
  await expect(page.getByRole('link', { name: /The Second Life of Old Games/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('Use of English: índice por nivel y por parte', async ({ page, request }) => {
  await signIn(page);

  // El usuario de prueba es B1 y de B1 no hay ejercicios en el contenido de prueba.
  await page.goto('/use-of-english');
  await expect(
    page.getByRole('heading', { name: 'Aún no hay nada de nivel B1 aquí' }),
  ).toBeVisible();

  await setLevel(request, 'B2');
  await page.goto('/use-of-english');
  for (const part of [
    'Parte 1 · Elegir la palabra',
    'Parte 2 · Completar el texto',
    'Parte 3 · Formar palabras',
    'Parte 4 · Transformar frases',
  ]) {
    await expect(page.getByRole('heading', { name: part })).toBeVisible();
  }
  await expect(page.getByText('0 de 4 hechas')).toBeVisible();
  const card = page.getByRole('link', { name: /The return of the night train/ });
  await expect(card).toContainText('8 puntos');
  await expect(card).toContainText('Nueva');
  await expect(page.getByText(/Señal no está afiliada a Cambridge/)).toBeVisible();
  await expectAccessible(page);
});

test('parte 1: se corrige en el servidor y los fallos pasan al repaso', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  const sent: string[] = [];
  await page.route('**/*', async (route) => {
    if (!['document', 'fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      sent.push(await response.text());
      await route.fulfill({ response });
    } catch {
      // La página se cerró con la petición en vuelo.
    }
  });
  const EXPLANATION = 'make a comeback';

  await setLevel(request, 'B2');
  await signIn(page);
  await page.goto('/use-of-english/b2-uoe-001');
  await expect(page.getByRole('heading', { level: 1, name: /Parte 1/ })).toBeVisible();
  await expect(page.getByText('For most of the last century')).toBeVisible();
  const check = page.getByRole('button', { name: 'Corregir' });
  await expect(check).toBeDisabled();
  await expectAccessible(page);

  // Seis bien, una mal y una en blanco.
  const right = ['B. closed', 'A. made', 'C. concerned', 'D. complete', 'B. deal', 'D. supply'];
  for (const [index, option] of right.entries()) {
    await page.getByLabel(`Hueco ${index + 1}`, { exact: true }).selectOption({ label: option });
  }
  await page.getByLabel('Hueco 7', { exact: true }).selectOption({ label: 'C. ahead' });

  // Las respuestas y las explicaciones aún no han salido del servidor.
  expect(sent.some((body) => body.includes(EXPLANATION))).toBe(false);
  await check.click();

  const result = page.getByRole('status');
  await expect(result).toContainText('Puntos: 6 de 8 (75 %)');
  await expect(result).toBeFocused();
  await expect(result).toContainText(EXPLANATION);
  await expect(result.getByText('Tu respuesta: ahead')).toBeVisible();
  await expect(result.getByText('Tu respuesta: (en blanco)')).toBeVisible();
  await expect(result.getByText('Respuesta correcta: advance')).toBeVisible();
  await expect(page.getByLabel('Hueco 1', { exact: true })).toBeDisabled();
  await expectAccessible(page);

  // Lo guardado: siete intentos (el hueco en blanco no cuenta) y el progreso con su nota.
  const attempts = await queryDatabase<{ item_id: string; score: number }>(
    request,
    `select item_id, score from public.item_attempts where skill = 'grammar' order by item_id`,
  );
  expect(attempts).toHaveLength(7);
  expect(attempts.filter((a) => a.score === 0).map((a) => a.item_id)).toEqual(['b2-uoe-001:7']);
  expect(
    await queryDatabase(
      request,
      `select status, round(score::numeric, 2)::float as score from public.lesson_progress
       where lesson_id = 'b2-uoe-001'`,
    ),
  ).toEqual([{ status: 'completed', score: 0.75 }]);

  // Los dos fallos, al repaso como tarjetas con la frase de su hueco.
  await result.getByRole('button', { name: 'Añadir 2 fallos al repaso' }).click();
  await expect(result.getByText('2 tarjetas añadidas al repaso.')).toBeVisible();
  const cards = await queryDatabase<{
    source_segment_id: string;
    front: { prompt: string; hint: string };
    back: { answers: string[]; uoe_id: string };
  }>(
    request,
    `select source_segment_id, front, back from public.srs_cards order by source_segment_id`,
  );
  expect(cards.map((c) => c.source_segment_id)).toEqual(['b2-uoe-001:7', 'b2-uoe-001:8']);
  expect(cards[0]?.front).toEqual({
    prompt: 'Tickets can also be expensive unless you book well in ___.',
    hint: 'advance · front · ahead · early',
  });
  expect(cards[0]?.back).toMatchObject({ answers: ['advance'], uoe_id: 'b2-uoe-001' });
  // En la tarjeta del 8, los demás huecos de su frase van ya rellenos.
  expect(cards[1]?.front.prompt).toBe(
    'Even so, demand keeps growing, and rail companies are ___ on that trend to continue.',
  );

  // En el repaso la tarjeta enseña las opciones como pista y enlaza con el ejercicio.
  await result.getByRole('link', { name: 'Ir al repaso' }).click();
  await expect(page.getByText('Nuevas: 2')).toBeVisible();
  await expect(page.getByText(/ · /).first()).toBeVisible();
  await page.getByLabel('Tu respuesta').fill('zzz');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByRole('link', { name: /Ver el ejercicio/ })).toHaveAttribute(
    'href',
    '/use-of-english/b2-uoe-001',
  );

  // Y el índice lo da por hecho, con su nota.
  await page.goto('/use-of-english');
  const card = page.getByRole('link', { name: /The return of the night train/ });
  await expect(card).toContainText('Hecha');
  await expect(card).toContainText('Mejor nota: 75 %');
  await expect(page.getByText('1 de 4 hechas')).toBeVisible();

  expect(errors).toEqual([]);
});

test('partes 2 y 3: una palabra por hueco y formación de palabras', async ({ page, request }) => {
  await setLevel(request, 'B2');
  await signIn(page);

  await page.goto('/use-of-english/b2-uoe-002');
  await page.getByLabel('Hueco 1', { exact: true }).fill('in');
  await page.getByLabel('Hueco 3', { exact: true }).fill('  what ');
  await page.getByLabel('Hueco 7', { exact: true }).fill('of');
  await page.getByRole('button', { name: 'Corregir' }).click();
  const result = page.getByRole('status');
  await expect(result).toContainText('Puntos: 2 de 8 (25 %)');
  await expect(result.getByText('Tu respuesta: of')).toBeVisible();
  await expect(result).toContainText('depender de');

  // Repetir deja el ejercicio en blanco.
  await result.getByRole('button', { name: 'Repetir' }).click();
  await expect(page.getByLabel('Hueco 1', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.goto('/use-of-english/b2-uoe-003');
  // La palabra dada acompaña a su hueco.
  await expect(page.getByText('EMBARRASS', { exact: true })).toBeVisible();
  await page.getByLabel('Hueco 1', { exact: true }).fill('embarrassing');
  await page.getByLabel('Hueco 2', { exact: true }).fill('psychologist');
  await page.getByLabel('Hueco 8', { exact: true }).fill('Uncertainty');
  await page.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByRole('status')).toContainText('Puntos: 2 de 8 (25 %)');
  await expect(page.getByRole('status')).toContainText('en plural');
  await expectAccessible(page);
});

test('parte 4: dos puntos por frase, por mitades, con las reglas del examen', async ({
  page,
  request,
}) => {
  await setLevel(request, 'B2');
  await signIn(page);
  await page.goto('/use-of-english/b2-uoe-004');

  await expect(page.getByText(/Entre 2 y 5 palabras/)).toBeVisible();
  await expect(page.getByText('LAST', { exact: true })).toBeVisible();
  await expectAccessible(page);

  const sentence = (n: number) => page.getByLabel(`Frase ${n}`, { exact: true });
  await sentence(1).fill('last time I went'); // completa: 2
  await expect(page.getByText('4 palabras')).toBeVisible();
  await sentence(2).fill('advised me see'); // solo la primera mitad: 1
  await sentence(3).fill('might missed'); // solo la segunda mitad: 1
  // (la 4 se queda en blanco)
  await sentence(5).fill("wish I'd studied"); // con contracción: 2
  await sentence(6).fill('is being built by the workers right now'); // demasiadas palabras: 0
  await page.getByRole('button', { name: 'Corregir' }).click();

  const result = page.getByRole('status');
  await expect(result).toContainText('Puntos: 6 de 12 (50 %)');
  await expect(result.getByText('Media respuesta')).toHaveCount(2);
  await expect(result.getByText('1 de 2 puntos')).toHaveCount(2);
  await expect(result.getByText('2 de 2 puntos')).toHaveCount(2);
  await expect(result.getByText(/Fuera del límite de palabras/)).toHaveCount(1);
  await expect(result.getByText('Respuesta correcta: such a difficult exam')).toBeVisible();
  await expectAccessible(page);

  const scores = await queryDatabase<{ item_id: string; score: number }>(
    request,
    `select item_id, score from public.item_attempts order by item_id`,
  );
  expect(scores).toEqual([
    { item_id: 'b2-uoe-004:1', score: 1 },
    { item_id: 'b2-uoe-004:2', score: 0.5 },
    { item_id: 'b2-uoe-004:3', score: 0.5 },
    { item_id: 'b2-uoe-004:5', score: 1 },
    { item_id: 'b2-uoe-004:6', score: 0 },
  ]);

  // La tarjeta de una transformación lleva la frase original y la palabra dada.
  await result.getByRole('button', { name: 'Añadir 4 fallos al repaso' }).click();
  await expect(result.getByText('4 tarjetas añadidas al repaso.')).toBeVisible();
  const [card] = await queryDatabase<{
    front: Record<string, string>;
    back: { answers: string[] };
  }>(request, `select front, back from public.srs_cards where source_segment_id = 'b2-uoe-004:2'`);
  expect(card?.front).toEqual({
    prompt: 'Maria ___ a doctor.',
    context: '"You should see a doctor," Maria told me.',
    hint: 'ADVISED',
  });
  expect(card?.back.answers).toEqual(['advised me to see']);
});

test('un ejercicio que no existe muestra «no encontrada»', async ({ page }) => {
  await signIn(page);
  for (const path of ['/use-of-english/b2-uoe-999', '/use-of-english/..%2F..%2Fpackage']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Aquí no hay nada' })).toBeVisible();
  }
});
