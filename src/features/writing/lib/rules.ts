// Reglas de la revisión automática de un writing: errores típicos de hispanohablantes
// (docs/01-pedagogia/09-errores-hispanohablantes.md §5–6) y de escritura (mayúsculas,
// ortografía, registro). Son patrones, no un corrector: se prefiere callar a marcar algo
// correcto. Cada regla lleva ejemplos que los tests comprueban uno a uno.

export const CORRECTION_TYPES = [
  'grammar',
  'vocabulary',
  'spelling',
  'punctuation',
  'word_order',
  'register',
  'collocation',
  'false_friend',
  'cohesion',
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export interface RuleContext {
  /** Texto anterior a la coincidencia. */
  before: string;
  /** Texto posterior a la coincidencia. */
  after: string;
}

export interface Found {
  /** Sustitución propuesta para el tramo marcado; `null` si solo es un aviso. */
  suggestion: string | null;
  /** Tramo marcado dentro de la coincidencia (por defecto, toda). */
  start?: number;
  end?: number;
}

export interface Rule {
  id: string;
  type: CorrectionType;
  /** `check` = puede ser correcto: se enseña como «compruébalo», no como error. */
  severity: 'major' | 'minor' | 'check';
  pattern: RegExp;
  /** Decide si la coincidencia es un problema y qué proponer. `null` = no marcar. */
  find: (match: RegExpExecArray, context: RuleContext) => Found | null;
  explanation_es: string;
  /** Ficha de gramática relacionada, si la hay. */
  grammar_ref?: string;
  /** Solo en textos formales (ensayo, informe, propuesta). */
  formalOnly?: boolean;
  /** `false` si el fallo no da para una tarjeta de repaso (mayúsculas, espacios…). */
  card?: boolean;
  examples: { bad: string[]; good: string[] };
}

// ───────────── Utilidades ─────────────

/** Sustituye toda la coincidencia por una plantilla con `$1`, `$2`… */
const sub =
  (template: string) =>
  (match: RegExpExecArray): Found => ({
    suggestion: template.replace(/\$(\d)/g, (_, n: string) => match[Number(n)] ?? ''),
  });

const note = (): Found => ({ suggestion: null });

const lastWord = (text: string): string => /([\w'’]+)\W*$/.exec(text)?.[1]?.toLowerCase() ?? '';
const nextWord = (text: string): string => /^\W*([\w'’]+)/.exec(text)?.[1]?.toLowerCase() ?? '';
/** Las últimas `n` palabras anteriores, en minúsculas. */
const wordsBefore = (text: string, n: number): string[] =>
  (text.toLowerCase().match(/[\w'’]+/g) ?? []).slice(-n);

const DOUBLING = new Set([
  'get',
  'run',
  'swim',
  'sit',
  'put',
  'stop',
  'plan',
  'shop',
  'begin',
  'forget',
  'chat',
  'cut',
  'win',
  'set',
  'let',
  'hit',
  'jog',
  'skip',
  'travel',
]);

/** Forma en -ing de un verbo regular en su ortografía. */
export function ing(verb: string): string {
  const v = verb.toLowerCase();
  if (v === 'be') return 'being';
  if (DOUBLING.has(v)) return `${v}${v.at(-1)}ing`;
  if (v.endsWith('ie')) return `${v.slice(0, -2)}ying`;
  if (v.endsWith('e') && !/(ee|ye|oe)$/.test(v)) return `${v.slice(0, -1)}ing`;
  return `${v}ing`;
}

/** Tercera persona del presente. */
export function thirdPerson(verb: string): string {
  const v = verb.toLowerCase();
  if (v === 'have') return 'has';
  if (v === 'be') return 'is';
  if (/(s|sh|ch|x|z|o)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

const BASE_OF_PAST: Record<string, string> = {
  went: 'go',
  saw: 'see',
  came: 'come',
  had: 'have',
  did: 'do',
  made: 'make',
  took: 'take',
  got: 'get',
  gave: 'give',
  said: 'say',
  told: 'tell',
  knew: 'know',
  thought: 'think',
  found: 'find',
  left: 'leave',
  felt: 'feel',
  bought: 'buy',
  ate: 'eat',
  wrote: 'write',
  liked: 'like',
  wanted: 'want',
  worked: 'work',
  lived: 'live',
  played: 'play',
};

const BASE_OF_THIRD: Record<string, string> = { has: 'have', goes: 'go', does: 'do' };
const baseOfThird = (verb: string) =>
  BASE_OF_THIRD[verb.toLowerCase()] ?? verb.toLowerCase().replace(/s$/, '');

const PAST_OF_PARTICIPLE: Record<string, string> = {
  seen: 'saw',
  been: 'was',
  gone: 'went',
  done: 'did',
  eaten: 'ate',
  taken: 'took',
  written: 'wrote',
  given: 'gave',
  known: 'knew',
  spoken: 'spoke',
  broken: 'broke',
  chosen: 'chose',
  driven: 'drove',
  forgotten: 'forgot',
  begun: 'began',
  drunk: 'drank',
  swum: 'swam',
  come: 'came',
  become: 'became',
  run: 'ran',
  bought: 'bought',
  had: 'had',
  made: 'made',
  met: 'met',
  found: 'found',
  told: 'told',
  said: 'said',
  left: 'left',
  felt: 'felt',
  lost: 'lost',
  read: 'read',
  heard: 'heard',
  sent: 'sent',
  spent: 'spent',
  got: 'got',
  won: 'won',
  thought: 'thought',
  caught: 'caught',
  taught: 'taught',
  brought: 'brought',
  paid: 'paid',
  slept: 'slept',
  kept: 'kept',
};

/** Pasado simple de un participio, si se puede saber sin dudas. */
function pastOfParticiple(participle: string): string | null {
  const p = participle.toLowerCase();
  if (PAST_OF_PARTICIPLE[p]) return PAST_OF_PARTICIPLE[p];
  return /[a-z]{2,}ed$/.test(p) ? p : null;
}

/** Verbos de decir y pensar: tras ellos, «that» abre otra oración con su propio tiempo. */
const REPORTING =
  /^(heard|said|told|read|learned|learnt|known|thought|believed|noticed|found|discovered|realised|realized|mentioned|explained|shown|decided|agreed|forgotten|remembered|understood|written|reported|announced|confirmed|suggested|claimed|admitted|promised|felt|noted|argued|stated|proved|proven)$/i;

/**
 * Lo que precede a «people» cuando no es el sujeto: un gerundio o una preposición, con
 * algún determinante o adjetivo por medio («with other young people»).
 */
const OBJECT_OF_SOMETHING =
  /(?:\b\w+ing|\b(?:of|with|for|to|about|by|between|among|on|at|from|than|in))\s+(?:(?:other|young|old|older|younger|many|some|most|these|those|the|more|all|few|local|real|ordinary|normal|new|different|certain|such|rich|poor|several|enough)\s+){0,2}$/i;

/** Palabras acabadas en -s que no son un plural. */
const SINGULAR_IN_S =
  /(ss|us|is|ous)$|^(bus|gas|lens|series|species|news|christmas|canvas|atlas|chaos|yes|plus|this|less|was|has|perhaps|always|sometimes|its|his|hers|ours|theirs|as|towards|besides|afterwards|maths|physics|politics|economics)$/;

const conj = (forms: Record<string, string>, verb: string, fallback: string): string =>
  forms[verb.toLowerCase()] ?? fallback;

/** Palabras tras las que un nombre en plural es de verdad un plural, no parte de un compuesto. */
const FUNCTION_WORD =
  /^(in|on|at|for|of|to|near|here|there|that|who|which|and|but|or|because|so|with|from|by|about|around|when|where|if|as|too|now|today|yet|already|every|each|per|like|than|outside|inside|nearby|available|left|open|is|are|was|were|will|can|have|has)$/;

/** ¿Sigue otra palabra de contenido (un nombre, casi siempre) justo detrás, sin puntuación? */
function nounFollows(after: string): boolean {
  const next = /^[ \t]+([a-z]+)/i.exec(after)?.[1]?.toLowerCase();
  return next !== undefined && !FUNCTION_WORD.test(next);
}

const PLURAL_NOUN = /^(people|men|women|children|[a-z]+s)$/;

const NUMBER_WORD =
  '(?:\\d{1,3}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:-\\w+)?|thirty(?:-\\w+)?|forty(?:-\\w+)?|fifty(?:-\\w+)?|sixty(?:-\\w+)?)';

const MONTH =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

/** Arranque de frase: principio del texto, de línea o después de un punto. */
const START = '(?:^|(?<=[.!?]\\s+)|(?<=\\n\\s*))';

// ───────────── Ortografía ─────────────

const SPELLING: Record<string, string> = {
  becouse: 'because',
  becuase: 'because',
  beacuse: 'because',
  becose: 'because',
  bacause: 'because',
  wich: 'which',
  writting: 'writing',
  writen: 'written',
  comming: 'coming',
  studing: 'studying',
  begining: 'beginning',
  confortable: 'comfortable',
  responsable: 'responsible',
  responsability: 'responsibility',
  inmediately: 'immediately',
  inmediate: 'immediate',
  posible: 'possible',
  imposible: 'impossible',
  posibility: 'possibility',
  diferent: 'different',
  diference: 'difference',
  necesary: 'necessary',
  neccessary: 'necessary',
  goverment: 'government',
  enviroment: 'environment',
  enviromental: 'environmental',
  tecnology: 'technology',
  tecnologies: 'technologies',
  profesional: 'professional',
  adress: 'address',
  recomend: 'recommend',
  recomendation: 'recommendation',
  oportunity: 'opportunity',
  oportunities: 'opportunities',
  tipical: 'typical',
  sistem: 'system',
  exemple: 'example',
  untill: 'until',
  tomorow: 'tomorrow',
  tommorow: 'tomorrow',
  tommorrow: 'tomorrow',
  recieve: 'receive',
  recieved: 'received',
  beleive: 'believe',
  belive: 'believe',
  freind: 'friend',
  freinds: 'friends',
  definately: 'definitely',
  definitly: 'definitely',
  accomodation: 'accommodation',
  acommodation: 'accommodation',
  succesful: 'successful',
  sucessful: 'successful',
  succesfull: 'successful',
  successfull: 'successful',
  beatiful: 'beautiful',
  beautifull: 'beautiful',
  usefull: 'useful',
  carefull: 'careful',
  wonderfull: 'wonderful',
  helpfull: 'helpful',
  realy: 'really',
  finaly: 'finally',
  usualy: 'usually',
  especialy: 'especially',
  alot: 'a lot',
  infact: 'in fact',
  aswell: 'as well',
  eachother: 'each other',
  nowdays: 'nowadays',
  nowaday: 'nowadays',
  thier: 'their',
  teh: 'the',
  taht: 'that',
  trully: 'truly',
  truely: 'truly',
  happend: 'happened',
  lenguage: 'language',
  languaje: 'language',
  pronounciation: 'pronunciation',
  restaurante: 'restaurant',
  proyect: 'project',
  objetive: 'objective',
  inteligent: 'intelligent',
  excelent: 'excellent',
  comunication: 'communication',
  comunity: 'community',
  comunicate: 'communicate',
  atention: 'attention',
  ocasion: 'occasion',
  occured: 'occurred',
  ocurred: 'occurred',
  refered: 'referred',
  prefered: 'preferred',
  lenght: 'length',
  strenght: 'strength',
  foward: 'forward',
  greatful: 'grateful',
  sincerly: 'sincerely',
  faithfuly: 'faithfully',
  advertisment: 'advertisement',
  apartament: 'apartment',
  bussiness: 'business',
  bussines: 'business',
  busines: 'business',
  childs: 'children',
  childrens: 'children',
  mans: 'men',
  womans: 'women',
  foots: 'feet',
  tooths: 'teeth',
  lifes: 'lives',
  wifes: 'wives',
  knifes: 'knives',
};

const CONTRACTIONS: Record<string, string> = {
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "couldn't": 'could not',
  "mustn't": 'must not',
  "i'm": 'I am',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "they're": 'they are',
  "we're": 'we are',
  "you're": 'you are',
  "i've": 'I have',
  "we've": 'we have',
  "they've": 'they have',
  "you've": 'you have',
  "i'll": 'I will',
  "we'll": 'we will',
  "they'll": 'they will',
  "you'll": 'you will',
  "it'll": 'it will',
};

const INFORMAL: Record<string, string | null> = {
  kids: 'children',
  stuff: 'things',
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'have to',
  guys: 'people',
  awesome: null,
};

const ED_OF_ING: Record<string, string> = {
  boring: 'bored',
  interesting: 'interested',
  exciting: 'excited',
  tiring: 'tired',
  confusing: 'confused',
  surprising: 'surprised',
  embarrassing: 'embarrassed',
  frightening: 'frightened',
  annoying: 'annoyed',
  disappointing: 'disappointed',
  relaxing: 'relaxed',
  worrying: 'worried',
  shocking: 'shocked',
  depressing: 'depressed',
  exhausting: 'exhausted',
  terrifying: 'terrified',
};

const COMPARATIVE: Record<string, string> = {
  easy: 'easier',
  cheap: 'cheaper',
  big: 'bigger',
  old: 'older',
  fast: 'faster',
  happy: 'happier',
  good: 'better',
  bad: 'worse',
  small: 'smaller',
  young: 'younger',
  safe: 'safer',
  strong: 'stronger',
  long: 'longer',
  short: 'shorter',
  high: 'higher',
  low: 'lower',
  nice: 'nicer',
  large: 'larger',
  tall: 'taller',
  hot: 'hotter',
  cold: 'colder',
  healthy: 'healthier',
  busy: 'busier',
  hard: 'harder',
  clean: 'cleaner',
  rich: 'richer',
  poor: 'poorer',
};

const ER_FORMS = Object.values(COMPARATIVE).join('|');

const SINGULAR_OF: Record<string, string> = {
  informations: 'information',
  advices: 'advice',
  furnitures: 'furniture',
  homeworks: 'homework',
  luggages: 'luggage',
  equipments: 'equipment',
  softwares: 'software',
  feedbacks: 'feedback',
  knowledges: 'knowledge',
  baggages: 'baggage',
  sceneries: 'scenery',
};

/** Segundas palabras con las que «a news…», «an information…» es un nombre compuesto correcto. */
const COMPOUND_HEAD =
  /^(report|item|story|programme|program|channel|website|article|agency|bulletin|conference|site|app|feed|leaflet|desk|centre|center|pack|sheet|system|technology|age|point|session|board|column|line|service|assignment|club|task|shop|store|company|maker|design|form|loop|failure|room|rack|allowance|compartment|label|campaign|society|security|overload|source)s?$/;

type Forms = readonly [base: string, third: string, past: string, ing: string];
const TAKE: Forms = ['take', 'takes', 'took', 'taking'];
const ASK: Forms = ['ask', 'asks', 'asked', 'asking'];
const HAVE: Forms = ['have', 'has', 'had', 'having'];
const DO: Forms = ['do', 'does', 'did', 'doing'];
const MAKE: Forms = ['make', 'makes', 'made', 'making'];
const TELL: Forms = ['tell', 'tells', 'told', 'telling'];
const MEET: Forms = ['meet', 'meets', 'met', 'meeting'];
const MISS: Forms = ['miss', 'misses', 'missed', 'missing'];

/** Conjuga `target` en la misma forma en que está `used` (una forma de `source`). */
function sameForm(used: string, source: Forms, target: Forms): string {
  const index = source.indexOf(used.toLowerCase());
  return target[index === -1 ? 0 : index] ?? target[0];
}

const an = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// ───────────── Reglas ─────────────

export const RULES: readonly Rule[] = [
  {
    id: 'be-agree',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(I|you|we|they|he|she)(?:\s+(am|are|is|was|were)|['’](?:m|re|s))\s+(not\s+)?((?:totally|completely|absolutely|strongly|partly|really)\s+)?(agree|disagree)\b/gi,
    find: (m) => {
      const [, subject = '', aux = '', negative, adverb = '', verb = ''] = m;
      const past = /^(was|were)$/i.test(aux);
      const third = /^(he|she)$/i.test(subject);
      if (negative) {
        const helper = past ? 'did not' : third ? 'does not' : 'do not';
        return { suggestion: `${subject} ${helper} ${adverb}${verb}` };
      }
      const form = past ? `${verb}d` : third ? `${verb}s` : verb;
      return { suggestion: `${subject} ${adverb}${form}` };
    },
    explanation_es: '«Agree» ya es un verbo: no lleva «be» delante. *I agree*, *I don’t agree*.',
    examples: {
      bad: ['I am agree with you.', "I'm not agree with that idea.", 'She is totally agree.'],
      good: ['I agree with you.', 'We are agreed on the price.', 'I do not agree.'],
    },
  },
  {
    id: 'modal-to',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(can|could|must|should|might|may|will|would)(n['’]t|\s+not)?\s+to\s+(\w+)\b/gi,
    find: (m, { before }) => {
      // «I'll do what I can to help», «the will to live»: ahí el «to» es correcto.
      const context = wordsBefore(before, 4);
      if (context.some((w) => /^(what|everything|all|anything|whatever|as|best)$/.test(w))) {
        return null;
      }
      if (/^(the|a|his|her|my|their|our|strong|good|free|no)$/.test(lastWord(before))) return null;
      return sub('$1$2 $3')(m);
    },
    explanation_es:
      'Después de un verbo modal (*can, must, should…*) va el infinitivo sin «to»: *I can swim*.',
    examples: {
      bad: ['You must to study more.', 'We can to go by bus.', 'She should not to worry.'],
      good: [
        'You must study more.',
        "I'll do what I can to help you.",
        'He lost the will to live.',
        'We did everything we could to finish on time.',
      ],
    },
  },
  {
    id: 'to-can',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(to|will|would|might|must|should|could|may)\s+can\b/gi,
    find: sub('$1 be able to'),
    explanation_es: '«Can» no tiene infinitivo ni futuro: se usa *be able to*.',
    examples: {
      bad: ['I would like to can speak English.', 'You will can see the sea.'],
      good: ['I would like to be able to speak English.', 'You can see the sea.'],
    },
  },
  {
    id: 'want-that',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(want|wants|wanted)\s+that\s+(I|you|he|she|we|they|it|my|the|people)\b/gi,
    find: note,
    explanation_es:
      '«Querer que alguien haga algo» es *want + persona + to + infinitivo*: *I want you to come*.',
    examples: {
      bad: ['I want that you come to my party.', 'My parents wanted that I study law.'],
      good: ['I want you to come to my party.', 'That is all I want.'],
    },
  },
  {
    id: 'look-forward-infinitive',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(look(?:ing|s|ed)?\s+forward\s+to)\s+(hear|see|meet|receive|know|visit|work|read|get|start|go|have|be|welcome|speak|talk|join|learn)\b/gi,
    find: (m) => ({ suggestion: `${m[1]} ${ing(m[2] ?? '')}` }),
    explanation_es:
      'En *look forward to*, «to» es una preposición: detrás va el verbo en -ing (*to hearing from you*).',
    examples: {
      bad: ['I look forward to hear from you.', 'We are looking forward to see you.'],
      good: ['I look forward to hearing from you.', 'I look forward to your reply.'],
    },
  },
  {
    id: 'explain-me',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(explain|explains|explained|explaining)\s+(me|us)\b/gi,
    find: sub('$1 to $2'),
    explanation_es:
      '*Explain* lleva «to» delante de la persona: *explain it to me*, *explain to me why*.',
    examples: {
      bad: ['Can you explain me the rules?', 'The teacher explained us the exercise.'],
      good: [
        'Can you explain the rules to me?',
        'The rules were hard, but she explained them well.',
      ],
    },
  },
  {
    id: 'say-me',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(say|says|said|saying)\s+(me|us|him)\b/gi,
    find: (m) => ({
      suggestion: `${sameForm(m[1] ?? '', ['say', 'says', 'said', 'saying'], TELL)} ${m[2]}`,
    }),
    explanation_es:
      'Con la persona delante se usa *tell*: *tell me*, *she told us*. *Say* va sin persona.',
    examples: {
      bad: ['He said me that he was tired.', 'Please say me the truth.'],
      good: ['He told me that he was tired.', 'He said that he was tired.'],
    },
  },
  {
    id: 'suggest-me',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(suggest|suggests|suggested)\s+(me|us|him|them)\s+to\b/gi,
    find: note,
    explanation_es:
      '*Suggest* no lleva persona + to: *he suggested going* o *he suggested (that) I go*.',
    examples: {
      bad: ['She suggested me to take the train.'],
      good: ['She suggested taking the train.', 'She suggested that I take the train.'],
    },
  },
  {
    id: 'do-plus-past',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(didn['’]t|did\s+not|doesn['’]t|does\s+not|don['’]t|do\s+not)\s+(went|saw|came|had|did|made|took|got|gave|said|told|knew|thought|found|left|felt|bought|ate|wrote|liked|wanted|worked|lived|played)\b/gi,
    find: (m) => ({ suggestion: `${m[1]} ${BASE_OF_PAST[(m[2] ?? '').toLowerCase()]}` }),
    explanation_es:
      'Después de *did / didn’t* el verbo va en su forma base: el pasado ya lo marca *did*.',
    grammar_ref: 'a2.past-simple',
    examples: {
      bad: ["I didn't went to school.", 'She did not saw the film.'],
      good: ["I didn't go to school.", 'She did not see the film.'],
    },
  },
  {
    id: 'does-plus-s',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(doesn['’]t|does\s+not|does\s+(?:he|she|it)|did\s+(?:he|she|it|you|they|we))\s+(likes|wants|needs|works|lives|knows|goes|has|does|makes|takes|comes|plays|thinks|says|gets|gives|seems|helps|means)\b/gi,
    find: (m) => ({ suggestion: `${m[1]} ${baseOfThird(m[2] ?? '')}` }),
    explanation_es:
      'Con *does / doesn’t* el verbo va sin -s: la tercera persona ya la marca *does*.',
    grammar_ref: 'a1.present-simple',
    examples: {
      bad: ["He doesn't likes coffee.", 'Does she works here?'],
      good: ["He doesn't like coffee.", 'Does she work here?'],
    },
  },
  {
    id: 'to-plus-past',
    type: 'grammar',
    severity: 'major',
    pattern: /\bto\s+(went|came|did|made|took|got|gave|told|knew|thought|bought|ate|wrote)\b/gi,
    find: (m) => ({ suggestion: `to ${BASE_OF_PAST[(m[1] ?? '').toLowerCase()]}` }),
    explanation_es: 'Después de «to» el verbo va en infinitivo, aunque hables del pasado.',
    examples: {
      bad: ['I wanted to went with them.', 'She decided to bought it.'],
      good: ['I wanted to go with them.', 'She decided to buy it.'],
    },
  },
  {
    id: 'third-person-s',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(he|she)\s+(like|want|need|work|live|know|go|have|do|make|take|come|play|think|say|study|love|hate|enjoy|speak|teach|watch|get)\b/gi,
    find: (m, { before }) => {
      // Tras un auxiliar o un modal («does she like», «let him go») la forma base es correcta.
      if (
        /^(do|does|did|don't|doesn't|didn't|can|can't|could|couldn't|will|won't|would|wouldn't|should|shouldn't|must|mustn't|may|might|shall|let|lets|make|makes|made|help|helps|helped|see|saw|watch|watched|hear|heard|that|and|or|nor|rather)$/.test(
          lastWord(before).replace(/’/g, "'"),
        )
      ) {
        return null;
      }
      return { suggestion: `${m[1]} ${thirdPerson(m[2] ?? '')}` };
    },
    explanation_es: 'En presente, con *he / she / it* el verbo lleva -s: *she works*, *he has*.',
    grammar_ref: 'a1.present-simple',
    examples: {
      bad: ['My brother is a nurse. He work at night.', 'She have two cats.'],
      good: [
        'He works at night.',
        'Does she like tea?',
        'Why did he go?',
        'I suggest that she take a taxi.',
        'I let him go.',
      ],
    },
  },
  {
    id: 'people-is',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(people|children|police)\s+(is|was|has|doesn['’]t|does)\b/gi,
    find: (m, { before }) => {
      // «Helping people is…», «contact with other people is…»: el sujeto es otro.
      if (OBJECT_OF_SOMETHING.test(before)) return null;
      const verb = conj(
        { is: 'are', was: 'were', has: 'have', does: 'do', "doesn't": "don't", 'doesn’t': 'don’t' },
        m[2] ?? '',
        'are',
      );
      return { suggestion: `${m[1]} ${verb}` };
    },
    explanation_es: '*People*, *children* y *police* son plurales: *people are*, *children have*.',
    examples: {
      bad: ['People is very friendly here.', 'Many children has a phone.'],
      good: [
        'People are very friendly here.',
        'Helping people is rewarding.',
        'The number of people is growing.',
        'Contact with other people is much richer face to face.',
      ],
    },
  },
  {
    id: 'people-who-is',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(people)\s+(who|that)\s+(is|was|has|lives|works|wants|likes|thinks)\b/gi,
    find: (m) => {
      const verb = conj(
        { is: 'are', was: 'were', has: 'have' },
        m[3] ?? '',
        baseOfThird(m[3] ?? ''),
      );
      return { suggestion: `${m[1]} ${m[2]} ${verb}` };
    },
    explanation_es: '*People* es plural, y el verbo de la relativa también: *people who are…*',
    examples: {
      bad: ['People who lives in cities walk less.', 'There are people that is against it.'],
      good: ['People who live in cities walk less.', 'A person who lives in a city walks less.'],
    },
  },
  {
    id: 'everybody-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(everybody|everyone|nobody|somebody|someone|no\s+one)\s+(are|were|have|don['’]t)\b/gi,
    find: (m) => {
      const verb = conj(
        { are: 'is', were: 'was', have: 'has', "don't": "doesn't", 'don’t': 'doesn’t' },
        m[2] ?? '',
        'is',
      );
      return { suggestion: `${m[1]} ${verb}` };
    },
    explanation_es:
      '*Everybody*, *everyone*, *nobody*… llevan el verbo en singular: *everyone is*.',
    examples: {
      bad: ['Everybody are happy.', 'Nobody have time.'],
      good: ['Everybody is happy.', 'Nobody has time.'],
    },
  },
  {
    id: 'news-are',
    type: 'grammar',
    severity: 'major',
    pattern: /\bnews\s+(are|were)\b/gi,
    find: (m) => ({ suggestion: `news ${/are/i.test(m[1] ?? '') ? 'is' : 'was'}` }),
    explanation_es: '*News* es incontable y singular: *the news is good*.',
    examples: { bad: ['The news are terrible.'], good: ['The news is terrible.'] },
  },
  {
    id: 'uncountable-plural',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(`\\b(${Object.keys(SINGULAR_OF).join('|')})\\b`, 'gi'),
    find: (m) => ({ suggestion: SINGULAR_OF[(m[1] ?? '').toLowerCase()] ?? null }),
    explanation_es:
      'Es incontable: no tiene plural. *Some information*, *a piece of advice*, *a lot of furniture*.',
    examples: {
      bad: ['I need more informations.', 'She gave me good advices.'],
      good: ['I need more information.', 'She gave me good advice.'],
    },
  },
  {
    id: 'uncountable-article',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(an?)\s+((?:good\s+|great\s+|bad\s+)?(?:advice|information|furniture|homework|luggage|equipment|feedback|news))\b/gi,
    find: (m, { after }) => {
      if (after.startsWith('-') || COMPOUND_HEAD.test(nextWord(after))) return null;
      return { suggestion: `some ${m[2]}` };
    },
    explanation_es:
      'Los incontables no llevan *a / an*: *some advice*, *a piece of information*, *some good news*.',
    examples: {
      bad: ['Can I give you an advice?', 'I have a good news.'],
      good: [
        'Can I give you some advice?',
        'I read a news report about it.',
        'Ask at an information desk.',
      ],
    },
  },
  {
    id: 'much-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\bmuch\s+(people|friends|things|students|children|cars|books|problems|times|years|places|countries|cities|opportunities|ideas|reasons|advantages|disadvantages|tourists|options|jobs|hours|days)\b/gi,
    find: sub('many $1'),
    explanation_es:
      'Con plurales contables se usa *many*; *much* es para incontables (*much time*).',
    examples: {
      bad: ['There are too much people.', 'I do not have much friends.'],
      good: ['There are too many people.', 'I do not have much time.'],
    },
  },
  {
    id: 'many-uncountable',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\bmany\s+(money|time|information|traffic|homework|advice|water|pollution|noise|fun)\b/gi,
    find: (m, { after }) => (nounFollows(after) ? null : sub('much $1')(m)),
    explanation_es: 'Con incontables se usa *much* (o *a lot of*); *many* es para plurales.',
    examples: {
      bad: ['I do not have many money.', 'There is too many traffic.'],
      good: [
        'I do not have much money.',
        'I have been there many times.',
        'We crossed many time zones.',
      ],
    },
  },
  {
    id: 'double-comparative',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(`\\bmore\\s+(${ER_FORMS})\\b`, 'gi'),
    find: (m, { after }) => (PLURAL_NOUN.test(nextWord(after)) ? null : sub('$1')(m)),
    explanation_es: 'El comparativo en -er ya significa «más»: no se le añade *more*.',
    examples: {
      bad: ['This phone is more better.', 'Trains are more cheaper than planes.'],
      good: ['This phone is better.', 'More older people are living alone.'],
    },
  },
  {
    id: 'more-short-adjective',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(
      `\\bmore\\s+(${Object.keys(COMPARATIVE).join('|')})\\b(?=\\s+than\\b|\\s*[.,;!?]|\\s*$)`,
      'gi',
    ),
    find: (m) => ({ suggestion: COMPARATIVE[(m[1] ?? '').toLowerCase()] ?? null }),
    explanation_es:
      'Los adjetivos cortos hacen el comparativo con -er: *easier*, *cheaper*, *better*.',
    examples: {
      bad: ['It is more easy than I thought.', 'Life here is more cheap.'],
      good: ['It is easier than I thought.', 'We need more cheap flats.'],
    },
  },
  {
    id: 'most-of-people',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(?:the\s+)?most\s+of\s+(people|students|children|teenagers|adults|tourists|families|parents|teachers|workers|cities|countries|schools|companies)\b/gi,
    find: sub('most $1'),
    explanation_es:
      'En general, sin «of» ni «the»: *most people*. Con algo concreto: *most of the people here*.',
    examples: {
      bad: ['The most of people prefer the beach.', 'Most of students work in summer.'],
      good: ['Most people prefer the beach.', 'Most of the students in my class work.'],
    },
  },
  {
    id: 'age-have',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(
      `\\b(I|you|we|they|he|she|(?:my|his|her|our|their|your)\\s+\\w+)\\s+(have|has|had)\\s+(${NUMBER_WORD})\\s+years(?:\\s+old)?\\b(?!\\s+(?:of|to|in|left|ago|more|before|until|working|living|studying|experience))`,
      'gi',
    ),
    find: (m) => {
      const subject = m[1] ?? '';
      const have = (m[2] ?? '').toLowerCase();
      const past = have === 'had';
      const noun = /\s/.test(subject);
      const plural =
        /^(you|we|they)$/i.test(subject) ||
        (noun && (have === 'have' || (past && /s$/i.test(subject))));
      const be =
        subject === 'I'
          ? past
            ? 'was'
            : 'am'
          : plural
            ? past
              ? 'were'
              : 'are'
            : past
              ? 'was'
              : 'is';
      return { suggestion: `${subject} ${be} ${m[3]} years old` };
    },
    explanation_es: 'La edad va con *be*, no con *have*: *I am 20 (years old)*.',
    examples: {
      bad: ['I have 20 years.', 'My sister has fifteen years old.'],
      good: ['I am 20 years old.', 'I have 5 years of experience.', 'We have two years left.'],
    },
  },
  {
    id: 'since-duration',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\bsince\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|many|several|some|a\s+few)\s+(?:year|month|week|day|hour|minute)s?)(?:\s+ago)?\b(?!\s+(?:have|has|had)\b)/gi,
    find: sub('for $1'),
    explanation_es:
      '*Since* + el momento en que empezó (*since 2020*); *for* + cuánto dura (*for three years*).',
    grammar_ref: 'b1.present-perfect-vs-past-simple',
    examples: {
      bad: ['I have lived here since three years.', 'We have been friends since many years ago.'],
      good: ['I have lived here for three years.', 'I have lived here since 2020.'],
    },
  },
  {
    id: 'perfect-finished-time',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(have|has|['’]ve)\s+((?:just|already|never|ever|also)\s+)?(\w+)\s+((?:[\w'’]+\s+){0,4}?)(yesterday|last\s+(?:week|month|year|night|summer|winter|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\w+\s+(?:days?|weeks?|months?|years?|hours?)\s+ago|in\s+(?:19|20)\d\d)\b/gi,
    find: (m, { before }) => {
      const [whole, aux = '', adverb = '', participle = '', between = ''] = m;
      let past = pastOfParticiple(participle);
      if (!past) return null;
      // Otra oración por medio («I have seen the film he made last year») o un «since»: no es el caso.
      if (
        /\b(who|which|when|where|because|if|and|but|or|what|why|how|whether|since|until|before|after|than|I|you|he|she|we|they)\b/i.test(
          between,
        )
      ) {
        return null;
      }
      if (/^that\b/i.test(between) && REPORTING.test(participle)) return null;
      if (participle.toLowerCase() === 'been' && /^(we|you|they)$/.test(lastWord(before))) {
        past = 'were';
      }
      const head = /^\S+\s+(?:(?:just|already|never|ever|also)\s+)?\w+/i.exec(whole)?.[0] ?? whole;
      const contracted = /^['’]/.test(aux);
      return { suggestion: `${contracted ? ' ' : ''}${adverb}${past}`, start: 0, end: head.length };
    },
    explanation_es:
      'Con un momento ya terminado (*yesterday, last week, two years ago*) va el pasado simple, no el *present perfect*.',
    grammar_ref: 'b1.present-perfect-vs-past-simple',
    examples: {
      bad: [
        'I have seen that film yesterday.',
        'She has visited Rome two years ago.',
        "I've been there last year.",
      ],
      good: [
        'I saw that film yesterday.',
        'I have wanted to go since last year.',
        'I have heard that Tom left last week.',
        'I have seen the film he made last year.',
      ],
    },
  },
  {
    id: 'if-will',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(
      `${START}(If)\\s+(I|you|he|she|it|we|they)\\s+(will|won['’]t|will\\s+not)\\s+(\\w+)\\b`,
      'g',
    ),
    find: (m) => {
      const [, conjunction = 'If', subject = '', aux = '', verb = ''] = m;
      if (/^(excuse|follow|allow|permit|forgive|bear|wait|please|kindly|just)$/i.test(verb))
        return null;
      const third = /^(he|she|it)$/i.test(subject);
      if (/^will$/i.test(aux)) {
        const form =
          verb.toLowerCase() === 'be'
            ? /^I$/.test(subject)
              ? 'am'
              : third
                ? 'is'
                : 'are'
            : third
              ? thirdPerson(verb)
              : verb;
        return { suggestion: `${conjunction} ${subject} ${form}` };
      }
      return { suggestion: `${conjunction} ${subject} ${third ? "doesn't" : "don't"} ${verb}` };
    },
    explanation_es:
      'En la parte del «if» no va *will*: presente en la condición y *will* en el resultado (*If I have time, I will go*).',
    examples: {
      bad: ['If I will have time, I will call you.', 'If it will rain, we will stay at home.'],
      good: ['If I have time, I will call you.', 'I do not know if he will come.'],
    },
  },
  {
    id: 'question-word-order',
    type: 'word_order',
    severity: 'major',
    pattern: new RegExp(
      `${START}(Where|What|When|Why|How|Who)\\s+(you|they|we|he|she)\\s+([\\w'’]+)(?=[^.!?\\n]*\\?)`,
      'g',
    ),
    find: (m, { after }) => {
      const [, wh = '', subject = '', verb = ''] = m;
      const v = verb.toLowerCase();
      if (/ing$/.test(v)) return null;
      const swap = { suggestion: `${wh} ${verb} ${subject}` };
      if (/^(are|is|was|were|can|will|would|should|could|must|am)$/.test(v)) return swap;
      // «Where he has been?» invierte; «What you have in your bag?» necesita «do».
      if (
        /^(have|has|had)$/.test(v) &&
        /^(been|gone|done|seen|got|had|made|put|\w+ed|\w+en)$/.test(nextWord(after))
      ) {
        return swap;
      }
      const base = BASE_OF_PAST[v];
      if (base) return { suggestion: `${wh} did ${subject} ${base}` };
      if (/ed$/.test(v)) return { suggestion: null };
      const third = /^(he|she)$/i.test(subject);
      return {
        suggestion: `${wh} ${third ? 'does' : 'do'} ${subject} ${third ? baseOfThird(verb) : verb}`,
      };
    },
    explanation_es:
      'En las preguntas el auxiliar va delante del sujeto: *Where do you live?*, *What are you doing?*',
    grammar_ref: 'a1.present-simple',
    examples: {
      bad: [
        'Where you live?',
        'What you are doing this weekend?',
        'Why she left so early?',
        'What we do now?',
      ],
      good: ['Where do you live?', 'What you need is a rest.', 'What are you doing this weekend?'],
    },
  },
  {
    id: 'adjective-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(differents|importants|interestings|beautifuls|youngs|expensives|populars|diferents)\b/gi,
    find: (m) => ({ suggestion: (m[1] ?? '').replace(/s$/i, '').replace(/^dif(?=e)/i, 'diff') }),
    explanation_es:
      'Los adjetivos no tienen plural en inglés: *different cars*, *important things*.',
    examples: {
      bad: ['We visited differents places.', 'There are importants reasons.'],
      good: ['We visited different places.'],
    },
  },
  {
    id: 'others-noun',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\bothers\s+(people|things|students|countries|cities|friends|places|ways|options|languages|problems|children|reasons|activities|sports|subjects|cultures|times|days|parts|words|books|films|jobs|members)\b/gi,
    find: sub('other $1'),
    explanation_es: 'Delante de un nombre es *other*, sin -s: *other people*. *Others* va solo.',
    examples: {
      bad: ['I like meeting others people.', 'In others countries it is different.'],
      good: ['I like meeting other people.', 'Some people agree; others think it is wrong.'],
    },
  },
  {
    id: 'another-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\banother\s+(things|people|reasons|options|problems|ways|places|countries|friends|students|ideas|activities|examples|advantages|questions|books|films|words|points|aspects|factors|benefits|issues)\b/gi,
    find: sub('other $1'),
    explanation_es:
      '*Another* = «un otro», va con singular. Con plurales, *other*: *other things*.',
    examples: {
      bad: ['There are another things to do.', 'We tried another options.'],
      good: ['There are other things to do.', 'One study agrees; another says the opposite.'],
    },
  },
  {
    id: 'every-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(every|each)\s+(days|weeks|months|years|students|friends|times|things|mornings|nights|weekends|summers|countries|cities)\b/gi,
    find: (m) => {
      const noun = (m[2] ?? '').toLowerCase();
      const singular = noun.endsWith('ies') ? `${noun.slice(0, -3)}y` : noun.slice(0, -1);
      return { suggestion: `${m[1]} ${singular}` };
    },
    explanation_es: '*Every* y *each* van con singular: *every day*, *each student*.',
    examples: {
      bad: ['I go running every days.', 'Each students has a laptop.'],
      good: ['I go running every day.', 'I go every two weeks.'],
    },
  },
  {
    id: 'this-plural',
    type: 'grammar',
    severity: 'major',
    pattern: /\bthis\s+(people|children|things|problems|days|years|students|ideas|activities)\b/gi,
    find: sub('these $1'),
    explanation_es: 'Con plural, *these* (cerca) o *those* (lejos); *this* es singular.',
    examples: {
      bad: ['This people are very kind.', 'I like this things.'],
      good: ['These people are very kind.', 'This thing is heavy.'],
    },
  },
  {
    id: 'there-is-plural',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\bthere\s+(is|was)\s+(many|a\s+lot\s+of|lots\s+of|some|two|three|four|five|several|a\s+few)\s+([a-z]+s)\b/gi,
    find: (m, { after }) => {
      if (SINGULAR_IN_S.test((m[3] ?? '').toLowerCase()) || nounFollows(after)) return null;
      return { suggestion: `there ${/is/i.test(m[1] ?? '') ? 'are' : 'were'} ${m[2]} ${m[3]}` };
    },
    explanation_es: 'Con plural, *there are / there were*: *there are many shops*.',
    examples: {
      bad: ['There is many shops in my town.', 'There was two problems.'],
      good: [
        'There are many shops in my town.',
        'There is a lot of news today.',
        'There is some sports equipment in the hall.',
      ],
    },
  },
  {
    id: 'there-are-singular',
    type: 'grammar',
    severity: 'major',
    pattern: /\bthere\s+(are|were)\s+(a|an|one)\s+(\w+)\b/gi,
    find: (m) => {
      if (
        /^(lot|few|couple|number|great|large|small|wide|variety|range|total|handful|dozen|hundred|thousand|million|good|huge|vast|growing|increasing|whole|further|estimated|additional|extra|limited|certain|or)$/i.test(
          m[3] ?? '',
        )
      ) {
        return null;
      }
      return { suggestion: `there ${/are/i.test(m[1] ?? '') ? 'is' : 'was'} ${m[2]} ${m[3]}` };
    },
    explanation_es: 'Con singular, *there is / there was*: *there is a park*.',
    examples: {
      bad: ['There are a park near my house.', 'There were one problem.'],
      good: [
        'There is a park near my house.',
        'There are a lot of parks.',
        'There are a few options.',
      ],
    },
  },
  {
    id: 'double-negative',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(?:don['’]t|doesn['’]t|didn['’]t|can['’]t|won['’]t|haven['’]t|hasn['’]t|couldn['’]t|do\s+not|does\s+not|did\s+not)\s+(?:\w+\s+){0,2}?(nothing|nobody|no\s+one|nowhere)\b/gi,
    find: (m) => {
      const negative = m[1] ?? '';
      const fix = conj(
        { nothing: 'anything', nobody: 'anybody', nowhere: 'anywhere' },
        negative,
        'anyone',
      );
      return { suggestion: fix, start: m[0].length - negative.length, end: m[0].length };
    },
    explanation_es:
      'En inglés no hay doble negación: con el verbo en negativo se usa *anything / anybody / anywhere*.',
    examples: {
      bad: ["I don't know nothing about it.", "We didn't see nobody."],
      good: [
        "I don't know anything about it.",
        'I know nothing about it.',
        // Lítotes: «no es poca cosa».
        "Which isn't nothing, but it isn't composing either.",
      ],
    },
  },
  {
    id: 'bored-boring',
    type: 'vocabulary',
    severity: 'check',
    pattern: new RegExp(
      `\\b(I\\s+am|I['’]m|I\\s+was|I\\s+feel|I\\s+felt|I\\s+got|I\\s+get|we\\s+are|we\\s+were|we['’]re)\\s+((?:very|so|really|quite|a\\s+bit|too|extremely)\\s+)?(${Object.keys(ED_OF_ING).join('|')})\\b(?!\\s+(?:person|people|man|woman|guy|girl|boy))`,
      'gi',
    ),
    find: (m) => ({ suggestion: `${m[1]} ${m[2] ?? ''}${ED_OF_ING[(m[3] ?? '').toLowerCase()]}` }),
    explanation_es:
      'Cómo te sientes → -ed (*I’m bored*). Cómo es algo → -ing (*the film is boring*).',
    examples: {
      bad: ['I am boring at home.', 'I was very surprising by the news.'],
      good: ['I am bored at home.', 'The film was boring.', 'I am a boring person.'],
    },
  },
  {
    id: 'enough-order',
    type: 'word_order',
    severity: 'major',
    pattern:
      /\benough\s+(big|good|old|tall|strong|fast|rich|warm|hot|cold|small|long|large|high|easy|clear|safe|smart|brave|cheap)\b(?=\s+(?:to|for)\b|\s*[.,;!?]|\s*$)/gi,
    find: sub('$1 enough'),
    explanation_es: '*Enough* va detrás del adjetivo: *big enough*, *old enough*.',
    examples: {
      bad: ['The flat is not enough big.', 'He is enough old to drive.'],
      good: ['The flat is not big enough.', 'We have enough time.', 'We have enough good players.'],
    },
  },
  {
    id: 'like-very-much',
    type: 'word_order',
    severity: 'major',
    pattern:
      /\b(like|likes|liked|love|loves|loved|enjoy|enjoys|enjoyed)\s+(very\s+much|a\s+lot)\s+(the|a|an|my|your|this|that|these|those|to|\w+ing)\b/gi,
    find: note,
    explanation_es:
      'El complemento va pegado al verbo y el adverbio al final: *I like pizza very much*.',
    examples: {
      bad: ['I like very much the mountains.', 'She enjoys a lot reading.'],
      good: ['I like the mountains very much.', 'I like a lot of things.'],
    },
  },
  // ── Preposiciones ──
  {
    id: 'depend-of',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(depend(?:s|ed|ing)?)\s+of\b/gi,
    find: sub('$1 on'),
    explanation_es: 'Es *depend on*: *it depends on the weather*.',
    examples: { bad: ['It depends of the weather.'], good: ['It depends on the weather.'] },
  },
  {
    id: 'interested-on',
    type: 'grammar',
    severity: 'major',
    pattern: /\binterested\s+(on|at|for|about)\b/gi,
    find: () => ({ suggestion: 'interested in' }),
    explanation_es: 'Es *interested in*: *I am interested in music*.',
    examples: { bad: ['I am interested on this job.'], good: ['I am interested in this job.'] },
  },
  {
    id: 'arrive-to',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b([Aa]rriv(?:e|es|ed|ing))\s+to\b(?=\s+(?:(?:the|a|an|my|your|his|her|our|their)\s|[A-Z]))/g,
    find: (m, { after }) => ({
      suggestion: `${m[1]} ${/^\s+[A-Z]/.test(after) ? 'in' : 'at'}`,
    }),
    explanation_es:
      '*Arrive* nunca lleva «to»: *arrive at* un sitio concreto, *arrive in* una ciudad o un país.',
    examples: {
      bad: ['We arrived to the hotel at night.', 'She arrived to London on Monday.'],
      good: ['We arrived at the hotel at night.', 'I arrived to find the door open.'],
    },
  },
  {
    id: 'married-with',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(married|engaged)\s+with\b(?!\s+(?:(?:\w+\s+)?(?:children|kids|child|sons?|daughters?|twins|babies)|a\s+baby|\d|one|two|three|four|five|no)\b)/gi,
    find: sub('$1 to'),
    explanation_es: '«Casado con» es *married to*: *she is married to a doctor*.',
    examples: {
      bad: ['My sister is married with a Frenchman.'],
      good: ['My sister is married to a Frenchman.', 'He is married with two children.'],
    },
  },
  {
    id: 'dream-with',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(dream(?:s|ed|t|ing)?)\s+with\b/gi,
    find: sub('$1 of'),
    explanation_es: '«Soñar con» es *dream of* o *dream about*.',
    examples: { bad: ['I dream with living abroad.'], good: ['I dream of living abroad.'] },
  },
  {
    id: 'in-weekday',
    type: 'grammar',
    severity: 'major',
    pattern: /\bin\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?)\b(?!['’])/gi,
    find: sub('on $1'),
    explanation_es: 'Con los días de la semana, *on*: *on Monday*.',
    examples: { bad: ['See you in Monday.'], good: ['See you on Monday.'] },
  },
  {
    id: 'on-month',
    type: 'grammar',
    severity: 'major',
    pattern: new RegExp(
      `\\b(?:on|at)\\s+(${MONTH})\\b(?!\\s+(?:\\d|the\\s+\\d|first|second|third|Fool))`,
      'g',
    ),
    find: sub('in $1'),
    explanation_es: 'Con meses y años, *in*: *in July*. *On* es para días y fechas (*on 5 July*).',
    examples: {
      bad: ['My birthday is on July.', 'We met at December.'],
      good: ['My birthday is in July.', 'It is on July 4th.'],
    },
  },
  {
    id: 'in-the-weekend',
    type: 'grammar',
    severity: 'major',
    pattern: /\bin\s+the\s+(weekends?)\b/gi,
    find: sub('at the $1'),
    explanation_es: '*At the weekend* (británico) u *on the weekend* (americano), nunca «in».',
    examples: {
      bad: ['I play football in the weekend.'],
      good: ['I play football at the weekend.'],
    },
  },
  {
    id: 'at-the-morning',
    type: 'grammar',
    severity: 'major',
    pattern: /\bat\s+the\s+(morning|afternoon|evening)\b/gi,
    find: sub('in the $1'),
    explanation_es: '*In the morning / afternoon / evening*, pero *at night*.',
    examples: { bad: ['I study at the morning.'], good: ['I study in the morning.'] },
  },
  {
    id: 'good-in',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(good|bad|better|great|terrible|excellent)\s+in\s+(maths|English|sports?|languages|football|tennis|music|science|cooking|drawing|swimming|singing|dancing|writing|speaking|reading|playing|running|painting)\b/gi,
    find: sub('$1 at $2'),
    explanation_es: '«Bueno en algo» es *good at*: *she is good at maths*.',
    examples: {
      bad: ['I am good in maths.', 'He is very bad in cooking.'],
      good: ['I am good at maths.', 'The weather is good in spring.'],
    },
  },
  {
    id: 'responsible-of',
    type: 'grammar',
    severity: 'major',
    pattern: /\bresponsible\s+of\b/gi,
    find: () => ({ suggestion: 'responsible for' }),
    explanation_es: 'Es *responsible for*.',
    examples: {
      bad: ['I was responsible of the team.'],
      good: ['I was responsible for the team.'],
    },
  },
  {
    id: 'consist-on',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(consist(?:s|ed|ing)?)\s+on\b/gi,
    find: sub('$1 of'),
    explanation_es: 'Es *consist of*: *the course consists of ten lessons*.',
    examples: {
      bad: ['The exam consists on two parts.'],
      good: ['The exam consists of two parts.'],
    },
  },
  {
    id: 'participate-on',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(participat(?:e|es|ed|ing))\s+(?:on|at)\b/gi,
    find: sub('$1 in'),
    explanation_es: 'Es *participate in* (o *take part in*).',
    examples: {
      bad: ['I participated on a competition.'],
      good: ['I participated in a competition.'],
    },
  },
  {
    id: 'similar-than',
    type: 'grammar',
    severity: 'major',
    pattern: /\bsimilar\s+(?:than|that|as)\b/gi,
    find: () => ({ suggestion: 'similar to' }),
    explanation_es: 'Es *similar to*.',
    examples: { bad: ['My city is similar than yours.'], good: ['My city is similar to yours.'] },
  },
  {
    id: 'discuss-about',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(discuss(?:es|ed|ing)?)\s+about\b/gi,
    find: sub('$1'),
    explanation_es: '*Discuss* no lleva preposición: *we discussed the problem*.',
    examples: {
      bad: ['We discussed about the problem.'],
      good: ['We discussed the problem.', 'We had a discussion about it.'],
    },
  },
  {
    id: 'enter-in',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(enter(?:s|ed|ing)?)\s+(?:in|into|to)\s+(the\s+(?:room|house|building|class|classroom|shop|school|office))\b/gi,
    find: sub('$1 $2'),
    explanation_es: '*Enter* un lugar va sin preposición: *she entered the room*.',
    examples: { bad: ['He entered in the room.'], good: ['He entered the room.'] },
  },
  {
    id: 'listen-without-to',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(listen(?:s|ed|ing)?)\s+(music|the(?!\s+(?:whole|entire|other|next|first|last|same|more)\b)|him|her|them|me|my|your|his|their|our|songs|podcasts?|a\s+(?:song|podcast|programme|program|lecture|talk|concert|band))\b/gi,
    find: sub('$1 to $2'),
    explanation_es: '*Listen* siempre lleva «to» delante de lo que se escucha: *listen to music*.',
    examples: {
      bad: ['I listen music every day.', 'You should listen your teacher.'],
      good: [
        'I listen to music every day.',
        'Listen carefully.',
        'I listen a lot.',
        'She listened the whole time.',
      ],
    },
  },
  {
    id: 'wait-without-for',
    type: 'grammar',
    severity: 'major',
    pattern: /\b(wait(?:s|ed|ing)?)\s+(him|them|us|me|the\s+bus|the\s+train)\b/gi,
    find: sub('$1 for $2'),
    explanation_es: '«Esperar a alguien o algo» es *wait for*: *wait for me*.',
    examples: { bad: ['Please wait me at the door.'], good: ['Please wait for me at the door.'] },
  },
  {
    id: 'for-to',
    type: 'grammar',
    severity: 'major',
    pattern: /\bfor\s+to\s+(\w+)\b/gi,
    find: sub('to $1'),
    explanation_es:
      'La finalidad se expresa con *to + infinitivo*, sin «for»: *I went to buy bread*.',
    examples: { bad: ['I went there for to study.'], good: ['I went there to study.'] },
  },
  {
    id: 'for-plus-verb',
    type: 'grammar',
    severity: 'major',
    pattern: /\bfor\s+(buy|go|see|learn|improve|get|meet|find|know|pass|have|make)\b(?!-)/gi,
    find: sub('to $1'),
    explanation_es: '«Para + verbo» es *to + infinitivo*: *I use it to learn*, no «for learn».',
    examples: {
      bad: ['I use the app for learn English.', 'I went to the shop for buy milk.'],
      good: ['I use the app to learn English.', 'Thanks for the help.'],
    },
  },
  {
    id: 'thanks-for-verb',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(thanks?(?:\s+you)?\s+for)\s+(invite|come|send|tell|give|write|listen|answer|reply)\b/gi,
    find: (m) => ({ suggestion: `${m[1]} ${ing(m[2] ?? '')}` }),
    explanation_es: 'Después de una preposición el verbo va en -ing: *thank you for inviting me*.',
    examples: {
      bad: ['Thank you for invite me.', 'Thanks for come.'],
      good: ['Thank you for inviting me.', 'Thanks for your help.'],
    },
  },
  {
    id: 'instead-of-verb',
    type: 'grammar',
    severity: 'major',
    pattern: /\binstead\s+of\s+(go|take|buy|do|make|watch|drive|spend|stay|eat|use)\b/gi,
    find: (m) => ({ suggestion: `instead of ${ing(m[1] ?? '')}` }),
    explanation_es: 'Después de una preposición el verbo va en -ing: *instead of going*.',
    examples: {
      bad: ['I walk instead of take the bus.'],
      good: ['I walk instead of taking the bus.', 'Use this one instead of that.'],
    },
  },
  {
    id: 'verb-plus-ing',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(enjoy|enjoys|enjoyed|avoid|avoids|avoided|finish|finished|fancy|feel\s+like)\s+to\s+(\w+)\b/gi,
    find: (m) => {
      if (
        /^(the|a|an|my|your|his|her|our|their|this|that|these|those|it|them|me|him|us|you|what|which|one|some|any|all)$/i.test(
          m[2] ?? '',
        )
      ) {
        return null;
      }
      return { suggestion: `${m[1]} ${ing(m[2] ?? '')}` };
    },
    explanation_es:
      '*Enjoy, avoid, finish, fancy, feel like* van seguidos de -ing: *I enjoy reading*.',
    examples: {
      bad: ['I enjoy to read at night.', 'I do not feel like to go out.'],
      good: ['I enjoy reading at night.', 'I want to read.'],
    },
  },
  {
    id: 'despite-of',
    type: 'cohesion',
    severity: 'major',
    pattern: /\bdespite\s+of\b/gi,
    find: () => ({ suggestion: 'despite' }),
    explanation_es: '*Despite* va sin «of»; con «of» es *in spite of*.',
    grammar_ref: 'b2.linking-contrast-concession',
    examples: {
      bad: ['Despite of the rain, we went out.'],
      good: ['Despite the rain, we went out.', 'In spite of the rain, we went out.'],
    },
  },
  {
    id: 'other-hand',
    type: 'cohesion',
    severity: 'major',
    pattern: /\b(in\s+the\s+other\s+hand|on\s+the\s+other\s+side)\b(?!\s+of\b)/gi,
    find: () => ({ suggestion: 'on the other hand' }),
    explanation_es: 'El conector es *on the other hand*.',
    grammar_ref: 'b2.linking-contrast-concession',
    examples: {
      bad: ['In the other hand, it is expensive.'],
      good: ['On the other hand, it is expensive.', 'The shop is on the other side of the road.'],
    },
  },
  {
    id: 'according-to-me',
    type: 'vocabulary',
    severity: 'major',
    pattern: /\baccording\s+to\s+(?:me|my\s+opinion)\b/gi,
    find: () => ({ suggestion: 'in my opinion' }),
    explanation_es: '*According to* se usa con lo que dicen otros. Para lo tuyo: *in my opinion*.',
    examples: {
      bad: ['According to me, it is a mistake.'],
      good: ['In my opinion, it is a mistake.', 'According to the report, prices will rise.'],
    },
  },
  {
    id: 'an-other',
    type: 'spelling',
    severity: 'minor',
    pattern: /\ban\s+other\b/gi,
    find: () => ({ suggestion: 'another' }),
    explanation_es: '*Another* se escribe junto.',
    examples: { bad: ['I need an other pen.'], good: ['I need another pen.'] },
  },
  // ── Artículos ──
  {
    id: 'profession-article',
    type: 'grammar',
    severity: 'major',
    pattern:
      /\b(I\s+am|I['’]m|(?:he|she)\s+is|(?:he|she)['’]s|(?:I|he|she)\s+was|(?:my|his|her)\s+(?:father|mother|brother|sister|dad|mum|mom|friend|uncle|aunt|wife|husband)\s+(?:is|was))\s+(teacher|doctor|engineer|student|nurse|lawyer|waiter|waitress|driver|programmer|developer|designer|journalist|mechanic|dentist|architect|scientist|chef|cook|firefighter|receptionist|accountant|electrician|plumber|pilot|farmer|vet|actor|actress|singer|musician|writer|photographer)\b/gi,
    find: (m) => ({ suggestion: `${m[1]} ${an(m[2] ?? '')} ${m[2]}` }),
    explanation_es: 'Las profesiones llevan *a / an*: *she is a teacher*.',
    examples: {
      bad: ['My mother is teacher.', 'I am engineer.'],
      good: ['My mother is a teacher.', 'I am an engineer.'],
    },
  },
  {
    id: 'generic-the',
    type: 'grammar',
    severity: 'check',
    pattern: new RegExp(
      `${START}The\\s+(life|nature|society|love|happiness|pollution|education|health)\\s+(is|has|can|should|must|will)\\b`,
      'g',
    ),
    find: (m) => {
      const noun = m[1] ?? '';
      return { suggestion: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${m[2]}` };
    },
    explanation_es:
      'Si hablas de algo en general, va sin artículo: *Life is hard*. Con «the» solo si es uno concreto.',
    examples: {
      bad: ['The life is hard in a big city.', 'The education is very important.'],
      good: ['Life is hard in a big city.', 'The pollution in my city is terrible.'],
    },
  },
  {
    id: 'a-before-vowel',
    type: 'grammar',
    severity: 'minor',
    pattern: /\ba\s+([aeiou][a-z]+|hour[a-z]*|honest[a-z]*|honou?r[a-z]*|heir[a-z]*)\b/gi,
    find: (m) => {
      // «a URL», «a UK company»: las siglas se rigen por cómo se leen.
      if (/^[A-Z]{2,}$/.test(m[1] ?? '')) return null;
      const word = (m[1] ?? '').toLowerCase();
      if (/^(uni|use|usu|uti|eu|one|once|ubiq|ukulele|ewe)/.test(word)) return null;
      if (
        /^(is|are|or|and|in|of|on|at|as|it|if|an|also|even|each|either|all|up|out|off|over|under|after|about|above|across|against|along|among|around|only)$/.test(
          word,
        )
      ) {
        return null;
      }
      return { suggestion: `${m[0].startsWith('A') ? 'An' : 'an'} ${m[1]}` };
    },
    explanation_es: 'Delante de sonido vocálico se usa *an*: *an apple*, *an hour*.',
    card: false,
    examples: {
      bad: ['I ate a apple.', 'It is a interesting book.', 'It took a hour.'],
      good: [
        'I ate an apple.',
        'She goes to a university.',
        'Plan A is better.',
        'It is a one-way street.',
        'Paste a URL here.',
      ],
    },
  },
  {
    id: 'an-before-consonant',
    type: 'grammar',
    severity: 'minor',
    pattern: /\ban\s+([b-df-hj-np-tv-z][a-z]+)\b/gi,
    find: (m) => {
      const word = m[1] ?? '';
      if (/^(hour|honest|honou?r|heir|histor|herb)/i.test(word) || /^[A-Z]{2,}$/.test(word))
        return null;
      return { suggestion: `${m[0].startsWith('A') ? 'A' : 'a'} ${word}` };
    },
    explanation_es: 'Delante de sonido consonántico se usa *a*: *a car*, *a university*.',
    card: false,
    examples: {
      bad: ['I bought an car.', 'It was an big mistake.'],
      good: ['I bought a car.', 'It took an hour.', 'She is an honest person.', 'He is an MP.'],
    },
  },
  // ── Colocaciones y falsos amigos ──
  {
    id: 'make-instead-of-other',
    type: 'collocation',
    severity: 'major',
    pattern:
      /\b(make|makes|made|making)\s+(a\s+photo|photos|a\s+question|questions|a\s+party|sport|sports|exercise|homework|the\s+homework|my\s+homework|an\s+exam|business)\b/gi,
    find: (m) => {
      const object = (m[2] ?? '').toLowerCase();
      const target = /photo/.test(object)
        ? TAKE
        : /question/.test(object)
          ? ASK
          : /party/.test(object)
            ? HAVE
            : /an exam/.test(object)
              ? TAKE
              : DO;
      return { suggestion: `${sameForm(m[1] ?? '', MAKE, target)} ${m[2]}` };
    },
    explanation_es:
      'No todo es *make*: *take a photo*, *ask a question*, *have a party*, *do sport / homework / business*.',
    examples: {
      bad: [
        'We made photos of the castle.',
        'Can I make a question?',
        'I make sport twice a week.',
      ],
      good: ['We took photos.', 'Can I ask a question?', 'I made a cake.'],
    },
  },
  {
    id: 'do-instead-of-make',
    type: 'collocation',
    severity: 'major',
    pattern:
      /\b(do|does|did|doing)\s+(a\s+mistake|mistakes|an\s+effort|a\s+decision|decisions|noise|a\s+noise|a\s+phone\s+call|a\s+suggestion|progress|plans|a\s+plan)\b/gi,
    find: (m) => ({ suggestion: `${sameForm(m[1] ?? '', DO, MAKE)} ${m[2]}` }),
    explanation_es:
      'Con estas palabras va *make*: *make a mistake*, *make an effort*, *make a decision*, *make progress*.',
    examples: {
      bad: ['I did a mistake in the exam.', 'We have to do a decision.'],
      good: ['I made a mistake in the exam.', 'I did my homework.'],
    },
  },
  {
    id: 'say-a-lie',
    type: 'collocation',
    severity: 'major',
    pattern: /\b(say|says|said|saying)\s+(a\s+lie|lies|the\s+truth|a\s+joke|jokes|a\s+story)\b/gi,
    find: (m) => ({
      suggestion: `${sameForm(m[1] ?? '', ['say', 'says', 'said', 'saying'], TELL)} ${m[2]}`,
    }),
    explanation_es:
      'Mentiras, verdades, chistes e historias se «cuentan»: *tell a lie*, *tell the truth*.',
    examples: { bad: ['He always says the truth.'], good: ['He always tells the truth.'] },
  },
  {
    id: 'know-people',
    type: 'collocation',
    severity: 'major',
    pattern: /\b(know|knows|knew|knowing)\s+(new\s+people)\b/gi,
    find: (m) => ({
      suggestion: `${sameForm(m[1] ?? '', ['know', 'knows', 'knew', 'knowing'], MEET)} ${m[2]}`,
    }),
    explanation_es: '«Conocer gente» por primera vez es *meet people*; *know* es conocerla ya.',
    examples: {
      bad: ['I want to know new people.'],
      good: ['I want to meet new people.', 'I know a lot of people in Madrid.'],
    },
  },
  {
    id: 'lose-the-bus',
    type: 'collocation',
    severity: 'major',
    pattern:
      /\b(lose|loses|lost|losing)\s+((?:the|my|a|his|her|our)\s+(?:bus|train|flight|plane))\b/gi,
    find: (m) => ({
      suggestion: `${sameForm(m[1] ?? '', ['lose', 'loses', 'lost', 'losing'], MISS)} ${m[2]}`,
    }),
    explanation_es: '«Perder» un autobús, un tren o una clase es *miss*: *I missed the bus*.',
    examples: { bad: ['I lost the bus this morning.'], good: ['I missed the bus this morning.'] },
  },
  {
    id: 'assist-to',
    type: 'false_friend',
    severity: 'major',
    pattern: /\bassist(s|ed|ing)?\s+to\s+(a|an|the|my|our|this|that|his|her|their)\b/gi,
    find: (m) => ({ suggestion: `attend${m[1] ?? ''} ${m[2]}` }),
    explanation_es: '«Asistir a» es *attend*. *Assist* significa ayudar.',
    examples: {
      bad: ['I assisted to a conference in Madrid.'],
      good: ['I attended a conference in Madrid.', 'She assisted the doctor.'],
    },
  },
  {
    id: 'study-a-career',
    type: 'false_friend',
    severity: 'major',
    pattern: /\b(study|studied|studying|finish|finished)\s+(a|the|my)\s+career\b/gi,
    find: sub('$1 $2 degree'),
    explanation_es: 'La carrera universitaria es *degree*. *Career* es la trayectoria profesional.',
    examples: {
      bad: ['I finished my career in 2020.'],
      good: ['I finished my degree in 2020.', 'She has had a long career in music.'],
    },
  },
  {
    id: 'actually',
    type: 'false_friend',
    severity: 'check',
    pattern: /\b(actually|actual)\b/gi,
    find: note,
    explanation_es:
      '*Actually* = «en realidad» y *actual* = «real». Para «actualmente / actual»: *currently, nowadays / current*.',
    card: false,
    examples: {
      bad: ['Actually I am working in a bank.', 'The actual president is very young.'],
      good: ['Currently I am working in a bank.'],
    },
  },
  {
    id: 'eventually',
    type: 'false_friend',
    severity: 'check',
    pattern: /\beventually\b/gi,
    find: note,
    explanation_es:
      '*Eventually* = «al final, con el tiempo». Para «eventualmente»: *possibly*, *occasionally*.',
    card: false,
    examples: {
      bad: ['Eventually we go to the cinema.'],
      good: ['Occasionally we go to the cinema.'],
    },
  },
  {
    id: 'sensible',
    type: 'false_friend',
    severity: 'check',
    pattern: /\bsensible\b/gi,
    find: note,
    explanation_es: '*Sensible* = «sensato». Para «sensible» (que siente mucho): *sensitive*.',
    card: false,
    examples: { bad: ['She is very sensible and cries a lot.'], good: ['She is very sensitive.'] },
  },
  {
    id: 'win-money',
    type: 'vocabulary',
    severity: 'check',
    pattern:
      /\b(win|wins|winning)\s+((?:a\s+lot\s+of\s+|more\s+|much\s+|some\s+|enough\s+)?money)\b/gi,
    find: (m) => ({
      suggestion: `${sameForm(m[1] ?? '', ['win', 'wins', 'won', 'winning'], ['earn', 'earns', 'earned', 'earning'])} ${m[2]}`,
    }),
    explanation_es:
      'El dinero del trabajo se «gana» con *earn*. *Win* es en un concurso, un sorteo o un partido.',
    examples: {
      bad: ['Doctors win a lot of money.'],
      good: ['Doctors earn a lot of money.'],
    },
  },
  // ── Conectores y comparaciones ──
  {
    id: 'then-than',
    type: 'spelling',
    severity: 'check',
    pattern: new RegExp(`\\b(${ER_FORMS}|rather|more|less)\\s+then\\b(?=\\s+\\w)`, 'gi'),
    find: sub('$1 than'),
    explanation_es: 'En las comparaciones es *than*; *then* significa «entonces» o «después».',
    examples: {
      bad: ['My brother is older then me.', 'This one is cheaper then the other.'],
      good: ['My brother is older than me.', 'Life was harder then.'],
    },
  },
  {
    id: 'can-not',
    type: 'spelling',
    severity: 'minor',
    pattern: /\bcan\s+not\b(?!\s+only)/gi,
    find: (m) => ({ suggestion: m[0].startsWith('C') ? 'Cannot' : 'cannot' }),
    explanation_es: '*Cannot* se escribe junto.',
    card: false,
    examples: { bad: ['I can not come tomorrow.'], good: ['I cannot come tomorrow.'] },
  },
  // ── Ortografía y mayúsculas ──
  {
    id: 'spelling',
    type: 'spelling',
    severity: 'minor',
    pattern: new RegExp(`\\b(${Object.keys(SPELLING).join('|')})\\b`, 'gi'),
    find: (m) => ({ suggestion: SPELLING[(m[1] ?? '').toLowerCase()] ?? null }),
    explanation_es: 'Revisa cómo se escribe esta palabra.',
    examples: {
      bad: ['I like it becouse it is confortable.', 'The goverment has a new plan.'],
      good: ['I like it because it is comfortable.'],
    },
  },
  {
    id: 'lowercase-i',
    type: 'spelling',
    severity: 'minor',
    pattern: /(?<![\w'’.-])i(?=(?:['’](?:m|ve|ll|d))?(?![\w.)-]))/g,
    find: () => ({ suggestion: 'I' }),
    explanation_es: 'El pronombre *I* va siempre en mayúscula.',
    card: false,
    examples: {
      bad: ['Yesterday i went to the gym.', "i'm from Spain."],
      good: ['Yesterday I went to the gym.', 'I like tea, i.e. hot drinks.'],
    },
  },
  {
    id: 'lowercase-proper',
    type: 'spelling',
    severity: 'minor',
    pattern:
      /\b(english|spanish|french|german|italian|portuguese|chinese|japanese|british|european|spain|england|london|madrid|europe|france|germany|italy|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|august|september|october|november|december)\b/g,
    find: (m) => ({
      suggestion: `${(m[1] ?? '').charAt(0).toUpperCase()}${(m[1] ?? '').slice(1)}`,
    }),
    explanation_es:
      'Idiomas, nacionalidades, países, días de la semana y meses van con mayúscula en inglés.',
    card: false,
    examples: {
      bad: ['I study english on monday.', 'She is from spain.'],
      good: ['I study English on Monday.'],
    },
  },
  {
    id: 'sentence-capital',
    type: 'punctuation',
    severity: 'minor',
    pattern: /(?:^|(?<=[.!?]\s)|(?<=\n))[a-z]/g,
    find: (m, { before }) => {
      // Tras una abreviatura («etc. and») o unos puntos suspensivos la frase sigue.
      if (
        /(?:\b(?:e\.g|i\.e|etc|vs|approx|no|pp?|Dr|Mr|Mrs|Ms|St|[A-Za-z])\.|\.\.)\s$/.test(before)
      ) {
        return null;
      }
      return { suggestion: m[0].toUpperCase() };
    },
    explanation_es: 'Las frases empiezan con mayúscula.',
    card: false,
    examples: {
      bad: ['I like it. it is cheap.', 'hello Anna,'],
      good: [
        'I like it. It is cheap.',
        'We need pens, paper, etc. and some glue.',
        'It opens at 9 a.m. and closes late.',
      ],
    },
  },
  {
    id: 'space-before-punctuation',
    type: 'punctuation',
    severity: 'minor',
    pattern: /(\w)[ \t]+([,.;:!?])(?![.)(DPp/-])/g,
    find: sub('$1$2'),
    explanation_es: 'En inglés no hay espacio antes de la coma, el punto ni los signos de cierre.',
    card: false,
    examples: {
      bad: ['I like tea , coffee and juice .', 'Really ?'],
      good: ['I like tea, coffee and juice.', 'See you soon :)'],
    },
  },
  {
    id: 'missing-space',
    type: 'punctuation',
    severity: 'minor',
    pattern: /([a-zA-Z]{2,})([,;:!?])([a-zA-Z])|([a-z]{2,})\.([A-Z][a-z])/g,
    find: (m) => ({
      suggestion: m[4] ? `${m[4]}. ${m[5]}` : `${m[1]}${m[2]} ${m[3]}`,
    }),
    explanation_es: 'Después de un signo de puntuación va un espacio.',
    card: false,
    examples: {
      bad: ['I like tea,coffee and juice.', 'We went home.Then we had dinner.'],
      good: ['I like tea, coffee and juice.', 'It costs 1,000 euros.'],
    },
  },
  {
    id: 'repeated-word',
    type: 'spelling',
    severity: 'minor',
    pattern: /\b([a-z]+)\s+\1\b/gi,
    find: (m) => {
      if (
        /^(had|that|very|so|really|long|many|no|ha|bye|well|now|there|knock|far|much|more)$/i.test(
          m[1] ?? '',
        )
      ) {
        return null;
      }
      return { suggestion: m[1] ?? null };
    },
    explanation_es: 'La misma palabra aparece dos veces seguidas.',
    card: false,
    examples: {
      bad: ['I went to the the shop.', 'She is is my friend.'],
      good: ['I went to the shop.', 'He had had enough.', 'It was a very very long day.'],
    },
  },
  // ── Registro (solo en textos formales) ──
  {
    id: 'formal-contraction',
    type: 'register',
    severity: 'check',
    formalOnly: true,
    pattern: new RegExp(
      `(?<![\\w'’])(${Object.keys(CONTRACTIONS).join('|').replace(/'/g, "['’]")})(?![\\w'’])`,
      'gi',
    ),
    find: (m) => {
      const expanded = CONTRACTIONS[(m[1] ?? '').toLowerCase().replace(/’/g, "'")] ?? null;
      if (!expanded) return note();
      const capital = /^[A-Z]/.test(m[1] ?? '') && !expanded.startsWith('I ');
      return {
        suggestion: capital ? `${expanded.charAt(0).toUpperCase()}${expanded.slice(1)}` : expanded,
      };
    },
    explanation_es: 'En un ensayo, un informe o una propuesta se evitan las contracciones.',
    card: false,
    examples: {
      bad: ["Many people don't recycle.", "It's a serious problem."],
      good: ['Many people do not recycle.', 'It is a serious problem.'],
    },
  },
  {
    id: 'formal-informal-word',
    type: 'register',
    severity: 'check',
    formalOnly: true,
    pattern: new RegExp(`\\b(${Object.keys(INFORMAL).join('|')})\\b`, 'gi'),
    find: (m) => ({ suggestion: INFORMAL[(m[1] ?? '').toLowerCase()] ?? null }),
    explanation_es: 'Esta palabra es coloquial para un texto formal.',
    card: false,
    examples: {
      bad: ['Kids spend too much time online.', 'Schools need more stuff.'],
      good: ['Children spend too much time online.'],
    },
  },
  {
    id: 'formal-sentence-start',
    type: 'register',
    severity: 'check',
    formalOnly: true,
    pattern: new RegExp(`${START}(And|But|So)\\b(?=\\s)`, 'g'),
    find: (m) => ({
      suggestion: conj(
        { and: 'In addition,', but: 'However,', so: 'Therefore,' },
        m[1] ?? '',
        'In addition,',
      ),
    }),
    explanation_es:
      'En un texto formal, mejor no empezar la frase con *And / But / So*: *In addition, However, Therefore*.',
    grammar_ref: 'b2.linking-contrast-concession',
    card: false,
    examples: {
      bad: ['It is cheap. But it is slow.', 'And it saves time.'],
      good: ['It is cheap. However, it is slow.', 'It is cheap but slow.'],
    },
  },
  {
    id: 'formal-exclamation',
    type: 'register',
    severity: 'check',
    formalOnly: true,
    pattern: /!+/g,
    find: () => ({ suggestion: '.' }),
    explanation_es: 'Los signos de exclamación no encajan en un texto formal.',
    card: false,
    examples: {
      bad: ['This is a terrible idea!'],
      good: ['This is a terrible idea.'],
    },
  },
];
