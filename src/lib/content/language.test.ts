import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BASE_LANGUAGE,
  DASH_PREFIX,
  DOT_PREFIX,
  PREFIXED_LANGUAGES,
  assertLanguage,
  contentLang,
  inLanguage,
  languageName,
  languageOfId,
  withoutLanguage,
} from './language';
import { contentDirs, languageRoot, languagesWithContent, listLevelFiles } from './language-dirs';

describe('languageOfId', () => {
  it('sin prefijo es inglés, como todo el contenido de hoy', () => {
    expect(languageOfId('a1-rea-001')).toBe('en');
    expect(languageOfId('a1.present-simple')).toBe('en');
    expect(languageOfId('b2-exam-01-reading')).toBe('en');
  });

  it('con prefijo, el idioma del prefijo', () => {
    expect(languageOfId('es-a1-rea-001')).toBe('es');
    expect(languageOfId('es.a1.ser-estar')).toBe('es');
    expect(languageOfId('ja-a1-lis-002')).toBe('ja');
  });

  it('el inglés no lleva prefijo, y los otros cuatro sí', () => {
    expect(BASE_LANGUAGE).toBe('en');
    expect(PREFIXED_LANGUAGES).toEqual(['es', 'fr', 'zh', 'ja']);
    expect(languageOfId('en-a1-rea-001')).toBe('en');
  });
});

describe('el idioma que se practica (ADR-0036)', () => {
  it('se queda solo con lo de un idioma', () => {
    const items = [{ id: 'a1-rea-001' }, { id: 'es-a1-rea-001' }, { id: 'es.a1.ser-estar' }];
    expect(inLanguage(items, 'en')).toEqual([{ id: 'a1-rea-001' }]);
    expect(inLanguage(items, 'es')).toEqual([{ id: 'es-a1-rea-001' }, { id: 'es.a1.ser-estar' }]);
    expect(inLanguage(items, 'ja')).toEqual([]);
  });

  it('cada idioma se llama como en el de la interfaz, con mayúscula', () => {
    expect(languageName('en', 'es')).toBe('Inglés');
    expect(languageName('es', 'es')).toBe('Español');
    expect(languageName('es', 'en')).toBe('Spanish');
    expect(languageName('en', 'fr')).toBe('Anglais');
    expect(languageName('en', 'zh')).toBe('英语');
    expect(languageName('en', 'ja')).toBe('英語');
  });
});

describe('contentLang', () => {
  it('es la etiqueta lang del idioma del contenido, según su id', () => {
    expect(contentLang('a1-rea-001')).toBe('en');
    expect(contentLang('es-a1-wri-001')).toBe('es');
    expect(contentLang('es.a1.ser-estar')).toBe('es');
  });
});

describe('withoutLanguage', () => {
  it('quita el prefijo de idioma y deja igual los de inglés', () => {
    expect(withoutLanguage('es-a1-rea-001')).toBe('a1-rea-001');
    expect(withoutLanguage('es.a1.ser-estar')).toBe('a1.ser-estar');
    expect(withoutLanguage('a1-rea-001')).toBe('a1-rea-001');
  });
});

describe('prefijos para las expresiones regulares de los ids', () => {
  const lesson = new RegExp(`^${DASH_PREFIX}(a1|a2)-rea-\\d{3}$`);
  const grammar = new RegExp(`^${DOT_PREFIX}(a1|a2)\\.[a-z-]+$`);

  it('aceptan el id de siempre y el de cada idioma', () => {
    expect(lesson.test('a1-rea-001')).toBe(true);
    expect(lesson.test('es-a1-rea-001')).toBe(true);
    expect(grammar.test('a1.present-simple')).toBe(true);
    expect(grammar.test('es.a1.ser-estar')).toBe(true);
  });

  it('no aceptan otros idiomas ni prefijos mal puestos', () => {
    expect(lesson.test('de-a1-rea-001')).toBe(false);
    expect(lesson.test('en-a1-rea-001')).toBe(false);
    expect(lesson.test('es.a1-rea-001')).toBe(false);
    expect(grammar.test('es-a1.ser-estar')).toBe(false);
  });
});

describe('carpetas por idioma', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'senal-contenido-'));
  mkdirSync(path.join(root, 'lessons'));
  mkdirSync(path.join(root, 'es', 'lessons'), { recursive: true });
  mkdirSync(path.join(root, 'fr', 'grammar'), { recursive: true });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('el inglés está en la raíz; los demás, en su carpeta', () => {
    expect(languageRoot(root, 'en')).toBe(root);
    expect(languageRoot(root, 'es')).toBe(path.join(root, 'es'));
  });

  it('solo devuelve las carpetas que existen, con su idioma', () => {
    expect(contentDirs(root, 'lessons')).toEqual([
      { language: 'en', dir: path.join(root, 'lessons') },
      { language: 'es', dir: path.join(root, 'es', 'lessons') },
    ]);
    expect(contentDirs(root, 'grammar')).toEqual([
      { language: 'fr', dir: path.join(root, 'fr', 'grammar') },
    ]);
  });

  it('lista los archivos por nivel de todos los idiomas, el inglés primero', () => {
    mkdirSync(path.join(root, 'writing', 'b1'), { recursive: true });
    mkdirSync(path.join(root, 'writing', 'a1'), { recursive: true });
    mkdirSync(path.join(root, 'es', 'writing', 'a1'), { recursive: true });
    writeFileSync(path.join(root, 'writing', 'b1', 'b1-wri-001.json'), '{}');
    writeFileSync(path.join(root, 'writing', 'a1', 'a1-wri-002.json'), '{}');
    writeFileSync(path.join(root, 'writing', 'a1', 'notas.txt'), '');
    writeFileSync(path.join(root, 'es', 'writing', 'a1', 'es-a1-wri-001.json'), '{}');
    expect(
      listLevelFiles(root, 'writing', '.json').map(({ language, level, id }) => [language, level, id]),
    ).toEqual([
      ['en', 'a1', 'a1-wri-002'],
      ['en', 'b1', 'b1-wri-001'],
      ['es', 'a1', 'es-a1-wri-001'],
    ]);
    expect(listLevelFiles(root, 'pronunciation', '.json')).toEqual([]);
  });

  it('se puede practicar el inglés y los idiomas que tienen carpeta', () => {
    expect(languagesWithContent(root)).toEqual(['en', 'es', 'fr']);
    const empty = mkdtempSync(path.join(tmpdir(), 'senal-vacio-'));
    try {
      expect(languagesWithContent(empty)).toEqual(['en']);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('un id tiene que estar en la carpeta de su idioma', () => {
    expect(() => assertLanguage('es-a1-rea-001', 'es', 'x.json')).not.toThrow();
    expect(() => assertLanguage('a1-rea-001', 'es', 'x.json')).toThrow(/carpeta de es/);
    expect(() => assertLanguage('es-a1-rea-001', 'en', 'x.json')).toThrow(/es de es/);
  });
});
