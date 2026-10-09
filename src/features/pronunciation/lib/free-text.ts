// Texto de la práctica libre: lo escribe el usuario o llega en la URL desde el mazo de palabras.

export const FREE_TEXT_MAX = 120;

/** Una sola línea, sin espacios de más, sin nada que no sea texto y con tope de longitud. */
export function cleanFreeText(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FREE_TEXT_MAX);
}
