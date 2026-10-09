// Doble de la API de Claude para los tests e2e. Lo sirve el emulador en /anthropic, y la app
// de los tests apunta ahí con ANTHROPIC_BASE_URL: el SDK real hace peticiones HTTP reales,
// pero ninguna sale de esta máquina ni cuesta dinero.
//
// Cada test decide cómo contesta (bien, con un rechazo, cortado por max_tokens o con un error
// HTTP) y puede mirar qué le ha llegado.
import type { IncomingMessage } from 'node:http';

export type StubMode = 'ok' | 'refusal' | 'max_tokens' | 'http_error';

interface Recorded {
  apiKey: string | undefined;
  body: unknown;
}

interface Reply {
  status: number;
  json?: unknown;
}

const USAGE = {
  input_tokens: 2500,
  output_tokens: 2000,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

/** Una corrección neutra, para cuando el test no ha dicho qué quiere recibir. */
function defaultFeedback(text: string) {
  return {
    overall_es: 'El texto se entiende bien.',
    estimated_level: 'B1',
    scores: { content: 3, communicative_achievement: 3, organisation: 3, language: 3 },
    corrections: [],
    corrected_text: text,
    upgrades: [],
    focus_next_es: 'Los conectores.',
    srs_candidates: [],
  };
}

function learnerText(body: unknown): string {
  const messages = (body as { messages?: { content?: unknown }[] }).messages ?? [];
  const content = String(messages[0]?.content ?? '');
  return /<learner_text>\n([\s\S]*)\n<\/learner_text>/.exec(content)?.[1] ?? '';
}

export function createAnthropicStub() {
  let mode: StubMode = 'ok';
  let feedback: unknown = null;
  let requests: Recorded[] = [];

  const message = (body: unknown, over: Record<string, unknown>) => ({
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model: (body as { model?: string }).model ?? 'stub',
    stop_sequence: null,
    usage: USAGE,
    ...over,
  });

  return {
    reset(): void {
      mode = 'ok';
      feedback = null;
      requests = [];
    },

    /** `POST /anthropic/v1/messages` */
    messages(req: IncomingMessage, body: unknown): Reply {
      const apiKey = req.headers['x-api-key'];
      requests.push({ apiKey: Array.isArray(apiKey) ? apiKey[0] : apiKey, body });

      if (mode === 'http_error') {
        return {
          status: 500,
          json: { type: 'error', error: { type: 'api_error', message: 'doble: error interno' } },
        };
      }
      if (mode === 'refusal') {
        return { status: 200, json: message(body, { content: [], stop_reason: 'refusal' }) };
      }
      const text = JSON.stringify(feedback ?? defaultFeedback(learnerText(body)));
      if (mode === 'max_tokens') {
        return {
          status: 200,
          json: message(body, {
            content: [{ type: 'text', text: text.slice(0, 60) }],
            stop_reason: 'max_tokens',
            usage: { ...USAGE, output_tokens: 8000 },
          }),
        };
      }
      return {
        status: 200,
        json: message(body, { content: [{ type: 'text', text }], stop_reason: 'end_turn' }),
      };
    },

    /** `/__test/ai`: con POST se configura la siguiente respuesta; con GET se ve lo recibido. */
    control(method: string | undefined, body: Record<string, unknown>): Reply {
      if (method === 'POST') {
        mode = (body.mode as StubMode | undefined) ?? 'ok';
        feedback = body.feedback ?? null;
        requests = [];
      }
      return { status: 200, json: { mode, requests } };
    },
  };
}
