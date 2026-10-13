import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Writing: consignas por nivel, editor, revisión sin IA, corrección con IA (contra un doble
// de la API de Claude que sirve el emulador), límites, reescritura, repaso e historial.
// El contenido de prueba tiene las consignas a1-wri-001, b1-wri-001, b1-wri-004, b2-wri-001
// y b2-wri-005; el usuario de prueba es B1 y el límite diario de IA es 3.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

type StubMode = 'ok' | 'refusal' | 'max_tokens' | 'http_error';

/** Decide cómo contestará el doble de la API a la siguiente corrección. */
async function setAi(request: APIRequestContext, mode: StubMode, feedback?: unknown) {
  const response = await request.post(`${E2E.emulatorUrl}/__test/ai`, { data: { mode, feedback } });
  expect(response.ok()).toBe(true);
}

/** Lo que le ha llegado al doble de la API desde la última vez que se configuró. */
async function aiRequests(request: APIRequestContext) {
  const response = await request.get(`${E2E.emulatorUrl}/__test/ai`);
  const body = (await response.json()) as {
    requests: {
      apiKey?: string;
      body: {
        model: string;
        max_tokens: number;
        system: { text: string }[];
        messages: { role: string; content: string }[];
        output_config: { effort: string; format: { type: string } };
      };
    }[];
  };
  return body.requests;
}

/** En el móvil la corrección va en pestañas; en escritorio las dos columnas se ven a la vez. */
async function showTab(page: Page, name: 'Tu texto' | 'Corrección') {
  const tab = page.getByRole('tab', { name });
  if (await tab.isVisible()) await tab.click();
}

const editor = (page: Page) => page.getByLabel('Tu texto', { exact: true });

/** Llama al Route Handler como lo hace la app, desde la propia página. */
const postFeedback = (page: Page, body: unknown) =>
  page.evaluate(async (payload) => {
    const response = await fetch('/api/ai/writing-feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: (await response.json()) as { error?: string } };
  }, body);

const EMAIL = [
  'Hi Sophie,',
  'I am agree that Valencia is a good idea. It depends of the weather, but people is very friendly here.',
  'See you soon,\nAntonio',
].join('\n\n');

const ESSAY =
  'I am agree that online classes are useful. However, it depends of the teacher and the students.';

const FEEDBACK = {
  overall_es: 'Se entiende bien, pero hay dos errores típicos.',
  // Con otra caja a propósito: la app no debe perder la corrección por eso.
  estimated_level: 'b1',
  scores: { content: 3, communicative_achievement: 2, organisation: 3, language: 2 },
  corrections: [
    {
      original: 'I am agree',
      corrected: 'I agree',
      type: 'Grammar',
      severity: 'major',
      explanation_es: '*Agree* ya es un verbo.',
      grammar_ref: 'a1.present-simple',
    },
    {
      original: 'depends of',
      corrected: 'depends on',
      type: 'grammar',
      severity: 'minor',
      explanation_es: 'Es *depend on*.',
      grammar_ref: 'una.ficha-que-no-existe',
    },
    {
      original: 'esto no está en el texto',
      corrected: 'x',
      type: 'grammar',
      severity: 'minor',
      explanation_es: 'Corrección inventada.',
      grammar_ref: '',
    },
  ],
  corrected_text:
    'I agree that online classes are useful. However, it depends on the teacher and the students.',
  upgrades: [{ from: 'useful', to: 'valuable', why_es: 'Más preciso en un ensayo.' }],
  focus_next_es: 'Las preposiciones que piden los verbos.',
  srs_candidates: [{ front: 'I am agree with you.', back: 'I agree — «agree» ya es verbo' }],
};

test('la biblioteca enseña las consignas del nivel y la respuesta modelo no viaja con ellas', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/escribir');

  await expect(page.getByRole('heading', { level: 1, name: 'Escribir' })).toBeVisible();
  await expect(page.getByText('0 de 2 writings esta semana')).toBeVisible();
  await expect(page.getByText('0 de 3 correcciones con IA hoy')).toBeVisible();

  // Por defecto, las del nivel del usuario (B1).
  const cards = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('link', { name: /A friend is visiting your city/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Classroom or online/ })).toHaveCount(0);
  await expectAccessible(page);

  // Otro nivel, por la URL.
  await page.getByRole('link', { name: 'B2', exact: true }).click();
  await expect(page).toHaveURL(/nivel=B2/);
  await expect(page.getByRole('link', { name: /Classroom or online/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sports facilities/ })).toContainText('Informe');

  await page.getByRole('link', { name: /Classroom or online/ }).click();
  await expect(page).toHaveURL(/\/escribir\/b2-wri-001$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Classroom or online?' })).toBeVisible();
  await expect(page.getByText('Is it better to learn in a classroom')).toBeVisible();
  await expect(page.getByText('140–190 palabras').first()).toBeVisible();
  await expectAccessible(page);

  // La respuesta modelo no está en la página: solo sale del servidor al entregar.
  expect(await page.content()).not.toContain('traditional classrooms are still necessary');

  await page.goto('/escribir/b9-wri-999');
  await expect(page.getByRole('heading', { name: 'Aquí no hay nada' })).toBeVisible();
  expect(errors.filter((message) => !message.includes('404'))).toEqual([]);
});

test('revisión sin IA: errores típicos, respuesta modelo, autoevaluación, reescritura y repaso', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/escribir/b1-wri-001');

  await editor(page).fill(EMAIL);
  await expect(page.getByText('26 palabras')).toBeVisible();
  await expect(page.getByText('faltan 74 para el mínimo')).toBeVisible();
  expect(await page.content()).not.toContain('Turia gardens');

  await page.getByRole('button', { name: 'Revisar sin IA' }).click();
  await expect(page.getByRole('heading', { name: 'Revisión sin IA' })).toBeVisible();

  // Forma: corto, sin párrafos suficientes y sin conectores; con saludo y despedida.
  await expect(
    page.getByText('Te has quedado corto: 26 palabras (se piden 100–140).'),
  ).toBeVisible();
  await expect(page.getByText(/Párrafos: 1\. Este texto pide al menos 3/)).toBeVisible();
  await expect(page.getByText('Empieza con un saludo.')).toBeVisible();
  await expect(page.getByText('Tiene despedida.')).toBeVisible();
  await expect(page.getByText(/No hemos visto conectores/)).toBeVisible();

  // Los tres errores, con su propuesta y su explicación.
  const hints = page.getByRole('region', { name: 'Posibles errores' }).getByRole('listitem');
  await expect(hints).toHaveCount(3);
  await expect(hints.nth(0)).toContainText('I am agree');
  await expect(hints.nth(0)).toContainText('I agree');
  await expect(hints.nth(1)).toContainText('depends on');
  await expect(hints.nth(1)).toContainText('Es depend on');
  await expect(hints.nth(2)).toContainText('people are');
  await expect(page.locator('mark')).toHaveCount(3);
  await expectAccessible(page);

  // La respuesta modelo, ahora sí.
  await page.getByText('Respuesta modelo', { exact: true }).click();
  await expect(page.getByText(/Turia gardens/)).toBeVisible();

  // Al repaso: una tarjeta de gramática por error, con la frase ya corregida y un hueco.
  await page.getByRole('button', { name: 'Añadir al repaso' }).click();
  await expect(page.getByText('3 tarjetas añadidas al repaso.')).toBeVisible();
  const cards = await queryDatabase<{ key: string; prompt: string; answer: string }>(
    request,
    `select source_segment_id as key, front->>'prompt' as prompt, back->'answers'->>0 as answer
     from public.srs_cards where kind = 'grammar' order by source_segment_id`,
  );
  expect(cards).toEqual([
    { key: 'wri:be-agree:agree', prompt: 'I ___ that Valencia is a good idea.', answer: 'agree' },
    {
      key: 'wri:depend-of:on',
      prompt: 'It depends ___ the weather, but people are very friendly here.',
      answer: 'on',
    },
    {
      key: 'wri:people-is:are',
      prompt: 'It depends on the weather, but people ___ very friendly here.',
      answer: 'are',
    },
  ]);

  // Autoevaluación: puntos cubiertos y notas con la rúbrica.
  await page.getByRole('checkbox', { name: 'say you are happy about her visit' }).check();
  await page.getByLabel('Contenido', { exact: true }).selectOption('4');
  await page.getByLabel('Logro comunicativo', { exact: true }).selectOption('3');
  await page.getByLabel('Organización', { exact: true }).selectOption('3');
  await page.getByLabel('Lengua', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Guardar autoevaluación' }).click();
  await expect(page.getByText('Autoevaluación guardada.')).toBeVisible();

  // Reescritura, con la revisión al lado (en el móvil, en la otra pestaña).
  await showTab(page, 'Tu texto');
  const rewritten = EMAIL.replace('I am agree', 'I agree').replace('depends of', 'depends on');
  await page.getByLabel('Tu texto reescrito').fill(rewritten);
  await page.getByRole('button', { name: 'Guardar reescritura' }).click();
  await expect(page.getByText('Reescritura guardada (25 palabras).')).toBeVisible();

  const rows = await queryDatabase(
    request,
    `select prompt_id, task_type, target_level, word_count, status, review_kind, model, exam_mode,
            cost_usd::float as cost, feedback, rewrite_text, rewritten_at is not null as rewritten
     from public.writing_submissions`,
  );
  expect(rows).toEqual([
    {
      prompt_id: 'b1-wri-001',
      task_type: 'email',
      target_level: 'B1',
      word_count: 26,
      status: 'done',
      review_kind: 'self',
      model: null,
      exam_mode: false,
      cost: 0,
      feedback: {
        kind: 'self',
        scores: { content: 4, communicative_achievement: 3, organisation: 3, language: 2 },
        points: [true, false, false, false],
      },
      rewrite_text: rewritten,
      rewritten: true,
    },
  ]);

  // El historial: la entrega, sus notas y la evolución por criterio.
  await page.goto('/escribir/historial');
  await expect(page.getByRole('heading', { level: 1, name: 'Historial de writing' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Contenido: 4' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Lengua: 2' })).toBeVisible();
  await expect(page.getByText('Por dónde empezar: Lengua')).toBeVisible();
  const entry = page.getByRole('link', { name: /A friend is visiting your city/ });
  await expect(entry).toContainText('Sin IA');
  await expect(entry).toContainText('Media: 3');
  await expect(entry).toContainText('Reescrito');
  await expectAccessible(page);

  // Y la entrega se puede volver a abrir tal como quedó.
  await entry.click();
  await expect(page).toHaveURL(/\/escribir\/historial\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Revisión sin IA' })).toBeVisible();
  await expect(page.getByLabel('Contenido', { exact: true })).toHaveValue('4');
  await expect(
    page.getByRole('checkbox', { name: 'say you are happy about her visit' }),
  ).toBeChecked();
  await showTab(page, 'Tu texto');
  await expect(page.getByLabel('Tu texto reescrito')).toHaveValue(rewritten);
  await expectAccessible(page);

  // La biblioteca ya cuenta el writing de la semana.
  await page.goto('/escribir');
  await expect(page.getByText('1 de 2 writings esta semana')).toBeVisible();
  await expect(page.getByRole('link', { name: /A friend is visiting your city/ })).toContainText(
    'Entregada 1 vez',
  );
  expect(errors).toEqual([]);
});

test('corrección con IA: feedback ajustado, coste guardado y errores recurrentes al repaso', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await setAi(request, 'ok', FEEDBACK);
  await signIn(page);
  await page.goto('/escribir/b2-wri-001');

  await editor(page).fill(ESSAY);
  await page.getByRole('button', { name: 'Corregir con IA' }).click();
  await expect(page.getByRole('heading', { name: 'Corrección de la IA' })).toBeVisible({
    timeout: 20_000,
  });

  await expect(page.getByText('Se entiende bien, pero hay dos errores típicos.')).toBeVisible();
  await expect(page.getByText('Nivel que demuestra el texto: B1')).toBeVisible();
  await expect(page.getByText('Nivel de la tarea: B2')).toBeVisible();

  // Solo las dos correcciones que están en el texto; la inventada se descarta.
  const corrections = page.getByRole('region', { name: 'Correcciones' }).getByRole('listitem');
  await expect(corrections).toHaveCount(2);
  await expect(corrections.nth(0)).toContainText('I am agree');
  await expect(corrections.nth(0)).toContainText('I agree');
  await expect(corrections.nth(0)).toContainText('Importante');
  await expect(corrections.nth(0)).toContainText('Gramática');
  await expect(corrections.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    '/gramatica/a1.present-simple',
  );
  // La ficha que no existe no se enlaza.
  await expect(corrections.nth(1).getByRole('link')).toHaveCount(0);
  await expect(page.locator('mark')).toHaveCount(2);

  await expect(page.getByText('valuable')).toBeVisible();
  await expect(page.getByText('Las preposiciones que piden los verbos.')).toBeVisible();
  await expect(page.getByText('2 de 5').first()).toBeVisible();
  await expectAccessible(page);

  // La respuesta modelo llega con la corrección.
  await page.getByText('Respuesta modelo', { exact: true }).click();
  await expect(page.getByText(/traditional classrooms are still necessary/)).toBeVisible();

  // La tarjeta que propone la IA.
  await expect(page.getByText('I am agree with you.')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir al repaso' }).click();
  await expect(page.getByText('1 tarjeta añadida al repaso.')).toBeVisible();

  // Lo guardado: la corrección ajustada, los tokens y el coste (2,5k + 2k con Sonnet).
  const rows = await queryDatabase(
    request,
    `select review_kind, status, model, input_tokens, output_tokens, cost_usd::float as cost,
            feedback->>'prompt_version' as version, feedback->>'estimated_level' as level,
            jsonb_array_length(feedback->'corrections') as corrections,
            feedback->'corrections'->0->>'type' as first_type,
            feedback->'corrections'->1->>'grammar_ref' as second_ref
     from public.writing_submissions`,
  );
  expect(rows).toEqual([
    {
      review_kind: 'ai',
      status: 'done',
      model: 'claude-sonnet-5-5',
      input_tokens: 2500,
      output_tokens: 2000,
      cost: 0.025,
      version: 'writing@1',
      level: 'B1',
      corrections: 2,
      first_type: 'grammar',
      second_ref: '',
    },
  ]);
  // Y en el registro de uso (ADR-0024), la reserva cerrada con lo que costó de verdad.
  expect(
    await queryDatabase(
      request,
      `select status, model, input_tokens, output_tokens, cost_usd::float as cost,
              reserved_usd > cost_usd as reserved_more, settle_hash is null as closed
       from public.ai_usage`,
    ),
  ).toEqual([
    {
      status: 'done',
      model: 'claude-sonnet-5-5',
      input_tokens: 2500,
      output_tokens: 2000,
      cost: 0.025,
      reserved_more: true,
      closed: true,
    },
  ]);

  // Lo que recibió la API: la clave del servidor, el prompt del sistema y el texto como datos.
  const [call] = await aiRequests(request);
  expect(call?.apiKey).toBe('e2e-key');
  expect(call?.body.model).toBe('claude-sonnet-5-5');
  expect(call?.body.max_tokens).toBe(8000);
  expect(call?.body.output_config).toMatchObject({
    effort: 'medium',
    format: { type: 'json_schema' },
  });
  expect(call?.body.system[0]?.text).toContain('experienced English writing examiner');
  const message = call?.body.messages[0]?.content ?? '';
  expect(message).toContain('type: essay');
  expect(message).toContain('target_level: B2');
  expect(message).toContain('Is it better to learn in a classroom than to study online?');
  expect(message).toContain(`<learner_text>\n${ESSAY}\n</learner_text>`);

  // El contador de hoy ha subido.
  await page.goto('/escribir');
  await expect(page.getByText('1 de 3 correcciones con IA hoy')).toBeVisible();

  // En el repaso, la tarjeta de la IA se mira y se valora, no se teclea.
  await page.goto('/repasar');
  await expect(
    page.getByText('Corrige o completa la frase y luego mira la respuesta.'),
  ).toBeVisible();
  await expect(page.getByText('I am agree with you.')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByText('I agree — «agree» ya es verbo')).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver el writing/ })).toBeVisible();

  // Y en el historial, con las notas de la IA.
  await page.goto('/escribir/historial');
  const entry = page.getByRole('link', { name: /Classroom or online/ });
  await expect(entry).toContainText('IA');
  await expect(entry).toContainText('Media: 2,5');
  await entry.click();
  await expect(page.getByRole('heading', { name: 'Corrección de la IA' })).toBeVisible();
  await expect(page.getByText('Se entiende bien, pero hay dos errores típicos.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('el límite diario y el tope mensual cortan la corrección con IA', async ({
  page,
  request,
}) => {
  await signIn(page);
  // Llamadas que ya constan en el registro de uso (las escribe el «superusuario» del test).
  const insert = (n: number, cost: number) =>
    queryDatabase(
      request,
      `insert into public.ai_usage (user_id, model, status, reserved_usd, cost_usd)
       select u.id, 'claude-sonnet-5-5', 'done', $2, $2
       from auth.users u, generate_series(1, $1)`,
      [n, cost],
    );

  // Tres correcciones hoy: el límite de la app de pruebas.
  await insert(3, 0.025);
  await page.goto('/escribir/b2-wri-001');
  await expect(page.getByText('3 de 3 correcciones con IA hoy')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corregir con IA' })).toHaveCount(0);
  await expect(page.getByText(/Has usado las 3 correcciones con IA de hoy/)).toBeVisible();
  // La revisión sin IA sigue disponible.
  await expect(page.getByRole('button', { name: 'Revisar sin IA' })).toBeEnabled();

  // Y el servidor lo corta aunque se le llame directamente, sin llegar a la API.
  await setAi(request, 'ok');
  expect(await postFeedback(page, { promptId: 'b2-wri-001', text: ESSAY })).toEqual({
    status: 429,
    body: { error: 'daily_limit' },
  });
  expect(await aiRequests(request)).toEqual([]);

  // Tope mensual: una sola corrección, pero con el gasto del mes ya en 5 $.
  await queryDatabase(request, 'delete from public.ai_usage');
  await insert(1, 5);
  await page.reload();
  await expect(page.getByText('1 de 3 correcciones con IA hoy')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corregir con IA' })).toHaveCount(0);
  await expect(page.getByText(/tope de gasto en IA de este mes/)).toBeVisible();
  expect(await postFeedback(page, { promptId: 'b2-wri-001', text: ESSAY })).toEqual({
    status: 429,
    body: { error: 'monthly_budget' },
  });
  expect(await aiRequests(request)).toEqual([]);
  // Lo que se corta no deja rastro: ni entrega ni reserva.
  expect(
    await queryDatabase(
      request,
      `select (select count(*)::int from public.ai_usage) as usage,
              (select count(*)::int from public.writing_submissions) as submissions`,
    ),
  ).toEqual([{ usage: 1, submissions: 0 }]);
});

// ADR-0024: el uso de la IA consta en un registro que la sesión del usuario solo puede leer.
// Antes se contaban las entregas, y quien tuviera la sesión podía borrarlas para seguir gastando.
test('borrar las entregas no devuelve correcciones: el uso consta en un registro aparte', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/escribir/b2-wri-001');
  await setAi(request, 'ok');
  for (let n = 0; n < 3; n++) {
    expect((await postFeedback(page, { promptId: 'b2-wri-001', text: ESSAY })).status).toBe(200);
  }

  await queryDatabase(request, 'delete from public.writing_submissions');
  expect(await postFeedback(page, { promptId: 'b2-wri-001', text: ESSAY })).toEqual({
    status: 429,
    body: { error: 'daily_limit' },
  });
  expect(await aiRequests(request)).toHaveLength(3);
  await page.reload();
  await expect(page.getByText('3 de 3 correcciones con IA hoy')).toBeVisible();

  // Con la sesión del usuario, por la API, el registro no se puede cambiar ni borrar.
  // (La sesión va en una cookie, a veces partida en trozos: `…-auth-token.0`, `.1`…)
  const session = (await page.context().cookies())
    .filter((cookie) => /-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => cookie.value)
    .join('');
  const { access_token: token } = JSON.parse(
    Buffer.from(session.replace(/^base64-/, ''), 'base64url').toString('utf8'),
  ) as { access_token: string };
  const headers = { Authorization: `Bearer ${token}`, Prefer: 'return=representation' };
  const api = `${E2E.emulatorUrl}/rest/v1/ai_usage`;
  const seen = await request.get(`${api}?select=status`, { headers });
  expect(await seen.json()).toHaveLength(3);
  const patched = await request.patch(api, { headers, data: { cost_usd: 0, status: 'error' } });
  expect(await patched.json()).toEqual([]);
  const deleted = await request.delete(api, { headers });
  expect(await deleted.json()).toEqual([]);
  expect(
    await queryDatabase(request, `select status, cost_usd::float as cost from public.ai_usage`),
  ).toEqual(Array.from({ length: 3 }, () => ({ status: 'done', cost: 0.025 })));
});

test('si la IA se niega, se corta o falla, el texto no se pierde y se explica qué ha pasado', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto('/escribir/b2-wri-001');
  await editor(page).fill(ESSAY);
  const correct = page.getByRole('button', { name: 'Corregir con IA' });
  const attempts = () =>
    queryDatabase(
      request,
      `select status, feedback->>'error' as reason, cost_usd::float as cost
       from public.writing_submissions order by created_at`,
    );

  // Rechazo: error controlado, sin gastar un intento de hoy.
  await setAi(request, 'refusal');
  await correct.click();
  await expect(page.getByText(/La IA no ha querido corregir este texto/)).toBeVisible();
  await expect(editor(page)).toHaveValue(ESSAY);
  await expect(page.getByText('0 de 3 correcciones con IA hoy')).toBeVisible();
  expect(await attempts()).toEqual([{ status: 'error', reason: 'refusal', cost: 0.025 }]);

  // Respuesta cortada por max_tokens: tampoco gasta intento, pero sí se anota lo cobrado.
  await setAi(request, 'max_tokens');
  await correct.click();
  await expect(page.getByText(/La corrección se ha quedado a medias/)).toBeVisible();
  await expect(page.getByText('0 de 3 correcciones con IA hoy')).toBeVisible();
  expect((await attempts())[1]).toEqual({ status: 'error', reason: 'max_tokens', cost: 0.085 });

  // Fallo de la API: sí gasta un intento (un fallo repetido no debe disparar llamadas).
  await setAi(request, 'http_error');
  await correct.click();
  await expect(page.getByText(/La IA no ha podido corregir el texto ahora/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('1 de 3 correcciones con IA hoy')).toBeVisible();
  expect((await attempts())[2]).toEqual({ status: 'error', reason: 'api', cost: 0 });
  await expect(editor(page)).toHaveValue(ESSAY);

  // Lo mismo consta en el registro de uso, que es de donde salen los límites.
  expect(
    await queryDatabase(
      request,
      `select status, reason, cost_usd::float as cost from public.ai_usage order by created_at`,
    ),
  ).toEqual([
    { status: 'error', reason: 'refusal', cost: 0.025 },
    { status: 'error', reason: 'max_tokens', cost: 0.085 },
    { status: 'error', reason: 'api', cost: 0 },
  ]);

  // Los envíos fallidos no aparecen en el historial.
  await page.goto('/escribir/historial');
  await expect(
    page.getByRole('heading', { name: 'Todavía no has entregado ningún writing' }),
  ).toBeVisible();
});

test('el borrador se guarda en el dispositivo y el modo examen quita las ayudas', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/escribir/b1-wri-004');
  const text = 'Dear Mrs Evans,\n\nThank you for your email. I would prefer to go to the theatre.';

  // Las ayudas, antes de empezar.
  await page.getByText('Consejos · Expresiones útiles').click();
  await expect(page.getByText('I look forward to hearing from you.')).toBeVisible();
  await page.getByText('Plan (opcional)').click();
  await page.getByLabel('Idea 1').fill('thank her');

  await editor(page).fill(text);
  await expect(page.getByText('Borrador guardado en este dispositivo.')).toBeVisible();

  // Al volver, el borrador sigue ahí (y nada ha ido al servidor).
  await page.reload();
  await expect(editor(page)).toHaveValue(text);
  await expect(page.getByText('Hemos recuperado tu borrador.')).toBeVisible();
  expect(await queryDatabase(request, 'select id from public.writing_submissions')).toEqual([]);
  await page.getByText('Plan (opcional)').click();
  await expect(page.getByLabel('Idea 1')).toHaveValue('thank her');

  await page.getByRole('button', { name: 'Empezar de cero' }).click();
  await expect(editor(page)).toHaveValue('');
  await page.reload();
  await expect(editor(page)).toHaveValue('');
  await expect(page.getByText('Hemos recuperado tu borrador.')).toHaveCount(0);

  // Demasiado corto: no se entrega.
  await editor(page).fill('Hi.');
  await page.getByRole('button', { name: 'Revisar sin IA' }).click();
  await expect(page.getByText(/Escribe al menos un par de frases/)).toBeVisible();

  // Modo examen: cuenta atrás, sin corrector del navegador y sin ayudas.
  await page.getByRole('checkbox', { name: /Modo examen/ }).check();
  await expect(page.getByText(/Tiempo: 2[45]:\d\d/)).toBeVisible();
  await expect(page.getByText(/En modo examen los consejos/)).toBeVisible();
  await expect(page.getByText('Consejos · Expresiones útiles')).toHaveCount(0);
  await expect(editor(page)).toHaveAttribute('spellcheck', 'false');
  await expectAccessible(page);

  await editor(page).fill(text);
  await page.getByRole('button', { name: 'Revisar sin IA' }).click();
  await expect(page.getByRole('heading', { name: 'Revisión sin IA' })).toBeVisible();
  expect(
    await queryDatabase(request, 'select exam_mode, review_kind from public.writing_submissions'),
  ).toEqual([{ exam_mode: true, review_kind: 'self' }]);

  // Entregado: el borrador se borra y se puede escribir otra vez.
  await page.getByRole('button', { name: 'Escribir otra vez' }).click();
  await expect(editor(page)).toHaveValue('');
  await page.reload();
  await expect(editor(page)).toHaveValue('');
  expect(errors).toEqual([]);
});

test('el Route Handler exige sesión, origen propio, un cuerpo válido y una consigna que exista', async ({
  page,
  request,
}) => {
  const body = { promptId: 'b2-wri-001', text: ESSAY };

  // Sin sesión.
  const anonymous = await request.post('/api/ai/writing-feedback', { data: body });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  await setAi(request, 'ok');

  // Con sesión pero sin venir de la propia app (sin Origin ni Sec-Fetch-Site).
  const foreign = await page.request.post('/api/ai/writing-feedback', { data: body });
  expect(foreign.status()).toBe(403);
  expect(await foreign.json()).toEqual({ error: 'forbidden' });

  expect(await postFeedback(page, { promptId: 'b2-wri-001', text: 'Hi.' })).toEqual({
    status: 400,
    body: { error: 'invalid_body' },
  });
  expect(await postFeedback(page, { promptId: 'no-es-un-id', text: ESSAY })).toEqual({
    status: 400,
    body: { error: 'invalid_body' },
  });
  expect(await postFeedback(page, { promptId: 'b2-wri-999', text: ESSAY })).toEqual({
    status: 404,
    body: { error: 'not_found' },
  });

  // Nada de lo anterior ha llegado a la API ni ha dejado filas.
  expect(await aiRequests(request)).toEqual([]);
  expect(await queryDatabase(request, 'select id from public.writing_submissions')).toEqual([]);
});
