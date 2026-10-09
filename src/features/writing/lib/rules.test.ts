import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyRule, applySuggestions, findHints } from './checks';
import { ing, RULES, thirdPerson } from './rules';

const CONTENT = path.join(process.cwd(), 'content');

describe('cada regla, con sus ejemplos', () => {
  it('los ids son únicos y todas tienen ejemplos de las dos clases', () => {
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length);
    for (const rule of RULES) {
      expect(rule.examples.bad.length, rule.id).toBeGreaterThan(0);
      expect(rule.examples.good.length, rule.id).toBeGreaterThan(0);
      expect(rule.pattern.global, `${rule.id}: el patrón debe ser global`).toBe(true);
    }
  });

  for (const rule of RULES) {
    describe(rule.id, () => {
      it.each(rule.examples.bad)('marca «%s»', (text) => {
        const hints = applyRule(rule, text);
        expect(hints.length).toBeGreaterThan(0);
        // La propuesta, una vez aplicada, deja de ser un problema para esa misma regla.
        if (hints.every((hint) => hint.suggestion !== null)) {
          expect(applyRule(rule, applySuggestions(text, hints))).toEqual([]);
        }
      });

      it.each(rule.examples.good)('no marca «%s»', (text) => {
        expect(applyRule(rule, text)).toEqual([]);
      });
    });
  }

  it('las fichas de gramática a las que remiten existen', () => {
    const refs = new Set(RULES.flatMap((rule) => (rule.grammar_ref ? [rule.grammar_ref] : [])));
    for (const ref of refs) {
      const level = ref.split('.')[0] ?? '';
      expect(existsSync(path.join(CONTENT, 'grammar', level, `${ref}.mdx`)), ref).toBe(true);
    }
  });
});

describe('las propuestas son la corrección que daría un profesor', () => {
  const fix = (text: string, formal = false) => applySuggestions(text, findHints(text, { formal }));

  it.each([
    ['I am agree with you.', 'I agree with you.'],
    ["I'm not agree with that idea.", 'I do not agree with that idea.'],
    ['She is totally agree.', 'She totally agrees.'],
    ['You must to study more.', 'You must study more.'],
    ['I would like to can speak English.', 'I would like to be able to speak English.'],
    ['I look forward to hear from you.', 'I look forward to hearing from you.'],
    ['Can you explain me the rules?', 'Can you explain to me the rules?'],
    ['He said me that he was tired.', 'He told me that he was tired.'],
    ["I didn't went to school.", "I didn't go to school."],
    ["He doesn't likes coffee.", "He doesn't like coffee."],
    ['Does she works here?', 'Does she work here?'],
    ['I wanted to went with them.', 'I wanted to go with them.'],
    ['My brother is a nurse. He work at night.', 'My brother is a nurse. He works at night.'],
    ['She have two cats.', 'She has two cats.'],
    ['People is very friendly here.', 'People are very friendly here.'],
    ['People who lives in cities walk less.', 'People who live in cities walk less.'],
    ['Everybody are happy.', 'Everybody is happy.'],
    ['I need more informations.', 'I need more information.'],
    ['Can I give you an advice?', 'Can I give you some advice?'],
    ['There are too much people.', 'There are too many people.'],
    ['This phone is more better.', 'This phone is better.'],
    ['It is more easy than I thought.', 'It is easier than I thought.'],
    ['The most of people prefer the beach.', 'Most people prefer the beach.'],
    ['I have 20 years.', 'I am 20 years old.'],
    ['My sister has fifteen years old.', 'My sister is fifteen years old.'],
    ['I have lived here since three years.', 'I have lived here for three years.'],
    ['I have seen that film yesterday.', 'I saw that film yesterday.'],
    ['She has visited Rome two years ago.', 'She visited Rome two years ago.'],
    ["I've been there last year.", 'I was there last year.'],
    ['We have already finished it last week.', 'We already finished it last week.'],
    ['If I will have time, I will call you.', 'If I have time, I will call you.'],
    ['If it will rain, we will stay at home.', 'If it rains, we will stay at home.'],
    ["If he won't come, we will go alone.", "If he doesn't come, we will go alone."],
    ['Where you live?', 'Where do you live?'],
    ['What you are doing this weekend?', 'What are you doing this weekend?'],
    ['Why she left so early?', 'Why did she leave so early?'],
    ['What we do now?', 'What do we do now?'],
    ['What he wants?', 'What does he want?'],
    ['We visited differents places.', 'We visited different places.'],
    ['I like meeting others people.', 'I like meeting other people.'],
    ['I go running every days.', 'I go running every day.'],
    ['Each cities has a museum.', 'Each city has a museum.'],
    ['There is many shops in my town.', 'There are many shops in my town.'],
    ['There are a park near my house.', 'There is a park near my house.'],
    ["I don't know nothing about it.", "I don't know anything about it."],
    ['I am boring at home.', 'I am bored at home.'],
    ['The flat is not enough big.', 'The flat is not big enough.'],
    ['It depends of the weather.', 'It depends on the weather.'],
    ['We arrived to the hotel at night.', 'We arrived at the hotel at night.'],
    ['She arrived to London on Monday.', 'She arrived in London on Monday.'],
    ['My sister is married with a Frenchman.', 'My sister is married to a Frenchman.'],
    ['See you in Monday.', 'See you on Monday.'],
    ['My birthday is on July.', 'My birthday is in July.'],
    ['I am good in maths.', 'I am good at maths.'],
    ['We discussed about the problem.', 'We discussed the problem.'],
    ['I listen music every day.', 'I listen to music every day.'],
    ['Please wait me at the door.', 'Please wait for me at the door.'],
    ['I went there for to study.', 'I went there to study.'],
    ['I use the app for learn English.', 'I use the app to learn English.'],
    ['Thank you for invite me.', 'Thank you for inviting me.'],
    ['I walk instead of take the bus.', 'I walk instead of taking the bus.'],
    ['I enjoy to read at night.', 'I enjoy reading at night.'],
    ['Despite of the rain, we went out.', 'Despite the rain, we went out.'],
    ['In the other hand, it is expensive.', 'On the other hand, it is expensive.'],
    ['According to me, it is a mistake.', 'In my opinion, it is a mistake.'],
    ['My mother is teacher.', 'My mother is a teacher.'],
    ['I am engineer.', 'I am an engineer.'],
    ['The life is hard in a big city.', 'Life is hard in a big city.'],
    ['I ate a apple.', 'I ate an apple.'],
    ['I bought an car.', 'I bought a car.'],
    ['We made photos of the castle.', 'We took photos of the castle.'],
    ['Can I make a question?', 'Can I ask a question?'],
    ['I make sport twice a week.', 'I do sport twice a week.'],
    ['We made a party for her.', 'We had a party for her.'],
    ['I did a mistake in the exam.', 'I made a mistake in the exam.'],
    ['He always says the truth.', 'He always tells the truth.'],
    ['I want to know new people.', 'I want to meet new people.'],
    ['I lost the bus this morning.', 'I missed the bus this morning.'],
    ['I assisted to a conference in Madrid.', 'I attended a conference in Madrid.'],
    ['I finished my career in 2020.', 'I finished my degree in 2020.'],
    ['My brother is older then me.', 'My brother is older than me.'],
    ['I like it becouse it is confortable.', 'I like it because it is comfortable.'],
    ['Becouse of that, I left.', 'Because of that, I left.'],
    ['Yesterday i went to the gym.', 'Yesterday I went to the gym.'],
    ["i'm from spain.", "I'm from Spain."],
    ['I study english on monday.', 'I study English on Monday.'],
    ['I like it. it is cheap.', 'I like it. It is cheap.'],
    ['I like tea , coffee and juice .', 'I like tea, coffee and juice.'],
    ['I like tea,coffee and juice.', 'I like tea, coffee and juice.'],
    ['I went to the the shop.', 'I went to the shop.'],
  ])('«%s» → «%s»', (text, expected) => {
    expect(fix(text)).toBe(expected);
  });

  it.each([
    ["Many people don't recycle.", 'Many people do not recycle.'],
    ["It's a serious problem.", 'It is a serious problem.'],
    ['Kids spend too much time online.', 'Children spend too much time online.'],
    ['It is cheap. But it is slow.', 'It is cheap. However, it is slow.'],
    ['This is a terrible idea!', 'This is a terrible idea.'],
  ])('en un texto formal, «%s» → «%s»', (text, expected) => {
    expect(fix(text, true)).toBe(expected);
  });

  it('las reglas de registro no se aplican a un texto informal', () => {
    expect(findHints("Hi Tom! I don't know, but the kids love it!", { formal: false })).toEqual([]);
  });
});

describe('findHints', () => {
  it('da la posición exacta del tramo marcado', () => {
    const text = 'I think it depends of the weather.';
    const [hint] = findHints(text, { formal: false });
    expect(hint).toMatchObject({
      rule: 'depend-of',
      match: 'depends of',
      suggestion: 'depends on',
    });
    expect(text.slice(hint!.start, hint!.end)).toBe('depends of');
  });

  it('marca solo las palabras que cambian cuando la regla mira más contexto', () => {
    const text = "I don't know nothing.";
    const [hint] = findHints(text, { formal: false });
    expect(hint).toMatchObject({ match: 'nothing', suggestion: 'anything' });
  });

  it('no repite una misma regla más de tres veces', () => {
    const text = 'becouse becuase beacuse becose bacause';
    expect(findHints(text.replace(/ /g, '. '), { formal: false })).toHaveLength(3);
  });

  it('si dos reglas marcan el mismo sitio, se queda una', () => {
    const hints = findHints('i am agree.', { formal: false });
    const starts = hints.map((hint) => hint.start);
    expect(new Set(starts).size).toBe(starts.length);
    for (let index = 1; index < hints.length; index++) {
      expect(hints[index]!.start).toBeGreaterThanOrEqual(hints[index - 1]!.end);
    }
  });

  it('los avisos sin propuesta y los fallos mecánicos no dan tarjeta', () => {
    const hints = findHints('Actually i want that you come.', { formal: false });
    expect(hints.map((hint) => [hint.rule, hint.card])).toEqual([
      ['actually', false],
      ['lowercase-i', false],
      ['want-that', false],
    ]);
  });

  it('un texto vacío no da nada', () => {
    expect(findHints('', { formal: true })).toEqual([]);
  });
});

describe('formas verbales', () => {
  it.each([
    ['go', 'going'],
    ['make', 'making'],
    ['get', 'getting'],
    ['see', 'seeing'],
    ['be', 'being'],
    ['die', 'dying'],
    ['visit', 'visiting'],
  ])('-ing de %s', (verb, expected) => expect(ing(verb)).toBe(expected));

  it.each([
    ['go', 'goes'],
    ['have', 'has'],
    ['study', 'studies'],
    ['play', 'plays'],
    ['watch', 'watches'],
    ['rain', 'rains'],
  ])('tercera persona de %s', (verb, expected) => expect(thirdPerson(verb)).toBe(expected));
});

// El contenido publicado es inglés correcto: si una regla marca algo ahí, la regla está mal.
describe('no marca errores en el inglés correcto del contenido', () => {
  interface Lesson {
    id: string;
    paragraphs?: { sentences: { text: string }[] }[];
    segments?: { text: string }[];
  }

  const lessons: Lesson[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) {
        lessons.push(JSON.parse(readFileSync(full, 'utf8')) as Lesson);
      }
    }
  };
  walk(path.join(CONTENT, 'lessons'));

  it('hay lecciones que comprobar', () => {
    expect(lessons.length).toBeGreaterThan(5);
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))('%s', (_id, lesson) => {
    // Cada frase por separado: en un diálogo, una intervención no continúa la anterior.
    const sentences = [
      ...(lesson.paragraphs ?? []).flatMap((p) => p.sentences.map((sentence) => sentence.text)),
      ...(lesson.segments ?? []).map((segment) => segment.text),
    ];
    const hints = sentences.flatMap((sentence) =>
      findHints(sentence, { formal: false })
        .filter((hint) => hint.severity !== 'check')
        .map((hint) => `${hint.rule}: «${hint.match}» en «${sentence}»`),
    );
    expect(hints).toEqual([]);
  });
});
