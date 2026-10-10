import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DictionaryFile } from '@/lib/content/dictionary-schema';
import { assess } from './assess';
import { buildTips, wordTips } from './tips';

const heard = (...transcripts: string[]) => transcripts.map((transcript) => ({ transcript }));
const ids = (word: string, said = '') => wordTips(word, said).map((tip) => tip.id);
const first = (word: string, said = '') => wordTips(word, said)[0];
/** El consejo de una regla concreta, esté en el puesto que esté. */
const tipOf = (word: string, id: string, said = '') =>
  wordTips(word, said).find((tip) => tip.id === id)?.text_es;

describe('wordTips: por cómo se escribe la palabra', () => {
  it('las palabras con trampa conocida dicen cómo suenan de verdad', () => {
    expect(first('comfortable')?.text_es).toContain('/ˈkʌmftəbl/');
    expect(first('Wednesday')?.id).toBe('known');
    expect(first('island')?.text_es).toContain('La *s* no suena');
  });

  it('avisa de las letras mudas', () => {
    expect(first('knife')?.text_es).toContain('*kn-* se dice /n/');
    expect(first('write')?.text_es).toContain('*wr-* se dice /r/');
    expect(first('climb')?.text_es).toContain('acaba en /m/');
    expect(first('debt')?.text_es).toContain('La *b* no suena');
    expect(first('night')?.text_es).toContain('*gh* no suenan');
    expect(first('laugh')?.text_es).toContain('*gh* suena /f/');
    expect(first('walk')?.text_es).toContain('La *l* no suena');
    expect(first('castle')?.text_es).toContain('La *t* no suena');
    expect(first('hour')?.text_es).toContain('la *h* es muda');
  });

  it('*s* + consonante al principio: sin «e» delante', () => {
    // «school» tiene dos trampas: la «s» inicial y la *ch* que suena /k/.
    expect(ids('school')).toEqual(['s-cluster', 'ch']);
    expect(first('Spain')?.id).toBe('s-cluster');
    expect(ids('sheep')).not.toContain('s-cluster');
    expect(ids('sea')).not.toContain('s-cluster');
  });

  it('el final -ed suena /t/, /d/ o /ɪd/ según lo que haya antes', () => {
    expect(first('worked')?.text_es).toContain('suena /t/');
    expect(tipOf('stopped', 'ed')).toContain('suena /t/');
    expect(first('laughed')?.id).toBe('gh');
    expect(wordTips('laughed')[1]?.text_es).toContain('suena /t/');
    expect(first('played')?.text_es).toContain('suena /d/');
    expect(first('opened')?.text_es).toContain('suena /d/');
    expect(first('wanted')?.text_es).toContain('/ɪd/');
    expect(first('decided')?.text_es).toContain('/ɪd/');
    expect(first('closed')?.text_es).toContain('una /t/ o una /d/');
    // «bed» o «need» no son pasados.
    expect(ids('bed')).not.toContain('ed');
    expect(ids('need')).not.toContain('ed');
    // Y el final sordo de «worked» no se confunde con una consonante sonora.
    expect(ids('worked')).not.toContain('final-voiced');
  });

  it('distingue la th sorda de la sonora', () => {
    expect(first('think')?.text_es).toContain('/θ/');
    expect(first('this')?.text_es).toContain('/ð/');
    expect(first('mother')?.text_es).toContain('/ð/');
  });

  it('otros sonidos que no existen igual en español', () => {
    expect(ids('very')).toContain('v');
    expect(ids('house')).toContain('h');
    expect(first('who')?.text_es).toContain('*wh-* suena /h/');
    expect(ids('job')).toContain('j');
    expect(ids('shoes')).toContain('sh');
    expect(first('chemistry')?.text_es).toContain('*ch* suena /k/');
    expect(first('chef')?.text_es).toContain('«sh»');
    expect(ids('yes')).toContain('y');
    expect(ids('week')).toContain('w');
  });

  it('terminaciones débiles', () => {
    expect(tipOf('station', 'tion')).toContain('/ʃn/');
    expect(first('decision')?.text_es).toContain('*-sion*');
    expect(first('picture')?.text_es).toContain('/tʃə/');
    expect(ids('famous')).toContain('ous');
    expect(ids('possible')).toContain('able');
    // «stable», «enable» o «table» conservan la vocal entera.
    expect(ids('stable')).not.toContain('able');
    expect(ids('enable')).not.toContain('able');
    expect(ids('table')).not.toContain('able');
    expect(ids('teacher')).toContain('schwa-end');
    expect(ids('prefer')).not.toContain('schwa-end');
  });

  it('la vocal /ɜː/ solo donde la ortografía la garantiza', () => {
    for (const word of ['bird', 'girl', 'turn', 'work', 'word', 'world', 'learn', 'heard']) {
      expect(ids(word), word).toContain('er');
    }
    for (const word of ['hair', 'four', 'fire', 'worry', 'worn', 'heart', 'iron']) {
      expect(ids(word), word).not.toContain('er');
    }
  });

  it('la e final muda y los finales con varias consonantes', () => {
    expect(ids('time')).toContain('magic-e');
    expect(ids('home')).toContain('magic-e');
    expect(ids('come')).not.toContain('magic-e');
    expect(ids('have')).not.toContain('magic-e');
    expect(ids('best')).toContain('final-cluster');
    expect(ids('world')).toContain('final-cluster');
    expect(ids('watch')).not.toContain('final-cluster');
    expect(ids('card')).not.toContain('final-cluster');
    expect(ids('bag')).toContain('final-voiced');
    expect(ids('room')).toContain('final-m');
    expect(ids('sing')).toContain('ng');
  });

  it('si no hay nada que decir de la ortografía, da un consejo general', () => {
    expect(wordTips('cat')).toEqual([
      expect.objectContaining({ id: 'generic-word', text_es: expect.stringContaining('Despacio') }),
    ]);
  });

  it('nunca da más de tres, ni dos veces el mismo', () => {
    const tips = wordTips('strengthened');
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(new Set(tips.map((tip) => tip.text_es)).size).toBe(tips.length);
    expect(wordTips('')).toEqual([]);
  });
});

describe('wordTips: por lo que se oyó en su lugar', () => {
  it('una vocal por otra', () => {
    expect(first('ship', 'sheep')?.id).toBe('short-i');
    expect(first('sheep', 'ship')?.id).toBe('ee');
    expect(first('live', 'leave')?.id).toBe('short-i');
    expect(first('this', 'these')?.id).toBe('short-i');
    expect(first('cat', 'cut')?.id).toBe('ae');
    expect(first('cut', 'cat')?.id).toBe('uh');
    expect(first('full', 'fool')?.id).toBe('short-u');
    expect(first('pool', 'pull')?.id).toBe('long-u');
    expect(first('work', 'walk')?.id).toBe('er');
    expect(first('bird', 'bed')?.id).toBe('er');
    // Lo que se oyó va delante de lo que deja prever la ortografía.
    expect(ids('walk', 'work')).toEqual(['aw', 'silent-l', 'w']);
    expect(first('bat', 'boat')?.id).toBe('vowel');
  });

  it('una consonante por otra pone su consejo el primero', () => {
    expect(first('very', 'berry')?.id).toBe('v');
    expect(first('think', 'sink')?.id).toBe('th');
    expect(first('three', 'tree')?.id).toBe('th');
    expect(first('they', 'day')?.text_es).toContain('/ð/');
    expect(first('hair', 'air')?.id).toBe('h');
    expect(first('jet', 'yet')?.id).toBe('j');
    expect(first('yet', 'jet')?.id).toBe('y');
    expect(first('wash', 'watch')?.id).toBe('sh');
    expect(first('watch', 'wash')?.id).toBe('ch');
    expect(first('wood', 'good')?.id).toBe('w');
    expect(first('prize', 'price')?.id).toBe('z');
    expect(first('price', 'prize')?.id).toBe('s-voiceless');
  });

  it('una vocal de más delante de s + consonante', () => {
    expect(first('school', 'a school')?.id).toBe('s-cluster');
    expect(first('stop', 'is top')?.id).toBe('s-cluster');
  });

  it('finales que no se oyen o que suenan sordos o sonoros', () => {
    expect(first('worked', 'work')?.text_es).toContain('suena /t/');
    expect(first('lived', 'live')?.text_es).toContain('suena /d/');
    expect(first('stopped', 'stop')?.id).toBe('ed');
    expect(first('card', 'car')?.id).toBe('final-missing');
    expect(first('bag', 'back')?.id).toBe('final-voiced');
    expect(first('back', 'bag')?.id).toBe('final-voiceless');
    expect(first('bed', 'bet')?.id).toBe('final-voiced');
    expect(first('time', 'tine')?.id).toBe('final-m');
  });

  it('oír lo mismo o no oír nada no señala ninguna regla', () => {
    expect(ids('ship', 'ship')).toEqual(ids('ship'));
    expect(ids('ship', '')).toEqual(ids('ship'));
  });
});

describe('buildTips', () => {
  it('si se ha entendido a la primera no hay consejos', () => {
    expect(buildTips('ship', assess('ship', heard('ship')))).toEqual([]);
  });

  it('una palabra mal dicha recibe hasta tres consejos', () => {
    const tips = buildTips('very', assess('very', heard('berry')));
    expect(tips[0]).toMatchObject({ id: 'v' });
    expect(tips.length).toBeLessThanOrEqual(3);
    expect(tips.every((tip) => tip.word === undefined)).toBe(true);
  });

  it('también cuando la ha entendido con dudas', () => {
    const tips = buildTips('ship', assess('ship', heard('sheep', 'ship')));
    expect(tips[0]).toMatchObject({ id: 'short-i' });
  });

  it('si el ejercicio trae el consejo de esa confusión, basta con ese', () => {
    const confusions = [{ heard: 'sheep', tip_es: 'Hazla muy corta.' }];
    expect(buildTips('ship', assess('ship', heard('sheep'), confusions))).toEqual([
      { id: 'confusion', text_es: 'Hazla muy corta.' },
    ]);
  });

  it('en una frase, un consejo por palabra fallada, con la palabra', () => {
    const tips = buildTips(
      'I think the weather is very cold.',
      assess('I think the weather is very cold.', heard('I sink the weather is berry cold')),
    );
    expect(tips).toEqual([
      expect.objectContaining({ id: 'th', word: 'think' }),
      expect.objectContaining({ id: 'v', word: 'very' }),
    ]);
  });

  it('las palabras gramaticales perdidas dan el consejo de las formas débiles', () => {
    const tips = buildTips(
      'I want to go to the cinema.',
      assess('I want to go to the cinema.', heard('I want go the cinema')),
    );
    expect(tips).toEqual([expect.objectContaining({ id: 'weak-forms' })]);
  });

  it('como mucho tres palabras, y si casi nada se ha entendido, cómo trabajar la frase', () => {
    const target = 'She sells seashells by the seashore.';
    const tips = buildTips(target, assess(target, heard('see')));
    // Solo se miran las tres primeras palabras falladas; el mismo consejo para dos de ellas
    // se da una vez, nombrando las dos.
    expect(tips.filter((tip) => tip.word).map((tip) => [tip.id, tip.word])).toEqual([
      ['sh', 'She, seashells'],
      ['final-cluster', 'sells'],
    ]);
    expect(tips.at(-1)).toMatchObject({ id: 'generic-sentence' });
  });
});

describe('todas las palabras del mazo', () => {
  const dir = path.join(process.cwd(), 'content', 'dictionary');
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];

  it.each(files)('%s: cada palabra tiene entre uno y tres consejos con texto', (file) => {
    const { entries } = DictionaryFile.parse(
      JSON.parse(readFileSync(path.join(dir, file), 'utf8')),
    );
    for (const entry of entries) {
      for (const word of entry.lemma.split(/\s+/)) {
        if (!/[a-z]/i.test(word)) continue;
        const tips = wordTips(word);
        expect(tips.length, entry.lemma).toBeGreaterThanOrEqual(1);
        expect(tips.length, entry.lemma).toBeLessThanOrEqual(3);
        for (const tip of tips) expect(tip.text_es.length, entry.lemma).toBeGreaterThan(15);
      }
    }
  });
});
