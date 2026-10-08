import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Fase 3 sobre la lección de escucha: glosario con audio en la transcripción, cosecha de los
// fallos del dictado como tarjetas de audio y su repaso con valoración sugerida.

const LESSON = 'b1-lis-001';

interface Segment {
  id: string;
  text: string;
  start: number;
  end: number;
}
const lesson = JSON.parse(
  readFileSync(
    path.join(process.cwd(), '.e2e/content/lessons/b1/listening', `${LESSON}.json`),
    'utf8',
  ),
) as { segments: Segment[]; audio: { src: string } };
const segment = (id: string) => lesson.segments.find((s) => s.id === id) as Segment;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function dictate(page: Page, text: string, next: string) {
  await page.getByLabel('Lo que oyes').fill(text);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByText(/Precisión: \d+ %|Señal limpia/)).toBeVisible();
  await page.getByRole('button', { name: next, exact: true }).click();
}

test('los fallos del dictado se cosechan como tarjetas de audio y se repasan escribiendo', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await signIn(page);
  // La lección, hecha hasta las dos escuchas: se retoma en el dictado.
  await queryDatabase(
    request,
    `insert into public.lesson_progress (user_id, lesson_id, status, phase)
     select id, $1, 'started', 3 from auth.users`,
    [LESSON],
  );
  await page.goto(`/escuchar/${LESSON}`);

  // Dictado: dos frases falladas y una perfecta.
  await expect(page.getByText('Frase 1 de 3')).toBeVisible();
  await dictate(
    page,
    'hmm ok thats not so bad how many meteors we going see like hundreds',
    'Siguiente',
  );
  await dictate(
    page,
    'It takes about 20 minutes for your eyes to get used to the dark',
    'Siguiente',
  );
  await dictate(page, "perfect I'll pick you up at 10:30", 'Continuar');

  // Transcripción: cada palabra abre su glosario y se puede oír en su contexto.
  await expect(page.getByText(/Toca una palabra para ver su glosario/)).toBeVisible();
  await page
    .locator('[data-word]')
    .filter({ hasText: /^forecast$/ })
    .first()
    .click();
  const popover = page.getByRole('dialog', { name: 'Glosario: forecast' });
  await expect(popover).toContainText('previsión (del tiempo)');
  await expect(popover).toContainText('B1');
  await expectAccessible(page);
  const playerRegion = page.getByRole('region', { name: 'Reproductor' });
  await popover.getByRole('button', { name: 'Oír la palabra' }).click();
  // La palabra suena y el audio se detiene solo al acabar.
  await expect(playerRegion.getByRole('button', { name: 'Reproducir' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(playerRegion.getByRole('slider')).not.toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.press('Escape');
  // El karaoke sigue funcionando con las palabras convertidas en botones.
  await page.getByRole('button', { name: 'Escuchar esta frase (1)' }).click();
  await expect(page.locator('[data-word][data-w][data-active]')).toHaveCount(1, {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Entrenamiento y escucha final.
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver el resultado' }).click();

  // Cosecha: primero las dos frases falladas, como tarjetas de audio.
  const harvest = page.getByRole('region', { name: 'Cosecha' });
  const items = harvest.getByRole('listitem');
  await expect(items.nth(0)).toContainText('Frase para entrenar el oído');
  await expect(items.nth(0)).toContainText(segment('s16').text);
  await expect(items.nth(0)).toContainText('Fallo de dictado');
  await expect(items.nth(1)).toContainText(segment('s28').text);
  // La palabra consultada va justo después; el límite en escucha es de 5.
  await expect(items.nth(2)).toContainText('forecast');
  await expect(items.nth(2)).toContainText('La consultaste');
  await expect(harvest.getByRole('checkbox', { checked: true })).toHaveCount(5);
  await expectAccessible(page);
  await harvest.getByRole('button', { name: 'Añadir 5 al repaso' }).click();
  await expect(harvest.getByText('5 tarjetas añadidas al repaso.')).toBeVisible();

  // Las tarjetas de audio llevan el tramo exacto del segmento y, detrás, su texto y sus rasgos.
  const audioCards = await queryDatabase<{
    source_segment_id: string;
    front: { clip: { src: string; start: number; end: number } };
    back: { text: string; features: { type: string }[] };
  }>(
    request,
    `select source_segment_id, front, back from public.srs_cards
     where kind = 'audio' order by source_segment_id`,
  );
  expect(audioCards).toHaveLength(2);
  for (const [index, id] of ['s16', 's28'].entries()) {
    const card = audioCards[index];
    expect(card?.source_segment_id).toBe(`${LESSON}:${id}`);
    expect(card?.front).toEqual({
      clip: { src: lesson.audio.src, start: segment(id).start, end: segment(id).end },
    });
    expect(card?.back.text).toBe(segment(id).text);
    // El anverso no deja ver el texto.
    expect(JSON.stringify(card?.front)).not.toContain('meteors');
  }
  expect(audioCards[0]?.back.features.map((f) => f.type)).toContain('reduction');

  // Fallar palabras en el dictado rompe su racha de «vista sin consultar».
  await expect
    .poll(() =>
      queryDatabase(request, `select status, source from public.lexicon where lemma = 'forecast'`),
    )
    .toEqual([{ status: 'learning', source: 'srs' }]);

  // Repaso: las tarjetas salen barajadas; se atiende cada una según su tipo.
  await harvest.getByRole('link', { name: 'Ir al repaso' }).click();
  await expect(page.getByText('0 de 5')).toBeVisible();
  const rating = page.getByRole('group', { name: 'Valora cómo te ha ido' });
  let audioSeen = 0;

  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`${i} de 5`)).toBeVisible();
    const isAudio = (await page.getByLabel('Lo que oyes').count()) > 0;
    if (!isAudio) {
      await page.getByRole('button', { name: 'Mostrar' }).click();
      await rating.getByRole('button', { name: /Fácil/ }).click();
      continue;
    }

    audioSeen++;
    // No se ve el texto antes de responder.
    await expect(page.getByText('pick you up')).toHaveCount(0);
    await expect(page.getByText('meteors')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reproducir' }).click();

    if (audioSeen === 1) {
      // Escrita perfecta y deprisa: se sugiere «Fácil» (o «Bien» si se tardó).
      await expectAccessible(page);
      const texts = [segment('s16').text, segment('s28').text];
      // No se sabe cuál de las dos es: se prueba con una y se mira la precisión.
      await page.getByLabel('Lo que oyes').fill(texts[0] ?? '');
      await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
      const perfect = (await page.getByText('Precisión: 100 %').count()) > 0;
      const suggested = rating.getByRole('button', { name: /sugerida/ });
      await expect(suggested).toHaveCount(1);
      await expect(suggested).toBeFocused();
      if (perfect) await expect(suggested).toContainText(/Fácil|Bien/);
      else await expect(suggested).toContainText('Otra vez');
      await expectAccessible(page);
      // La valoración sugerida se puede cambiar: aquí se elige siempre «Fácil».
      await rating.getByRole('button', { name: /Fácil/ }).click();
    } else {
      // Sin escribir nada: «No lo sé» enseña la frase y sugiere «Otra vez».
      await page.getByRole('button', { name: 'No lo sé' }).click();
      await expect(rating.getByRole('button', { name: /sugerida/ })).toContainText('Otra vez');
      await rating.getByRole('button', { name: /Fácil/ }).click();
    }
  }
  expect(audioSeen).toBe(2);
  await expect(page.getByRole('heading', { name: 'Sesión terminada' })).toBeVisible();

  await expect
    .poll(async () => {
      const [row] = await queryDatabase<{ n: number }>(
        request,
        'select count(*)::int as n from public.srs_reviews where rating = 4',
      );
      return row?.n;
    })
    .toBe(5);

  expect(errors).toEqual([]);
});
