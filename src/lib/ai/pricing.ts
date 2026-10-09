// Precios de referencia por millón de tokens, en dólares (docs/04-arquitectura/06-ia.md §5).
// Si cambian, se actualizan aquí: de esta tabla sale el `cost_usd` de cada llamada y, con él,
// el tope de gasto mensual.

interface Price {
  input: number;
  output: number;
}

const PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Escribir en caché cuesta algo más que la entrada normal; leer de ella, una fracción. */
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Precio de un modelo. Los ids con fecha (`claude-sonnet-5-5-20261001`) valen por su familia. */
export function priceOf(model: string): Price {
  const known = Object.keys(PRICES).find((id) => model === id || model.startsWith(`${id}-`));
  if (known && PRICES[known]) return PRICES[known];
  // Un modelo que no está en la tabla se cobra como el más caro: el tope de gasto debe pecar
  // de prudente, no de optimista.
  return Object.values(PRICES).reduce((top, price) => (price.output > top.output ? price : top));
}

/** Coste de una llamada, en dólares, con cinco decimales (como `writing_submissions.cost_usd`). */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = priceOf(model);
  const input =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) * CACHE_WRITE +
    (usage.cache_read_input_tokens ?? 0) * CACHE_READ;
  const dollars = (input * price.input + usage.output_tokens * price.output) / 1_000_000;
  return Math.round(dollars * 100_000) / 100_000;
}
