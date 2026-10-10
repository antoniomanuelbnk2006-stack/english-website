import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Pronunciación (ADR-0015). El reconocimiento de voz real necesita micrófono y el servicio del
// navegador, así que aquí se sustituye por un doble que «oye» lo que el test le dice. Lo que se
// prueba es todo lo demás: la valoración, los consejos, el recorrido y lo que se guarda.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

/** Reconocedor de voz de prueba: cada vez que se escucha, devuelve la siguiente respuesta. */
async function fakeRecognition(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as {
      __heard: (string[] | string)[];
      webkitSpeechRecognition: unknown;
      SpeechRecognition: unknown;
    };
    scope.__heard = [];
    class FakeRecognition {
      lang = '';
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const next = scope.__heard.shift();
        setTimeout(() => {
          if (typeof next === 'string') this.onerror?.({ error: next });
          else if (next) {
            const alternatives = next.map((transcript) => ({ transcript, confidence: 0.9 }));
            this.onresult?.({ results: [Object.assign(alternatives, { isFinal: true })] });
          }
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {}
    }
    scope.webkitSpeechRecognition = FakeRecognition;
    scope.SpeechRecognition = FakeRecognition;
  });
}

/** Lo que el reconocedor de prueba va a «oír» en el próximo intento. */
async function hear(page: Page, heard: string[] | string): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { __heard: (string[] | string)[] }).__heard.push(value);
  }, heard);
}

test('un ejercicio: se entiende, se confunde, se corrige y se guarda', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await fakeRecognition(page);
  await signIn(page);
  await page.goto('/pronunciar');

  await expect(page.getByRole('heading', { level: 1, name: 'Pronunciación' })).toBeVisible();
  // Con nivel B1 se ve el ejercicio de B1; «Todas» enseña también el de A1.
  await expect(page.getByRole('link', { name: /Think and this/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ship or sheep/ })).toHaveCount(0);
  await expect(page.getByText(/Señal no la recibe ni la guarda/)).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('link', { name: 'Todas', exact: true }).click();
  await page.getByRole('link', { name: /Ship or sheep/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ship or sheep?' })).toBeVisible();
  await expect(page.getByText(/El inglés tiene dos «íes»/)).toBeVisible();
  await expect(page.getByText('1 de 10')).toBeVisible();
  await expect(page.getByText('/ʃɪp/')).toBeVisible();
  await expectAccessible(page);

  // 1) «ship», entendida a la primera: sin consejos.
  const tips = page.getByRole('region', { name: 'Consejos' });
  await hear(page, ['ship']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('Se te entiende perfectamente.')).toBeVisible();
  await expect(tips).toHaveCount(0);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 2) «sheep» dicho corto: oye «ship» y da el consejo de esa confusión.
  await expect(page.getByText('/ʃiːp/')).toBeVisible();
  await hear(page, ['ship']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('No lo ha entendido.')).toBeVisible();
  await expect(page.getByText('«ship»', { exact: true })).toBeVisible();
  await expect(tips.getByRole('listitem')).toHaveText([/Ha sonado corta/]);
  await expectAccessible(page);

  // Segundo intento: lo entiende, pero la primera hipótesis sigue siendo la otra palabra.
  await hear(page, ['ship', 'sheep']);
  await page.getByRole('button', { name: 'Otra vez' }).click();
  await expect(page.getByText('Te ha entendido, pero con dudas.')).toBeVisible();
  await expect(tips).toContainText('Ha sonado corta');
  // Tercero: limpio.
  await hear(page, ['sheep']);
  await page.getByRole('button', { name: 'Otra vez' }).click();
  await expect(page.getByText('Se te entiende perfectamente.')).toBeVisible();
  await expect(tips).toHaveCount(0);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 3) Sin hablar: lo dice y deja reintentar.
  await hear(page, 'no-speech');
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText(/No se ha oído nada/)).toBeVisible();

  // Lo demás se salta hasta la última, una frase con una palabra mal.
  for (let step = 3; step < 10; step++) {
    await page.getByRole('button', { name: 'Saltar' }).click();
  }
  await expect(page.getByText('10 de 10')).toBeVisible();
  await expect(page.getByText('Please eat these green beans.')).toBeVisible();
  await hear(page, ['please eat this green beans']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('Casi: ha entendido 4 de 5 palabras.')).toBeVisible();
  await expect(page.getByText('«please eat this green beans»', { exact: true })).toBeVisible();
  // En una frase, el consejo nombra la palabra que ha fallado.
  await expect(tips.getByRole('listitem')).toHaveText([
    'these: La vocal es /iː/, larga y tensa: sonríe y alárgala.',
  ]);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByText('Se te han entendido bien 2 de 10 · nota 28 %')).toBeVisible();
  await expectAccessible(page);

  // Se guarda el progreso y un intento por palabra dicha, sin tocar el nivel estimado.
  expect(
    await queryDatabase(
      request,
      `select lesson_id, status, round(score::numeric, 2)::float as score
       from public.lesson_progress`,
    ),
  ).toEqual([{ lesson_id: 'a1-pro-001', status: 'completed', score: 0.28 }]);
  expect(
    await queryDatabase(
      request,
      `select item_id, skill, round(score::numeric, 2)::float as score,
              response->>'attempts' as attempts
       from public.item_attempts order by item_id`,
    ),
  ).toEqual([
    { item_id: 'a1-pro-001:i1', skill: 'speaking', score: 1, attempts: '1' },
    { item_id: 'a1-pro-001:i10', skill: 'speaking', score: 0.8, attempts: '1' },
    { item_id: 'a1-pro-001:i2', skill: 'speaking', score: 1, attempts: '3' },
  ]);
  expect(
    await queryDatabase(request, `select count(*)::int as n from public.rating_history`),
  ).toEqual([{ n: 0 }]);

  // En la lista aparece como hecho.
  await page.getByRole('link', { name: 'Pronunciación', exact: true }).first().click();
  await page.getByRole('link', { name: 'Todas', exact: true }).click();
  await expect(page.getByRole('link', { name: /Ship or sheep/ })).toContainText('Hecha');

  expect(errors).toEqual([]);
});

test('práctica libre: desde una palabra del mazo o escribiendo', async ({ page }) => {
  const errors = trackErrors(page);
  await fakeRecognition(page);
  await signIn(page);

  // Desde el mazo de palabras se llega con la palabra ya puesta.
  await page.goto('/palabras');
  await page.getByRole('link', { name: 'Practicar la pronunciación de «advice»' }).click();
  await expect(page).toHaveURL(/\/pronunciar\/libre\?texto=advice$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Práctica libre' })).toBeVisible();
  await expect(page.getByLabel('Palabra o frase en inglés')).toHaveValue('advice');
  await hear(page, ['advice']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('Se te entiende perfectamente.')).toBeVisible();

  // Sin ejercicio de por medio, los consejos salen de la palabra y de lo que se oyó en su lugar.
  const tips = page.getByRole('region', { name: 'Consejos' });
  await page.getByLabel('Palabra o frase en inglés').fill('very');
  await page.getByRole('button', { name: 'Practicar' }).click();
  await hear(page, ['berry']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('No lo ha entendido.')).toBeVisible();
  await expect(tips.getByRole('listitem').first()).toContainText('La v no es una «b»');
  await expectAccessible(page);
  await hear(page, ['very']);
  await page.getByRole('button', { name: 'Otra vez' }).click();
  await expect(page.getByText('Se te entiende perfectamente.')).toBeVisible();
  await expect(tips).toHaveCount(0);

  // Una palabra con trampa conocida dice cómo suena de verdad.
  await page.getByLabel('Palabra o frase en inglés').fill('comfortable');
  await page.getByRole('button', { name: 'Practicar' }).click();
  await hear(page, ['come for table']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(tips.getByRole('listitem').first()).toContainText('Tres sílabas, no cuatro');

  // Y se puede escribir cualquier otra cosa; el acento elegido se recuerda.
  await page.getByLabel('Palabra o frase en inglés').fill("I'd like a cup of tea.");
  await page.getByRole('button', { name: 'Practicar' }).click();
  await page.getByText('Americano', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Americano' })).toBeChecked();
  await hear(page, ['I would like a cup of tea']);
  await page.getByRole('button', { name: 'Hablar' }).click();
  await expect(page.getByText('Se te entiende perfectamente.')).toBeVisible();
  await expectAccessible(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Americano' })).toBeChecked();

  expect(errors).toEqual([]);
});

test('sin reconocimiento de voz se explica y se puede seguir escuchando el modelo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, unknown>;
    delete scope.webkitSpeechRecognition;
    delete scope.SpeechRecognition;
  });
  await signIn(page);
  await page.goto('/pronunciar/libre?texto=comfortable');

  await expect(page.getByText(/Este navegador no tiene reconocimiento de voz/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hablar' })).toHaveCount(0);
  await expectAccessible(page);
});

test('un ejercicio de pronunciación que no existe muestra «no encontrada»', async ({ page }) => {
  await signIn(page);
  for (const path of ['/pronunciar/b1-pro-999', '/pronunciar/..%2F..%2Fpackage']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Aquí no hay nada' })).toBeVisible();
  }
});
