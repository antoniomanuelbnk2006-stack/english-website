import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { BASE_LANGUAGE, PREFIXED_LANGUAGES, type PracticeLanguage } from './language';

// Las carpetas del contenido por idioma (ADR-0035). Va aparte de ./language.ts porque mira el
// disco: los esquemas, que también llegan al navegador, solo importan ./language.ts.

/** La carpeta de un idioma dentro de `root`: la raíz para el inglés, `root/<idioma>` para el resto. */
export function languageRoot(root: string, language: PracticeLanguage): string {
  return language === BASE_LANGUAGE ? root : path.join(root, language);
}

/**
 * Los idiomas que se pueden practicar porque tienen contenido (ADR-0036): el inglés, que está en
 * la raíz, y los que ya tienen su carpeta. El inglés primero.
 */
export function languagesWithContent(root: string): PracticeLanguage[] {
  return [
    BASE_LANGUAGE,
    ...PREFIXED_LANGUAGES.filter((language) => existsSync(languageRoot(root, language))),
  ];
}

/**
 * Las carpetas de un tipo de contenido (`lessons`, `grammar`…) que existen, con su idioma: la de
 * inglés y las de los idiomas que ya tienen contenido de ese tipo.
 */
export function contentDirs(
  root: string,
  kind: string,
): { language: PracticeLanguage; dir: string }[] {
  // El inglés primero: el orden del contenido de siempre no cambia.
  const languages: PracticeLanguage[] = [BASE_LANGUAGE, ...PREFIXED_LANGUAGES];
  return languages
    .map((language) => ({ language, dir: path.join(languageRoot(root, language), kind) }))
    .filter(({ dir }) => existsSync(dir));
}

/** Un archivo de contenido organizado por nivel: `<tipo>/<nivel>/<id><extensión>`. */
export interface LevelFile {
  language: PracticeLanguage;
  /** Carpeta del nivel, en minúsculas («a1»). */
  level: string;
  /** Id que da el nombre del archivo, sin la extensión. */
  id: string;
  /** Ruta absoluta. */
  path: string;
}

/**
 * Los archivos de un tipo de contenido organizado por nivel (Use of English, writing,
 * pronunciación, exámenes, gramática), de todos los idiomas: primero el inglés, y en cada uno por
 * nivel y nombre.
 */
export function listLevelFiles(root: string, kind: string, extension: string): LevelFile[] {
  return contentDirs(root, kind).flatMap(({ language, dir }) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .flatMap((level) =>
        readdirSync(path.join(dir, level))
          .filter((name) => name.endsWith(extension))
          .sort()
          .map((name) => ({
            language,
            level,
            id: name.slice(0, -extension.length),
            path: path.join(dir, level, name),
          })),
      ),
  );
}
