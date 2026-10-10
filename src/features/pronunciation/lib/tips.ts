import { canonicalWords, type Assessment, type WordResult } from './assess';

// Consejos de pronunciación para quien habla español, cuando el reconocedor no ha entendido
// una palabra. Lógica pura. Salen de dos sitios: de cómo se escribe la palabra (letras mudas,
// *s* + consonante, *-ed*, *th*…) y de lo que se oyó en su lugar (si por *ship* oye *sheep*,
// el problema es la vocal). No analizan el audio: son los fallos más probables, no un
// diagnóstico (ADR-0015).

export interface Tip {
  /** Regla de la que sale: sirve para no repetir el mismo consejo. */
  id: string;
  /** Palabra a la que se refiere, tal como está escrita (en las frases). */
  word?: string;
  text_es: string;
}

const MAX_WORD_TIPS = 3;
const MAX_SENTENCE_WORDS = 3;

const clean = (word: string): string => word.toLowerCase().replace(/[^a-z]/g, '');

// ---------- Palabras con trampa: lo que se dice no es lo que se escribe ----------

const KNOWN: Record<string, string> = {
  comfortable: 'Tres sílabas, no cuatro: /ˈkʌmftəbl/, «KÁMF-ta-bl». La *or* desaparece.',
  vegetable: 'Tres sílabas: /ˈvedʒtəbl/, «VECH-ta-bl».',
  interesting: 'Tres sílabas: /ˈɪntrəstɪŋ/, «ÍN-tres-ting».',
  chocolate: 'Dos sílabas: /ˈtʃɒklət/, «CHÓ-klat».',
  different: 'Dos sílabas: /ˈdɪfrənt/, «DÍ-frent».',
  business: 'Dos sílabas: /ˈbɪznəs/. La *u* suena /ɪ/, la *i* no suena y la *s* es /z/.',
  wednesday: 'Dos sílabas: /ˈwenzdeɪ/, «UÉNS-dei». La primera *d* no suena.',
  restaurant: 'En inglés británico son dos sílabas: /ˈrestrɒnt/, «RÉS-tront».',
  temperature: 'Tres sílabas: /ˈtemprətʃə/, «TÉM-pra-cha».',
  every: 'Dos sílabas: /ˈevri/, «É-vri».',
  family: 'El acento va al principio: /ˈfæməli/, casi «FÁM-li».',
  camera: 'Dos sílabas: /ˈkæmrə/, «KÁM-ra».',
  favourite: 'Dos sílabas: /ˈfeɪvrɪt/, «FÉIV-rit».',
  favorite: 'Dos sílabas: /ˈfeɪvrɪt/, «FÉIV-rit».',
  several: 'Dos sílabas: /ˈsevrəl/, «SÉV-ral».',
  average: 'Dos sílabas: /ˈævrɪdʒ/, «ÁV-rich».',
  library: 'El acento va en *li-*, que suena «lai»: /ˈlaɪbrəri/.',
  february: 'El acento va en la primera sílaba: /ˈfebruəri/.',
  literature: 'Tres sílabas: /ˈlɪtrətʃə/, «LÍ-tra-cha».',
  actually: 'La *t* suena «ch»: /ˈæktʃuəli/.',
  usually: 'Empieza por «yu» y la *s* es /ʒ/, una «sh» con voz: /ˈjuːʒuəli/.',
  question: 'La *t* suena «ch»: /ˈkwestʃən/, «KUÉS-chan».',
  clothes:
    'Una sola sílaba: /kləʊðz/ (mucha gente dice /kləʊz/, igual que *close*). No digas «clo-thes».',
  months: 'Una sola sílaba: /mʌnθs/. Lengua entre los dientes para la *th* y enseguida la /s/.',
  asked: 'Una sola sílaba: /ɑːskt/. No digas «as-ked».',
  island: 'La *s* no suena: /ˈaɪlənd/, «ÁI-land».',
  answer: 'La *w* no suena: /ˈɑːnsə/, «ÁN-sa».',
  listen: 'La *t* no suena: /ˈlɪsn/.',
  often: 'La *t* normalmente no suena: /ˈɒfn/.',
  salmon: 'La *l* no suena: /ˈsæmən/.',
  receipt: 'La *p* no suena: /rɪˈsiːt/.',
  psychology: 'La *p* no suena y *ch* es /k/: /saɪˈkɒlədʒi/.',
  sign: 'La *g* no suena: /saɪn/.',
  foreign: 'La *g* no suena: /ˈfɒrən/.',
  design: 'La *g* no suena y la *s* es /z/: /dɪˈzaɪn/.',
  daughter: 'Las letras *gh* no suenan: /ˈdɔːtə/, «DÓ-ta».',
  though: 'Se dice /ðəʊ/: *gh* no suena.',
  through: 'Se dice /θruː/: *gh* no suena.',
  thought: 'Se dice /θɔːt/, con «o» larga: *gh* no suena.',
  eight: 'Se dice /eɪt/, igual que *ate*.',
  height: 'Se dice /haɪt/: rima con *light*, no con *eight*.',
  weight: 'Se dice /weɪt/, igual que *wait*.',
  friend: 'La *i* no suena: /frend/.',
  people: 'Se dice /ˈpiːpl/, «PÍ-pl»: la *o* no suena.',
  women: 'La *o* suena /ɪ/: /ˈwɪmɪn/, «UÍ-min».',
  woman: 'Se dice /ˈwʊmən/: una «u» corta y la segunda sílaba débil.',
  busy: 'La *u* suena /ɪ/ y la *s* es /z/: /ˈbɪzi/.',
  build: 'La *u* no suena: /bɪld/.',
  biscuit: 'La *u* no suena: /ˈbɪskɪt/.',
  fruit: 'Una sola sílaba: /fruːt/. La *i* no suena.',
  juice: 'Una sola sílaba: /dʒuːs/. La *i* no suena.',
  suit: 'Una sola sílaba: /suːt/. La *i* no suena.',
  heart: 'Con «a» larga: /hɑːt/. No suena como *heard*.',
  iron: 'La *r* no suena: /ˈaɪən/, «ÁI-an».',
  recipe: 'Tres sílabas y la *e* final suena «i»: /ˈresəpi/.',
  sure: 'Empieza por «sh»: /ʃɔː/.',
  sugar: 'Empieza por «sh»: /ˈʃʊɡə/.',
  vehicle: 'La *h* no suena: /ˈviːəkl/.',
  mountain: 'La segunda sílaba es débil: /ˈmaʊntən/, no «-tein».',
  certain: 'La segunda sílaba es débil: /ˈsɜːtn/, no «-tein».',
  captain: 'La segunda sílaba es débil: /ˈkæptɪn/, no «-tein».',
  village: 'Acaba en /ɪdʒ/, «-lich»: /ˈvɪlɪdʒ/. No digas «-leich».',
  language: 'Acaba en /wɪdʒ/, «-güich»: /ˈlæŋɡwɪdʒ/.',
  message: 'Acaba en /ɪdʒ/, «-sich»: /ˈmesɪdʒ/.',
  orange: 'Dos sílabas y acaba en /ndʒ/: /ˈɒrɪndʒ/.',
  country: 'La *ou* suena /ʌ/, como en *cup*: /ˈkʌntri/.',
  cousin: 'La *ou* suena /ʌ/ y la *s* es /z/: /ˈkʌzn/.',
  young: 'La *ou* suena /ʌ/, como en *cup*: /jʌŋ/.',
  touch: 'La *ou* suena /ʌ/, como en *cup*: /tʌtʃ/.',
  double: 'La *ou* suena /ʌ/: /ˈdʌbl/.',
  trouble: 'La *ou* suena /ʌ/: /ˈtrʌbl/.',
  blood: 'La *oo* suena /ʌ/, como en *cup*: /blʌd/.',
  flood: 'La *oo* suena /ʌ/, como en *cup*: /flʌd/.',
  does: 'Se dice /dʌz/, con la vocal de *cup* y /z/ final.',
  done: 'Se dice /dʌn/, con la vocal de *cup*.',
  one: 'Se dice /wʌn/: empieza por «u».',
  once: 'Se dice /wʌns/: empieza por «u».',
  said: 'Se dice /sed/, una sola vocal.',
  says: 'Se dice /sez/, una sola vocal.',
  any: 'Se dice /ˈeni/: la *a* suena «e».',
  many: 'Se dice /ˈmeni/: la *a* suena «e».',
  minute: 'Se dice /ˈmɪnɪt/: la *u* suena /ɪ/ y la *e* no suena.',
  private: 'La segunda sílaba es débil: /ˈpraɪvət/, no «-veit».',
  climate: 'La segunda sílaba es débil: /ˈklaɪmət/, no «-meit».',
  colonel: 'Se dice /ˈkɜːnl/, igual que *kernel*.',
  choir: 'Se dice /ˈkwaɪə/, «KUÁI-a».',
  queue: 'Se dice /kjuː/, como la letra *Q*.',
  idea: 'Tres sílabas con el acento en medio: /aɪˈdɪə/.',
  hotel: 'El acento va al final: /həʊˈtel/.',
  police: 'El acento va al final y la *i* es larga: /pəˈliːs/.',
  machine: 'El acento va al final y *ch* suena «sh»: /məˈʃiːn/.',
};

// ---------- Listas de excepciones de la ortografía ----------

const SILENT_H = new Set([
  'hour',
  'hours',
  'hourly',
  'honest',
  'honestly',
  'honesty',
  'honour',
  'honor',
  'heir',
]);
const SILENT_L = new Set([
  'walk',
  'talk',
  'chalk',
  'stalk',
  'half',
  'calf',
  'calm',
  'palm',
  'could',
  'would',
  'should',
  'folk',
  'yolk',
  'walked',
  'talked',
  'walking',
  'talking',
]);
const GH_F = new Set([
  'laugh',
  'laughed',
  'laughter',
  'laughing',
  'enough',
  'cough',
  'tough',
  'rough',
]);
const WH_H = new Set(['who', 'whose', 'whom', 'whole', 'whoever']);
const TH_VOICED = new Set([
  'the',
  'this',
  'that',
  'these',
  'those',
  'they',
  'them',
  'their',
  'theirs',
  'there',
  'then',
  'than',
  'thus',
  'therefore',
  'although',
  'with',
  'without',
  'within',
  'other',
  'others',
  'another',
  'mother',
  'father',
  'brother',
  'together',
  'weather',
  'whether',
  'either',
  'neither',
  'rather',
  'further',
  'gather',
  'leather',
  'feather',
  'breathe',
  'bathe',
  'smooth',
  'southern',
  'northern',
  'worthy',
  'themselves',
]);
const CH_K = new Set([
  'school',
  'chemistry',
  'chemical',
  'chemist',
  'character',
  'stomach',
  'ache',
  'headache',
  'toothache',
  'stomachache',
  'chaos',
  'chaotic',
  'chorus',
  'christmas',
  'christian',
  'technology',
  'technical',
  'technique',
  'mechanic',
  'mechanical',
  'architect',
  'architecture',
  'orchestra',
  'echo',
  'anchor',
  'scheme',
  'monarch',
  'archive',
  'orchid',
  'chord',
  'chronic',
]);
const CH_SH = new Set([
  'chef',
  'champagne',
  'moustache',
  'parachute',
  'brochure',
  'chic',
  'chalet',
]);
const NOT_PAST = new Set([
  'bed',
  'red',
  'fed',
  'led',
  'wed',
  'shed',
  'sled',
  'need',
  'feed',
  'seed',
  'weed',
  'speed',
  'bleed',
  'breed',
  'greed',
  'indeed',
  'exceed',
  'succeed',
  'proceed',
  'hundred',
  'sacred',
  'naked',
  'wicked',
  'beloved',
  'rugged',
  'ragged',
  'crooked',
  'wretched',
]);
const NOT_MAGIC_E = new Set([
  'have',
  'give',
  'live',
  'love',
  'come',
  'some',
  'done',
  'one',
  'gone',
  'none',
  'move',
  'prove',
  'lose',
  'whose',
  'glove',
  'dove',
  'shove',
  'were',
  'there',
  'where',
  'here',
  'sure',
]);
const ER_VOWEL = new Set([
  'learn',
  'heard',
  'earth',
  'early',
  'search',
  'pearl',
  'earn',
  'research',
  'thursday',
  'thirty',
  'thirteen',
  'birthday',
  'person',
  'perfect',
  'service',
  'nervous',
  'prefer',
  'return',
  'purple',
  'turkey',
  'furniture',
  'journey',
  'worker',
  'working',
  'german',
  'germany',
  'university',
]);
const STRESSED_END = new Set(['refer', 'deter', 'confer', 'occur', 'abhor', 'defer', 'infer']);
const FUNCTION_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'for',
  'and',
  'at',
  'from',
  'can',
  'was',
  'were',
  'have',
  'has',
  'do',
  'does',
  'are',
  'am',
  'is',
  'them',
  'him',
  'her',
  'you',
  'your',
  'some',
  'as',
  'but',
]);

// ---------- Reglas por cómo se escribe la palabra, de la más reveladora a la menos ----------

const TEXT = {
  silentH: 'En esta palabra la *h* es muda: empieza directamente por la vocal.',
  silentL: 'La *l* no suena en esta palabra.',
  kn: 'La *k* no suena: *kn-* se dice /n/.',
  wr: 'La *w* no suena: *wr-* se dice /r/.',
  mb: 'La *b* final no suena: la palabra acaba en /m/.',
  bt: 'La *b* no suena delante de la *t*.',
  ghF: 'Aquí *gh* suena /f/.',
  ghSilent: 'Las letras *gh* no suenan aquí.',
  silentT: 'La *t* no suena en esta palabra.',
  ps: 'La *p* inicial no suena: la palabra empieza por /s/.',
  sCluster:
    'Empieza directamente por la «sss», sin poner una «e» delante. Alarga la /s/ un instante y pasa a la consonante siguiente.',
  edT: 'El final *-ed* suena /t/, pegado a la consonante y sin añadir sílaba. No digas «-ed».',
  edD: 'El final *-ed* suena /d/, pegado al sonido anterior y sin añadir sílaba. No digas «-ed».',
  edId: 'Después de /t/ o /d/, el final *-ed* sí añade una sílaba: /ɪd/.',
  edAny:
    'El final *-ed* no añade sílaba: es solo una /t/ o una /d/ pegada al final. No digas «-ed».',
  thVoiceless:
    'La *th* es /θ/: saca la punta de la lengua entre los dientes y sopla, como la «z» de *zapato* en el centro y norte de España. No digas /s/, /t/ ni /f/.',
  thVoiced:
    'Aquí la *th* es /ð/: lengua entre los dientes y con voz, parecida a la «d» suave de *nada*. No golpees como en una /d/.',
  v: 'La *v* no es una «b»: apoya los dientes de arriba en el labio de abajo y deja vibrar el aire, como una «f» con voz.',
  b: 'La *b* inglesa cierra los dos labios del todo y los suelta de golpe.',
  h: 'La *h* suena: un soplo de aire suave antes de la vocal, como al empañar un cristal. No es la «j» española ni se omite.',
  whH: 'Aquí *wh-* suena /h/.',
  w: 'La *w* se hace redondeando los labios, como una «u» muy breve. No pongas una «g» delante.',
  j: 'El sonido es /dʒ/: como una «ch» pero con voz. No es la «y» ni la «j» españolas.',
  y: 'La *y* inicial es /j/, una «i» muy breve y sin roce. No la conviertas en /dʒ/.',
  sh: '*sh* es /ʃ/: el sonido de mandar callar, «shhh», continuo y sin golpe. No es «ch» ni «s».',
  ch: '*ch* es /tʃ/, como la «ch» española: empieza con un golpe.',
  chK: 'En esta palabra *ch* suena /k/.',
  chSh: 'En esta palabra *ch* suena «sh», /ʃ/.',
  tion: 'La terminación *-tion* se dice /ʃn/, «shn», en una sola sílaba débil. El acento va justo antes.',
  sion: 'La terminación *-sion* se dice /ʒn/ o /ʃn/, en una sola sílaba débil. El acento va justo antes.',
  ture: 'La terminación *-ture* se dice /tʃə/, «cha»: *picture* es «PÍK-cha».',
  ous: 'La terminación *-ous* es débil: /əs/, no «ous».',
  able: 'La terminación *-able* o *-ible* es débil: /əbl/, sin vocal clara.',
  er: 'La vocal es /ɜː/: boca entreabierta, labios relajados y lengua en el centro, larga. No pronuncies la vocal que ves escrita.',
  magicE:
    'La *e* final no se pronuncia: solo cambia la vocal anterior. La palabra tiene una sílaba menos de lo que parece.',
  ee: 'La vocal es /iː/, larga y tensa: sonríe y alárgala.',
  shortI: 'La vocal es /ɪ/, corta y relajada, entre «i» y «e». Si la alargas, se oye otra palabra.',
  ae: 'La vocal es /æ/: abre mucho la boca y estira los labios, entre «a» y «e».',
  uh: 'La vocal es /ʌ/: corta y relajada, con la boca poco abierta. No es una «a» abierta ni una «u».',
  aw: 'La vocal es /ɔː/: una «o» larga con los labios redondeados.',
  shortU: 'La vocal es /ʊ/, corta y relajada. No la alargues.',
  longU: 'La vocal es /uː/, larga y con los labios muy redondeados.',
  vowel:
    'Las consonantes las ha entendido; lo que cambia es la vocal. Escucha el modelo en «Despacio» y copia cuánto dura y cuánto se abre la boca.',
  finalM: 'Cierra los labios al final: es /m/, no /n/.',
  ng: 'El final *-ng* es /ŋ/: el aire sale por la nariz con la lengua atrás. No sueltes una /g/ ni lo conviertas en /n/.',
  finalCluster:
    'Pronuncia todas las consonantes del final, una detrás de otra y sin vocal de apoyo. Acaba la palabra del todo.',
  finalVoiced:
    'La consonante final es sonora: hazla vibrar y alarga un poco la vocal de antes. Si la cortas, se oye otra palabra.',
  finalVoiceless: 'La consonante final es sorda: corta la vocal y suéltala seca, sin voz.',
  finalMissing:
    'No se ha oído el final de la palabra: pronuncia la última consonante con claridad.',
  z: 'Ese sonido es /z/, una /s/ con voz: debe zumbar, y la vocal de antes se alarga.',
  sVoiceless: 'Ese sonido es /s/, sin voz: una «s» seca, y la vocal de antes es corta.',
  schwaEnd:
    'La última sílaba es débil: una vocal neutra /ə/, casi sin abrir la boca. No marques la *r* final ni la vocal escrita.',
  longWord:
    'En las palabras largas, una sílaba lleva toda la fuerza y las demás se dicen rápidas y con vocal débil /ə/. Escucha cuál es la fuerte en el modelo y exagérala.',
  genericWord:
    'Escucha el modelo en «Despacio», cuenta las sílabas y fíjate en cuál suena más fuerte. Después dilo exagerando esa sílaba.',
  weakForms:
    'Las palabras pequeñas (*to, of, for, and, can*) se dicen débiles y pegadas a la siguiente, pero no desaparecen.',
  genericSentence:
    'Di la frase por trozos de dos o tres palabras y luego únelos sin pausas. Empieza despacio.',
} as const;

/** Vocales seguidas que cuentan como una sílaba; la *e* final muda no cuenta. */
function syllables(word: string): number {
  const groups = word.replace(/([^aeiouy])e$/, '$1').match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Cómo suena el final *-ed* de un pasado regular, o `null` si la palabra no lo es. */
function edEnding(word: string): 'edT' | 'edD' | 'edId' | 'edAny' | null {
  if (!word.endsWith('ed') || word.length < 4 || NOT_PAST.has(word)) return null;
  const stem = word.slice(0, -2);
  if (/[td]$/.test(stem)) return 'edId';
  if (stem.endsWith('gh')) return GH_F.has(stem) ? 'edT' : 'edD';
  if (/(p|k|f|x|c|ss|sh|ch|ph)$/.test(stem)) return 'edT';
  // Tras una sola *s* puede ser /t/ (*based*) o /d/ (*closed*).
  if (stem.endsWith('s')) return 'edAny';
  return 'edD';
}

const ONE_FINAL_SOUND = /(ng|gh|ck|ll|ss|ff|tt|zz|sh|ch|th|ph|mb|wn|gn)$/;

interface Feature {
  id: string;
  text: (word: string) => string | null;
}

/** Lo que la ortografía de la palabra deja prever, por orden de importancia. */
const FEATURES: Feature[] = [
  { id: 'known', text: (w) => KNOWN[w] ?? null },
  { id: 'h', text: (w) => (SILENT_H.has(w) ? TEXT.silentH : null) },
  { id: 'silent-l', text: (w) => (SILENT_L.has(w) ? TEXT.silentL : null) },
  { id: 'kn', text: (w) => (w.startsWith('kn') ? TEXT.kn : null) },
  { id: 'wr', text: (w) => (w.startsWith('wr') ? TEXT.wr : null) },
  { id: 'mb', text: (w) => (/mb(s|ed|ing)?$/.test(w) ? TEXT.mb : null) },
  { id: 'bt', text: (w) => (/(deb|doub|sub)t/.test(w) ? TEXT.bt : null) },
  {
    id: 'gh',
    text: (w) => (w.includes('gh') ? (GH_F.has(w) ? TEXT.ghF : TEXT.ghSilent) : null),
  },
  { id: 'silent-t', text: (w) => (/(stle|sten)(s|ed|ing)?$/.test(w) ? TEXT.silentT : null) },
  { id: 'ps', text: (w) => (/^p[sn]/.test(w) ? TEXT.ps : null) },
  { id: 's-cluster', text: (w) => (/^s[bcdfgklmnpqtvw]/.test(w) ? TEXT.sCluster : null) },
  {
    id: 'ed',
    text: (w) => {
      const ending = edEnding(w);
      return ending ? TEXT[ending] : null;
    },
  },
  {
    id: 'th',
    text: (w) => (w.includes('th') ? (TH_VOICED.has(w) ? TEXT.thVoiced : TEXT.thVoiceless) : null),
  },
  { id: 'v', text: (w) => (w.includes('v') ? TEXT.v : null) },
  {
    id: 'ch',
    text: (w) => (CH_K.has(w) ? TEXT.chK : CH_SH.has(w) ? TEXT.chSh : null),
  },
  { id: 'tion', text: (w) => (/tions?$/.test(w) ? TEXT.tion : null) },
  { id: 'sion', text: (w) => (/sions?$/.test(w) ? TEXT.sion : null) },
  {
    id: 'ture',
    text: (w) => (/tures?$/.test(w) && w.length > 5 && !/mature$/.test(w) ? TEXT.ture : null),
  },
  { id: 'ous', text: (w) => (/ous$/.test(w) && w.length > 4 ? TEXT.ous : null) },
  {
    id: 'able',
    // *stable*, *enable* o *unable* conservan la vocal entera.
    text: (w) =>
      /[^t](a|i)ble$/.test(w) && w.length > 5 && !/^(en|un|dis)able$/.test(w) ? TEXT.able : null,
  },
  { id: 'h', text: (w) => (WH_H.has(w) ? TEXT.whH : null) },
  { id: 'h', text: (w) => (w.startsWith('h') && !SILENT_H.has(w) ? TEXT.h : null) },
  { id: 'j', text: (w) => (/^j|dge|[^aeiou]ge$|^gen|^gian|^gym/.test(w) ? TEXT.j : null) },
  { id: 'sh', text: (w) => (w.includes('sh') ? TEXT.sh : null) },
  {
    id: 'er',
    text: (w) =>
      ER_VOWEL.has(w) ||
      (syllables(w) === 1 && /(^|[^aeiou])(ir|ur)(?![aeiouyr])/.test(w)) ||
      /^wh?or[^aeiouyrn]/.test(w)
        ? TEXT.er
        : null,
  },
  {
    id: 'magic-e',
    text: (w) =>
      /^[^aeiou]*[aiou][^aeiouwyr]e$/.test(w) && !NOT_MAGIC_E.has(w) ? TEXT.magicE : null,
  },
  { id: 'w', text: (w) => (/^w(?!r)/.test(w) && !WH_H.has(w) ? TEXT.w : null) },
  { id: 'y', text: (w) => (/^y[aeiou]/.test(w) ? TEXT.y : null) },
  {
    id: 'final-cluster',
    text: (w) =>
      /[bcdfgklmnpstvxz]{2,}$/.test(w) &&
      !ONE_FINAL_SOUND.test(w) &&
      !SILENT_L.has(w) &&
      edEnding(w) === null
        ? TEXT.finalCluster
        : null,
  },
  {
    id: 'final-voiced',
    text: (w) => (/[aeiouy][bdg]$/.test(w) && edEnding(w) === null ? TEXT.finalVoiced : null),
  },
  { id: 'final-m', text: (w) => (/m$/.test(w) && w.length > 2 ? TEXT.finalM : null) },
  { id: 'ng', text: (w) => (/ng$/.test(w) ? TEXT.ng : null) },
  { id: 'ee', text: (w) => (w.includes('ee') ? TEXT.ee : null) },
  {
    id: 'schwa-end',
    // Con el acento al final (*prefer*, *occur*) la sílaba no es débil.
    text: (w) =>
      syllables(w) >= 2 && /(er|or|our)s?$/.test(w) && !ER_VOWEL.has(w) && !STRESSED_END.has(w)
        ? TEXT.schwaEnd
        : null,
  },
  { id: 'long-word', text: (w) => (syllables(w) >= 3 ? TEXT.longWord : null) },
];

// ---------- Pistas por lo que se oyó en lugar de la palabra ----------

/** Consonantes de la palabra, sin letras dobles: lo que queda igual si solo cambia la vocal. */
const skeleton = (word: string): string =>
  word.replace(/(?!^)y|[aeiou]/g, '').replace(/(.)\1+/g, '$1');
const VOICING: [string, string][] = [
  ['g', 'k'],
  ['g', 'ck'],
  ['d', 't'],
  ['b', 'p'],
  ['v', 'f'],
  ['ve', 'fe'],
];

/**
 * Qué señala lo que se oyó: reglas que pasan a ir las primeras y consejos que solo tienen
 * sentido al comparar (una vocal por otra, un final sordo por uno sonoro).
 */
function evidence(word: string, heardText: string): Tip[] {
  const heardWords = heardText.toLowerCase().split(/\s+/).map(clean).filter(Boolean);
  const heard = heardWords.join('');
  const found: Tip[] = [];
  const add = (id: string, text: string) => found.push({ id, text_es: text });
  if (!heard || heard === word) return found;

  // Cada pista exige que el resto de la palabra se parezca: si se oyó algo que no tiene nada
  // que ver, no señala ningún sonido en concreto.
  const loose = (text: string) => skeleton(text).replace(/[rl]/g, '');

  if (
    /^s[bcdfgklmnpqtvw]/.test(word) &&
    (heardWords.length > 1 || /^[aeiou]/.test(heard)) &&
    // Basta con que se reconozca el arranque de la palabra: el final puede haberse perdido.
    skeleton(heard).includes(skeleton(word).slice(1, 3))
  ) {
    add('s-cluster', TEXT.sCluster);
  }
  if (
    word.includes('th') &&
    !heard.includes('th') &&
    (['s', 't', 'd', 'f', 'z', 'v'].some((letter) => word.replace('th', letter) === heard) ||
      (word.startsWith('th') &&
        /^[stdfzv]/.test(heard) &&
        loose(word.slice(2)) === loose(heard.slice(1))))
  ) {
    add('th', TH_VOICED.has(word) ? TEXT.thVoiced : TEXT.thVoiceless);
  }
  if (word.includes('v') && skeleton(word).replace(/v/g, 'b') === skeleton(heard)) {
    add('v', TEXT.v);
  }
  if (word.includes('b') && skeleton(word).replace(/b/g, 'v') === skeleton(heard)) {
    add('b', TEXT.b);
  }
  if (
    word.startsWith('h') &&
    !SILENT_H.has(word) &&
    /^[aeiou]/.test(heard) &&
    loose(word.slice(1)) === loose(heard)
  ) {
    add('h', TEXT.h);
  }
  if (
    word.startsWith('w') &&
    /^(g|b)/.test(heard) &&
    loose(word.slice(1)) === loose(heard.replace(/^(gu|g|b)/, ''))
  ) {
    add('w', TEXT.w);
  }
  if (word.startsWith('j') && heard === `y${word.slice(1)}`) add('j', TEXT.j);
  if (word.startsWith('y') && heard === `j${word.slice(1)}`) add('y', TEXT.y);

  if (
    word.includes('sh') &&
    [word.replace('sh', 'ch'), word.replace('sh', 'tch')].includes(heard)
  ) {
    add('sh', TEXT.sh);
  }
  if ([word.replace('tch', 'sh'), word.replace('ch', 'sh')].includes(heard) && word !== heard) {
    add('ch', TEXT.ch);
  }

  // El final se compara también con la última palabra oída: «a stop» por *stopped*.
  const tail = heardWords.at(-1) ?? heard;
  const ending = edEnding(word);
  const stems = [word.slice(0, -2), word.slice(0, -1), word.slice(0, -3)];
  if (ending && (stems.includes(heard) || stems.includes(tail))) {
    add('ed', TEXT[ending]);
  } else if (
    /[^aeiou]$/.test(word) &&
    word.length > 2 &&
    [heard, tail].includes(word.slice(0, -1))
  ) {
    add('final-missing', TEXT.finalMissing);
  }

  for (const [voiced, voiceless] of VOICING) {
    if (word.endsWith(voiced) && heard === word.slice(0, -voiced.length) + voiceless) {
      add('final-voiced', TEXT.finalVoiced);
    }
    if (word.endsWith(voiceless) && heard === word.slice(0, -voiceless.length) + voiced) {
      add('final-voiceless', TEXT.finalVoiceless);
    }
  }
  if (
    [word.replace(/z/g, 'c'), word.replace(/z/g, 's'), word.replace(/s(?=e$)/, 'c')].includes(heard)
  ) {
    add('z', TEXT.z);
  }
  if (
    [word.replace(/c(?=e$)/, 'z'), word.replace(/c(?=e$)/, 's'), word.replace(/s$/, 'zz')].includes(
      heard,
    )
  ) {
    add('s-voiceless', TEXT.sVoiceless);
  }
  if (/me?$/.test(word) && heard === word.replace(/m(e?)$/, 'n$1')) add('final-m', TEXT.finalM);

  // La vocal /ɜː/ (*work*) frente a las que se le parecen (*walk*): solo cambian la vocal y la r o la l.
  const erVowel = FEATURES.find((feature) => feature.id === 'er')?.text(word);
  if (erVowel && loose(word) === loose(heard)) add('er', TEXT.er);
  else if (/al[kl]|aw|au/.test(word) && loose(word) === loose(heard)) add('aw', TEXT.aw);

  if (found.length === 0 && skeleton(word) === skeleton(heard)) {
    const long = /ee|ea|ie|[^aeiou]e[^aeiou]e$/;
    if (word.includes('i') && !long.test(word) && long.test(heard)) add('short-i', TEXT.shortI);
    else if (long.test(word) && heard.includes('i') && !long.test(heard)) add('ee', TEXT.ee);
    else if (word.includes('a') && heard.includes('u') && !word.includes('u')) add('ae', TEXT.ae);
    else if (word.includes('u') && heard.includes('a') && !word.includes('a')) add('uh', TEXT.uh);
    else if (word.includes('u') && heard.includes('oo')) add('short-u', TEXT.shortU);
    else if (word.includes('oo') && heard.includes('u')) add('long-u', TEXT.longU);
    else add('vowel', TEXT.vowel);
  }
  return found;
}

/**
 * Consejos para una palabra que no se ha entendido: primero lo que señala lo que se oyó en su
 * lugar y después lo que su ortografía deja prever. Sin repetir y con tope.
 */
export function wordTips(word: string, heard = '', limit = MAX_WORD_TIPS): Tip[] {
  const target = clean(word);
  if (!target) return [];
  const tips: Tip[] = [];
  const seen = new Set<string>();
  const push = (tip: Tip) => {
    if (seen.has(tip.id) || seen.has(tip.text_es)) return;
    seen.add(tip.id);
    seen.add(tip.text_es);
    tips.push(tip);
  };

  // Una palabra con trampa conocida explica el fallo mejor que cualquier regla general.
  const known = KNOWN[target];
  if (known) push({ id: 'known', text_es: known });

  // Si lo que se oyó señala un fallo concreto, lo demás se ha entendido: no hace falta
  // adivinar más. El aviso genérico de «cambia la vocal» no cuenta como concreto.
  const clues = evidence(target, heard);
  const specific = clues.filter((tip) => tip.id !== 'vowel');
  for (const tip of specific) push(tip);
  if (specific.length === 0) {
    if (!known) for (const tip of clues) push(tip);
    for (const feature of FEATURES) {
      const text = feature.text(target);
      if (text) push({ id: feature.id, text_es: text });
    }
  }
  if (tips.length === 0) push({ id: 'generic-word', text_es: TEXT.genericWord });
  return tips.slice(0, limit);
}

/**
 * Consejos tras un intento que no ha salido perfecto. Con una sola palabra, hasta tres sobre
 * ella. En una frase, uno por cada palabra fallada (hasta tres) y, si procede, uno sobre el
 * ritmo. El consejo que trae el ejercicio para la confusión detectada va siempre el primero.
 */
export function buildTips(target: string, assessment: Assessment): Tip[] {
  if (assessment.verdict === 'good') return [];
  const tips: Tip[] = [];
  if (assessment.confusion) tips.push({ id: 'confusion', text_es: assessment.confusion.tip_es });
  const texts = new Set(tips.map((tip) => tip.text_es));
  const add = (tip: Tip) => {
    if (texts.has(tip.text_es)) return;
    texts.add(tip.text_es);
    tips.push(tip);
  };

  const words = assessment.words;
  if (words.length <= 1) {
    // La confusión que prevé el ejercicio ya es el diagnóstico: no hace falta adivinar más.
    if (tips.length > 0) return tips;
    const [only] = words;
    for (const tip of wordTips(only?.text ?? target, assessment.heard)) add(tip);
    return tips;
  }

  const missed = words.filter((word) => word.status !== 'ok');
  const content = missed.filter((word) => !isFunctionWord(word));
  for (const word of content.slice(0, MAX_SENTENCE_WORDS)) {
    const [tip] = wordTips(word.text, word.heard ?? '', 1);
    if (!tip) continue;
    const label = word.text.replace(/[^\p{L}'-]/gu, '');
    // El mismo consejo para dos palabras se da una vez, nombrando las dos.
    const same = tips.find((other) => other.text_es === tip.text_es && other.word);
    if (same) same.word = `${same.word}, ${label}`;
    else add({ ...tip, word: label });
  }
  if (missed.some(isFunctionWord)) add({ id: 'weak-forms', text_es: TEXT.weakForms });
  if (assessment.verdict === 'retry' || tips.length === 0) {
    add({ id: 'generic-sentence', text_es: TEXT.genericSentence });
  }
  return tips;
}

function isFunctionWord(word: WordResult): boolean {
  const [first, ...rest] = canonicalWords(word.text);
  return rest.length === 0 && first !== undefined && FUNCTION_WORDS.has(first);
}
