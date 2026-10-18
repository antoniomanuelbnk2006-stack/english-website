import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Léxico del español para el pipeline: forma → lema y categoría gramatical (UPOS). No hay un
// lematizador de español libre y ligero en el proyecto (ADR-0038), así que las formas se
// generan: las palabras de contenido salen del mazo (`content/es/dictionary/*.json`) con sus
// terminaciones regulares, y lo irregular y las palabras gramaticales están en las tablas de
// abajo. Una forma que no está aquí no se adivina: el pipeline avisa y se añade a mano.

export type Upos =
  | 'NOUN'
  | 'VERB'
  | 'AUX'
  | 'ADJ'
  | 'ADV'
  | 'DET'
  | 'PRON'
  | 'ADP'
  | 'CCONJ'
  | 'SCONJ'
  | 'NUM'
  | 'INTJ'
  | 'PART'
  | 'PROPN';

export interface Analysis {
  lemma: string;
  pos: Upos;
}

const POS_OF_DECK: Record<string, Upos> = {
  noun: 'NOUN',
  verb: 'VERB',
  adjective: 'ADJ',
  adverb: 'ADV',
  preposition: 'ADP',
  pronoun: 'PRON',
  determiner: 'DET',
  conjunction: 'CCONJ',
  number: 'NUM',
  interjection: 'INTJ',
  modal: 'AUX',
  auxiliary: 'AUX',
  particle: 'PART',
};

// ───────────── Palabras gramaticales: «lema POS: formas» ─────────────
const CLOSED = `
el DET: el la los las
un DET: un una unos unas
mi DET: mi mis
tu DET: tu tus
su DET: su sus
nuestro DET: nuestro nuestra nuestros nuestras
vuestro DET: vuestro vuestra vuestros vuestras
este DET: este esta estos estas
ese DET: ese esa esos esas
aquel DET: aquel aquella aquellos aquellas
todo DET: todo toda todos todas
otro DET: otro otra otros otras
mucho DET: mucho mucha muchos muchas
poco DET: poco poca pocos pocas
algún DET: algún alguna algunos algunas alguno
ningún DET: ningún ninguna ninguno ningunos
cada DET: cada
varios DET: varios varias
mismo DET: mismo misma mismos mismas
yo PRON: yo me mí conmigo
tú PRON: tú te ti contigo
él PRON: él lo le
ella PRON: ella
usted PRON: usted ustedes
nosotros PRON: nosotros nosotras nos
vosotros PRON: vosotros vosotras os
ellos PRON: ellos ellas les
se PRON: se
esto PRON: esto eso aquello
algo PRON: algo alguien nada nadie
qué PRON: qué quién quiénes cuál cuáles
quien PRON: quien quienes cual
cuánto PRON: cuánto cuánta cuántos cuántas
a ADP: a al
de ADP: de del
en ADP: en
con ADP: con
por ADP: por
para ADP: para
sin ADP: sin
sobre ADP: sobre
entre ADP: entre
hacia ADP: hacia
hasta ADP: hasta
desde ADP: desde
según ADP: según
durante ADP: durante
contra ADP: contra
bajo ADP: bajo
ante ADP: ante
tras ADP: tras
y CCONJ: y e
o CCONJ: o u
pero CCONJ: pero
sino CCONJ: sino
ni CCONJ: ni
que SCONJ: que
porque SCONJ: porque
si SCONJ: si
aunque SCONJ: aunque
mientras SCONJ: mientras
pues SCONJ: pues
cuando SCONJ: cuando
donde SCONJ: donde
como SCONJ: como
no ADV: no
también ADV: también
tampoco ADV: tampoco
muy ADV: muy
más ADV: más
menos ADV: menos
bastante ADV: bastante
demasiado ADV: demasiado
tan ADV: tan
tanto ADV: tanto tanta tantos tantas
ya ADV: ya
todavía ADV: todavía aún
siempre ADV: siempre
nunca ADV: nunca jamás
hoy ADV: hoy
ayer ADV: ayer
ahora ADV: ahora
luego ADV: luego
después ADV: después
antes ADV: antes
pronto ADV: pronto
temprano ADV: temprano
aquí ADV: aquí
ahí ADV: ahí
allí ADV: allí allá
acá ADV: acá
cerca ADV: cerca
lejos ADV: lejos
dentro ADV: dentro
fuera ADV: fuera
encima ADV: encima
debajo ADV: debajo
delante ADV: delante
detrás ADV: detrás
bien ADV: bien
mal ADV: mal
mejor ADV: mejor
peor ADV: peor
así ADV: así
casi ADV: casi
solo ADV: solo
además ADV: además
entonces ADV: entonces
quizás ADV: quizás
dónde ADV: dónde
cuándo ADV: cuándo
cómo ADV: cómo
por qué ADV: por qué
sí INTJ: sí
hola INTJ: hola
adiós INTJ: adiós
gracias INTJ: gracias
vale INTJ: vale
perdón INTJ: perdón
oye INTJ: oye
cero NUM: cero
uno NUM: uno
dos NUM: dos
tres NUM: tres
cuatro NUM: cuatro
cinco NUM: cinco
seis NUM: seis
siete NUM: siete
ocho NUM: ocho
nueve NUM: nueve
diez NUM: diez
once NUM: once
doce NUM: doce
trece NUM: trece
catorce NUM: catorce
quince NUM: quince
dieciséis NUM: dieciséis
diecisiete NUM: diecisiete
dieciocho NUM: dieciocho
diecinueve NUM: diecinueve
veinte NUM: veinte
veintiuno NUM: veintiuno veintiuna
veintidós NUM: veintidós
veintitrés NUM: veintitrés
veinticuatro NUM: veinticuatro
veinticinco NUM: veinticinco
treinta NUM: treinta
cuarenta NUM: cuarenta
cincuenta NUM: cincuenta
sesenta NUM: sesenta
setenta NUM: setenta
ochenta NUM: ochenta
noventa NUM: noventa
cien NUM: cien ciento
mil NUM: mil
primero NUM: primero primera primeros primeras
segundo NUM: segundo segunda
tercero NUM: tercero tercera
`;

// ───────────── Verbos irregulares: formas por tiempo ─────────────
interface Irregular {
  present: string;
  preterite?: string;
  imperfect?: string;
  gerund: string;
  participle: string;
  imperative?: string;
  pos?: Upos;
}

const IRREGULAR: Record<string, Irregular> = {
  ser: {
    present: 'soy eres es somos sois son',
    preterite: 'fui fuiste fue fuimos fuisteis fueron',
    imperfect: 'era eras era éramos erais eran',
    gerund: 'siendo',
    participle: 'sido',
    imperative: 'sé sea sed sean',
    pos: 'AUX',
  },
  estar: {
    present: 'estoy estás está estamos estáis están',
    preterite: 'estuve estuviste estuvo estuvimos estuvisteis estuvieron',
    imperfect: 'estaba estabas estaba estábamos estabais estaban',
    gerund: 'estando',
    participle: 'estado',
    imperative: 'está esté estad estén',
    pos: 'AUX',
  },
  haber: {
    present: 'he has ha hemos habéis han hay',
    preterite: 'hube hubiste hubo hubimos hubisteis hubieron',
    imperfect: 'había habías había habíamos habíais habían',
    gerund: 'habiendo',
    participle: 'habido',
    pos: 'AUX',
  },
  ir: {
    present: 'voy vas va vamos vais van',
    preterite: 'fui fuiste fue fuimos fuisteis fueron',
    imperfect: 'iba ibas iba íbamos ibais iban',
    gerund: 'yendo',
    participle: 'ido',
    imperative: 've vaya id vayan vamos',
  },
  tener: {
    present: 'tengo tienes tiene tenemos tenéis tienen',
    preterite: 'tuve tuviste tuvo tuvimos tuvisteis tuvieron',
    imperfect: 'tenía tenías tenía teníamos teníais tenían',
    gerund: 'teniendo',
    participle: 'tenido',
    imperative: 'ten tenga tened tengan',
  },
  hacer: {
    present: 'hago haces hace hacemos hacéis hacen',
    preterite: 'hice hiciste hizo hicimos hicisteis hicieron',
    imperfect: 'hacía hacías hacía hacíamos hacíais hacían',
    gerund: 'haciendo',
    participle: 'hecho hecha hechos hechas',
    imperative: 'haz haga haced hagan',
  },
  decir: {
    present: 'digo dices dice decimos decís dicen',
    preterite: 'dije dijiste dijo dijimos dijisteis dijeron',
    imperfect: 'decía decías decía decíamos decíais decían',
    gerund: 'diciendo',
    participle: 'dicho dicha dichos dichas',
    imperative: 'di diga decid digan',
  },
  poder: {
    present: 'puedo puedes puede podemos podéis pueden',
    preterite: 'pude pudiste pudo pudimos pudisteis pudieron',
    imperfect: 'podía podías podía podíamos podíais podían',
    gerund: 'pudiendo',
    participle: 'podido',
  },
  querer: {
    present: 'quiero quieres quiere queremos queréis quieren',
    preterite: 'quise quisiste quiso quisimos quisisteis quisieron',
    imperfect: 'quería querías quería queríamos queríais querían',
    gerund: 'queriendo',
    participle: 'querido querida queridos queridas',
    imperative: 'quiere quiera quered quieran',
  },
  venir: {
    present: 'vengo vienes viene venimos venís vienen',
    preterite: 'vine viniste vino vinimos vinisteis vinieron',
    imperfect: 'venía venías venía veníamos veníais venían',
    gerund: 'viniendo',
    participle: 'venido',
    imperative: 'ven venga venid vengan',
  },
  saber: {
    present: 'sé sabes sabe sabemos sabéis saben',
    preterite: 'supe supiste supo supimos supisteis supieron',
    imperfect: 'sabía sabías sabía sabíamos sabíais sabían',
    gerund: 'sabiendo',
    participle: 'sabido',
    imperative: 'sabe sepa sabed sepan',
  },
  ver: {
    present: 'veo ves ve vemos veis ven',
    preterite: 'vi viste vio vimos visteis vieron',
    imperfect: 'veía veías veía veíamos veíais veían',
    gerund: 'viendo',
    participle: 'visto vista vistos vistas',
    imperative: 'mira vea ved vean',
  },
  dar: {
    present: 'doy das da damos dais dan',
    preterite: 'di diste dio dimos disteis dieron',
    imperfect: 'daba dabas daba dábamos dabais daban',
    gerund: 'dando',
    participle: 'dado',
    imperative: 'da dé dad den',
  },
  poner: {
    present: 'pongo pones pone ponemos ponéis ponen',
    preterite: 'puse pusiste puso pusimos pusisteis pusieron',
    imperfect: 'ponía ponías ponía poníamos poníais ponían',
    gerund: 'poniendo',
    participle: 'puesto puesta puestos puestas',
    imperative: 'pon ponga poned pongan',
  },
  salir: {
    present: 'salgo sales sale salimos salís salen',
    preterite: 'salí saliste salió salimos salisteis salieron',
    imperfect: 'salía salías salía salíamos salíais salían',
    gerund: 'saliendo',
    participle: 'salido',
    imperative: 'sal salga salid salgan',
  },
  traer: {
    present: 'traigo traes trae traemos traéis traen',
    preterite: 'traje trajiste trajo trajimos trajisteis trajeron',
    imperfect: 'traía traías traía traíamos traíais traían',
    gerund: 'trayendo',
    participle: 'traído',
    imperative: 'trae traiga traed traigan',
  },
  oír: {
    present: 'oigo oyes oye oímos oís oyen',
    preterite: 'oí oíste oyó oímos oísteis oyeron',
    imperfect: 'oía oías oía oíamos oíais oían',
    gerund: 'oyendo',
    participle: 'oído',
    imperative: 'oye oiga oíd oigan',
  },
  leer: {
    present: 'leo lees lee leemos leéis leen',
    preterite: 'leí leíste leyó leímos leísteis leyeron',
    imperfect: 'leía leías leía leíamos leíais leían',
    gerund: 'leyendo',
    participle: 'leído leída leídos leídas',
    imperative: 'lee lea leed lean',
  },
  conocer: {
    present: 'conozco conoces conoce conocemos conocéis conocen',
    preterite: 'conocí conociste conoció conocimos conocisteis conocieron',
    imperfect: 'conocía conocías conocía conocíamos conocíais conocían',
    gerund: 'conociendo',
    participle: 'conocido conocida conocidos conocidas',
    imperative: 'conoce conozca conoced conozcan',
  },
  escribir: {
    present: 'escribo escribes escribe escribimos escribís escriben',
    preterite: 'escribí escribiste escribió escribimos escribisteis escribieron',
    imperfect: 'escribía escribías escribía escribíamos escribíais escribían',
    gerund: 'escribiendo',
    participle: 'escrito escrita escritos escritas',
    imperative: 'escribe escriba escribid escriban',
  },
  abrir: {
    present: 'abro abres abre abrimos abrís abren',
    preterite: 'abrí abriste abrió abrimos abristeis abrieron',
    imperfect: 'abría abrías abría abríamos abríais abrían',
    gerund: 'abriendo',
    participle: 'abierto abierta abiertos abiertas',
    imperative: 'abre abra abrid abran',
  },
  jugar: {
    present: 'juego juegas juega jugamos jugáis juegan',
    preterite: 'jugué jugaste jugó jugamos jugasteis jugaron',
    imperfect: 'jugaba jugabas jugaba jugábamos jugabais jugaban',
    gerund: 'jugando',
    participle: 'jugado',
    imperative: 'juega juegue jugad jueguen',
  },
  dormir: {
    present: 'duermo duermes duerme dormimos dormís duermen',
    preterite: 'dormí dormiste durmió dormimos dormisteis durmieron',
    imperfect: 'dormía dormías dormía dormíamos dormíais dormían',
    gerund: 'durmiendo',
    participle: 'dormido',
    imperative: 'duerme duerma dormid duerman',
  },
  pedir: {
    present: 'pido pides pide pedimos pedís piden',
    preterite: 'pedí pediste pidió pedimos pedisteis pidieron',
    imperfect: 'pedía pedías pedía pedíamos pedíais pedían',
    gerund: 'pidiendo',
    participle: 'pedido',
    imperative: 'pide pida pedid pidan',
  },
  pensar: {
    present: 'pienso piensas piensa pensamos pensáis piensan',
    preterite: 'pensé pensaste pensó pensamos pensasteis pensaron',
    imperfect: 'pensaba pensabas pensaba pensábamos pensabais pensaban',
    gerund: 'pensando',
    participle: 'pensado',
    imperative: 'piensa piense pensad piensen',
  },
  volver: {
    present: 'vuelvo vuelves vuelve volvemos volvéis vuelven',
    preterite: 'volví volviste volvió volvimos volvisteis volvieron',
    imperfect: 'volvía volvías volvía volvíamos volvíais volvían',
    gerund: 'volviendo',
    participle: 'vuelto vuelta vueltos vueltas',
    imperative: 'vuelve vuelva volved vuelvan',
  },
  empezar: {
    present: 'empiezo empiezas empieza empezamos empezáis empiezan',
    preterite: 'empecé empezaste empezó empezamos empezasteis empezaron',
    imperfect: 'empezaba empezabas empezaba empezábamos empezabais empezaban',
    gerund: 'empezando',
    participle: 'empezado',
    imperative: 'empieza empiece empezad empiecen',
  },
  encontrar: {
    present: 'encuentro encuentras encuentra encontramos encontráis encuentran',
    preterite: 'encontré encontraste encontró encontramos encontrasteis encontraron',
    imperfect: 'encontraba encontrabas encontraba encontrábamos encontrabais encontraban',
    gerund: 'encontrando',
    participle: 'encontrado',
    imperative: 'encuentra encuentre encontrad encuentren',
  },
  costar: {
    present: 'cuesto cuestas cuesta costamos costáis cuestan',
    preterite: 'costé costaste costó costamos costasteis costaron',
    imperfect: 'costaba costabas costaba costábamos costabais costaban',
    gerund: 'costando',
    participle: 'costado',
  },
  preferir: {
    present: 'prefiero prefieres prefiere preferimos preferís prefieren',
    preterite: 'preferí preferiste prefirió preferimos preferisteis prefirieron',
    imperfect: 'prefería preferías prefería preferíamos preferíais preferían',
    gerund: 'prefiriendo',
    participle: 'preferido',
  },
  almorzar: {
    present: 'almuerzo almuerzas almuerza almorzamos almorzáis almuerzan',
    preterite: 'almorcé almorzaste almorzó almorzamos almorzasteis almorzaron',
    imperfect: 'almorzaba almorzabas almorzaba almorzábamos almorzabais almorzaban',
    gerund: 'almorzando',
    participle: 'almorzado',
  },
  cerrar: {
    present: 'cierro cierras cierra cerramos cerráis cierran',
    preterite: 'cerré cerraste cerró cerramos cerrasteis cerraron',
    imperfect: 'cerraba cerrabas cerraba cerrábamos cerrabais cerraban',
    gerund: 'cerrando',
    participle: 'cerrado cerrada cerrados cerradas',
    imperative: 'cierra cierre cerrad cierren',
  },
  entender: {
    present: 'entiendo entiendes entiende entendemos entendéis entienden',
    preterite: 'entendí entendiste entendió entendimos entendisteis entendieron',
    imperfect: 'entendía entendías entendía entendíamos entendíais entendían',
    gerund: 'entendiendo',
    participle: 'entendido',
  },
  acostarse: {
    present: 'acuesto acuestas acuesta acostamos acostáis acuestan',
    gerund: 'acostando',
    participle: 'acostado acostada acostados acostadas',
  },
  sentir: {
    present: 'siento sientes siente sentimos sentís sienten',
    preterite: 'sentí sentiste sintió sentimos sentisteis sintieron',
    gerund: 'sintiendo',
    participle: 'sentido',
    imperative: 'siente',
  },
  doler: {
    present: 'duelo dueles duele dolemos doléis duelen',
    gerund: 'doliendo',
    participle: 'dolido',
  },
  creer: {
    present: 'creo crees cree creemos creéis creen',
    preterite: 'creí creíste creyó creímos creísteis creyeron',
    gerund: 'creyendo',
    participle: 'creído',
  },
  seguir: {
    present: 'sigo sigues sigue seguimos seguís siguen',
    preterite: 'seguí seguiste siguió seguimos seguisteis siguieron',
    gerund: 'siguiendo',
    participle: 'seguido',
    imperative: 'sigue',
  },
  mover: {
    present: 'muevo mueves mueve movemos movéis mueven',
    gerund: 'moviendo',
    participle: 'movido',
  },
  contar: {
    present: 'cuento cuentas cuenta contamos contáis cuentan',
    gerund: 'contando',
    participle: 'contado',
  },
  perder: {
    present: 'pierdo pierdes pierde perdemos perdéis pierden',
    gerund: 'perdiendo',
    participle: 'perdido',
  },
  servir: {
    present: 'sirvo sirves sirve servimos servís sirven',
    preterite: 'serví serviste sirvió servimos servisteis sirvieron',
    gerund: 'sirviendo',
    participle: 'servido',
  },
  conseguir: {
    present: 'consigo consigues consigue conseguimos conseguís consiguen',
    preterite: 'conseguí conseguiste consiguió conseguimos conseguisteis consiguieron',
    gerund: 'consiguiendo',
    participle: 'conseguido',
  },
  repetir: {
    present: 'repito repites repite repetimos repetís repiten',
    preterite: 'repetí repetiste repitió repetimos repetisteis repitieron',
    gerund: 'repitiendo',
    participle: 'repetido',
  },
  morir: {
    present: 'muero mueres muere morimos morís mueren',
    preterite: 'morí moriste murió morimos moristeis murieron',
    gerund: 'muriendo',
    participle: 'muerto muerta muertos muertas',
  },
  caer: {
    present: 'caigo caes cae caemos caéis caen',
    preterite: 'caí caíste cayó caímos caísteis cayeron',
    gerund: 'cayendo',
    participle: 'caído',
  },
  mostrar: {
    present: 'muestro muestras muestra mostramos mostráis muestran',
    gerund: 'mostrando',
    participle: 'mostrado',
  },
  sentarse: {
    present: 'siento sientas sienta sentamos sentáis sientan',
    gerund: 'sentando',
    participle: 'sentado',
  },
  mentir: {
    present: 'miento mientes miente mentimos mentís mienten',
    preterite: 'mentí mentiste mintió mentimos mentisteis mintieron',
    gerund: 'mintiendo',
    participle: 'mentido',
  },
  elegir: {
    present: 'elijo eliges elige elegimos elegís eligen',
    preterite: 'elegí elegiste eligió elegimos elegisteis eligieron',
    gerund: 'eligiendo',
    participle: 'elegido',
  },
  traducir: {
    present: 'traduzco traduces traduce traducimos traducís traducen',
    preterite: 'traduje tradujiste tradujo tradujimos tradujisteis tradujeron',
    gerund: 'traduciendo',
    participle: 'traducido',
  },
  construir: {
    present: 'construyo construyes construye construimos construís construyen',
    preterite: 'construí construiste construyó construimos construisteis construyeron',
    gerund: 'construyendo',
    participle: 'construido',
  },
  parecer: {
    present: 'parezco pareces parece parecemos parecéis parecen',
    gerund: 'pareciendo',
    participle: 'parecido',
  },
  ofrecer: {
    present: 'ofrezco ofreces ofrece ofrecemos ofrecéis ofrecen',
    gerund: 'ofreciendo',
    participle: 'ofrecido',
  },
  conducir: {
    present: 'conduzco conduces conduce conducimos conducís conducen',
    preterite: 'conduje condujiste condujo condujimos condujisteis condujeron',
    gerund: 'conduciendo',
    participle: 'conducido',
  },
  recordar: {
    present: 'recuerdo recuerdas recuerda recordamos recordáis recuerdan',
    preterite: 'recordé recordaste recordó recordamos recordasteis recordaron',
    imperfect: 'recordaba recordabas recordaba recordábamos recordabais recordaban',
    gerund: 'recordando',
    participle: 'recordado',
  },
};

/** Sustantivos que tienen forma femenina distinta (profesor → profesora). */
const FEMININE_PAIR = new Set([
  'profesor',
  'amigo',
  'hijo',
  'hermano',
  'niño',
  'primo',
  'tío',
  'abuelo',
  'vecino',
  'camarero',
  'médico',
  'cocinero',
  'compañero',
  'chico',
  'gato',
  'perro',
  'estudiante',
  'señor',
  'doctor',
  'trabajador',
  'español',
  'cantante',
  'jefe',
]);

/** Plurales irregulares. */
const PLURAL_OF: Record<string, string> = {
  país: 'países',
  examen: 'exámenes',
  joven: 'jóvenes',
  lunes: 'lunes',
  martes: 'martes',
  miércoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  paraguas: 'paraguas',
  crisis: 'crisis',
};

/** Nombres de pila de uso común en los textos: no cuentan como palabras del nivel. */
const NAMES = `ana einstein newton ámsterdam copenhague pontevedra rafael oslo beatriz carlos gonzalo ismael luis marta pablo leo carla daniel juan lucía sofía carmen javier elena miguel
  laura david paula andrés diego irene sara jorge pedro maría josé tomás emma lucy
  madrid sevilla valencia barcelona españa méxico colombia argentina chile perú lima bogotá
  granada bilbao córdoba málaga toledo zaragoza salamanca europa américa`.split(/\s+/);

/** Los nombres de pila y lugares que más salen (en minúsculas). */
export const SPANISH_NAMES: ReadonlySet<string> = new Set(NAMES);

// ───────────── Generadores ─────────────
const VOWELS = 'aeiouáéíóúü';

function stripAccent(text: string): string {
  return text.replace(/[áéíóú]/g, (c) => 'aeiou'['áéíóú'.indexOf(c)] ?? c);
}

function pluralOf(word: string): string {
  const special = PLURAL_OF[word];
  if (special) return special;
  if (/[aeiouáéó]$/.test(word)) return `${word}s`;
  if (/[íú]$/.test(word)) return `${word}es`;
  if (word.endsWith('z')) return `${word.slice(0, -1)}ces`;
  if (/ión$/.test(word)) return `${word.slice(0, -2)}ones`;
  if (/[áéíóú]s$/.test(word)) return `${word.slice(0, -2)}${stripAccent(word.slice(-2, -1))}ses`;
  if (word.endsWith('s')) return word;
  return `${word}es`;
}

function nounForms(lemma: string): string[] {
  const forms = [lemma, pluralOf(lemma)];
  if (FEMININE_PAIR.has(lemma)) {
    const fem = lemma.endsWith('o')
      ? `${lemma.slice(0, -1)}a`
      : /[eé]$/.test(lemma)
        ? lemma
        : `${lemma}a`;
    forms.push(fem, pluralOf(fem));
  }
  return forms;
}

function adjectiveForms(lemma: string): string[] {
  if (lemma.endsWith('o')) {
    const stem = lemma.slice(0, -1);
    const forms = [lemma, `${stem}a`, `${stem}os`, `${stem}as`];
    // Apócope delante del nombre: un buen amigo, un mal día.
    if (lemma === 'bueno' || lemma === 'malo') forms.push(stem);
    return forms;
  }
  const forms = [lemma, pluralOf(lemma)];
  if (/(or|án|ón|ín|és|ol)$/.test(lemma)) {
    const fem = `${stripAccent(lemma)}a`;
    forms.push(fem, pluralOf(fem));
  }
  return forms;
}

// ───────────── Verbos: todos los tiempos a partir de unas pocas formas ─────────────
interface VerbParts {
  present: string[];
  preterite: string[];
  imperfect: string[];
  gerund: string;
  participle: string[];
}

const split = (text: string | undefined): string[] => (text ?? '').split(/\s+/).filter(Boolean);

/** Raíces irregulares del futuro y el condicional. */
const FUTURE_STEM: Record<string, string> = {
  tener: 'tendr',
  venir: 'vendr',
  poner: 'pondr',
  salir: 'saldr',
  poder: 'podr',
  querer: 'querr',
  saber: 'sabr',
  haber: 'habr',
  hacer: 'har',
  decir: 'dir',
  valer: 'valdr',
};

/** Subjuntivo de presente de los que no salen de la forma «yo». */
const SUBJUNCTIVE: Record<string, string> = {
  ser: 'sea seas sea seamos seáis sean',
  estar: 'esté estés esté estemos estéis estén',
  ir: 'vaya vayas vaya vayamos vayáis vayan',
  saber: 'sepa sepas sepa sepamos sepáis sepan',
  dar: 'dé des dé demos deis den',
  haber: 'haya hayas haya hayamos hayáis hayan',
};

const CLITICS = ['me', 'te', 'se', 'lo', 'la', 'le', 'nos', 'os', 'los', 'las', 'les'];

/** Acentúa la última vocal (habla → hablá, comie → comié) para «habláramos», «comiéramos». */
function accentLast(stem: string): string {
  return stem.replace(/[aeiou](?=[^aeiou]*$)/, (v) => 'áéíóú'['aeiou'.indexOf(v)] ?? v);
}

/** Delante de «e»: g → gu, c → qu, z → c (llegar → llegué, buscar → busqué, empezar → empecé). */
function softenBeforeE(stem: string): string {
  if (stem.endsWith('g')) return `${stem}u`;
  if (stem.endsWith('c')) return `${stem.slice(0, -1)}qu`;
  if (stem.endsWith('z')) return `${stem.slice(0, -1)}c`;
  return stem;
}

function regularParts(base: string): VerbParts {
  const stem = base.slice(0, -2);
  const kind = base.slice(-2);
  const withEndings = (endings: string[], from = stem) => endings.map((e) => `${from}${e}`);
  if (kind === 'ar') {
    const present = withEndings(['o', 'as', 'a', 'amos', 'áis', 'an']);
    const preterite = withEndings(['é', 'aste', 'ó', 'amos', 'asteis', 'aron']);
    preterite[0] = `${softenBeforeE(stem)}é`;
    return {
      present,
      preterite,
      imperfect: withEndings(['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban']),
      gerund: `${stem}ando`,
      participle: withEndings(['ado', 'ada', 'ados', 'adas']),
    };
  }
  const present = withEndings(
    kind === 'er' ? ['o', 'es', 'e', 'emos', 'éis', 'en'] : ['o', 'es', 'e', 'imos', 'ís', 'en'],
  );
  // coger → cojo, vencer → venzo, seguir → sigo
  if (/g$/.test(stem)) present[0] = `${stem.slice(0, -1)}jo`;
  else if (/[^aeiouáéíóú]c$/.test(stem)) present[0] = `${stem.slice(0, -1)}zo`;
  else if (/gu$/.test(stem)) present[0] = `${stem.slice(0, -1)}o`;
  return {
    present,
    preterite: withEndings(['í', 'iste', 'ió', 'imos', 'isteis', 'ieron']),
    imperfect: withEndings(['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']),
    gerund: `${stem}iendo`,
    participle: withEndings(['ido', 'ida', 'idos', 'idas']),
  };
}

function partsOf(base: string, entry: Irregular): VerbParts {
  const regular = regularParts(base);
  const participle = split(entry.participle);
  return {
    present: split(entry.present),
    preterite: entry.preterite ? split(entry.preterite) : regular.preterite,
    imperfect: entry.imperfect ? split(entry.imperfect) : regular.imperfect,
    gerund: entry.gerund,
    participle:
      participle.length === 1 && participle[0]?.endsWith('o')
        ? [0, 1, 2, 3].map((i) => `${participle[0]?.slice(0, -1)}${['o', 'a', 'os', 'as'][i]}`)
        : participle,
  };
}

/** Todas las formas de un verbo: tiempos simples, subjuntivos, futuro, condicional y formas con pronombre. */
function verbForms(inf: string, entry?: Irregular): string[] {
  const reflexive = inf.endsWith('se');
  const base = reflexive ? inf.slice(0, -2) : inf;
  const parts = entry ? partsOf(base, entry) : regularParts(base);
  const { present, preterite } = parts;
  const ar = base.endsWith('ar');

  // Subjuntivo de presente: de la forma «yo»; en los que cambian la vocal, «nosotros» y «vosotros»
  // vuelven a la raíz (pensemos) o la cambian (pidamos, durmamos).
  let subjunctive = split(SUBJUNCTIVE[base]);
  if (subjunctive.length === 0 && present[0]) {
    const yoStem = present[0].replace(/o$/, '');
    const plural = (present[3] ?? '').replace(/(amos|emos|imos)$/, '');
    const changed =
      yoStem !== plural &&
      ([/ie/, /ue/, /i/].some((re, i) => yoStem.replace(re, ['e', 'o', 'e'][i] ?? '') === plural) ||
        yoStem.replace(/ue/, 'u') === plural);
    const nosotros = changed
      ? base.endsWith('ir')
        ? (preterite[5] ?? '').replace(/(ieron|eron)$/, '')
        : plural
      : yoStem;
    const fix = (stem: string) => (ar ? softenBeforeE(stem) : stem);
    const endings = ar
      ? ['e', 'es', 'e', 'emos', 'éis', 'en']
      : ['a', 'as', 'a', 'amos', 'áis', 'an'];
    subjunctive = endings.map((e, i) => `${fix(i === 3 || i === 4 ? nosotros : yoStem)}${e}`);
  }

  const forms = new Set<string>([base, parts.gerund, ...parts.participle]);
  for (const list of [present, preterite, parts.imperfect, subjunctive]) {
    for (const form of list) forms.add(form);
  }
  // Subjuntivo de imperfecto: de la tercera persona del plural del indefinido.
  const third = preterite[5] ?? '';
  if (third.endsWith('ron')) {
    const stem = third.slice(0, -3);
    for (const k of ['ra', 'se']) {
      for (const form of [
        `${stem}${k}`,
        `${stem}${k === 'ra' ? 'ras' : 'ses'}`,
        `${accentLast(stem)}${k}mos`,
        `${stem}${k === 'ra' ? 'rais' : 'seis'}`,
        `${stem}${k === 'ra' ? 'ran' : 'sen'}`,
      ]) {
        forms.add(form);
      }
    }
  }
  // Futuro y condicional.
  const root = FUTURE_STEM[base] ?? base;
  for (const e of ['é', 'ás', 'á', 'emos', 'éis', 'án', 'ía', 'ías', 'íamos', 'íais', 'ían']) {
    forms.add(`${root}${e}`);
  }
  // Imperativo.
  if (entry?.imperative) for (const form of split(entry.imperative)) forms.add(form);
  if (present[2]) forms.add(present[2]);
  forms.add(`${base.slice(0, -1)}d`);
  // Infinitivo con pronombre: ayudarme, dárselo no (acento), verla…
  for (const clitic of CLITICS) forms.add(`${base}${clitic}`);
  return [...forms].filter(Boolean);
}

// ───────────── Construcción del léxico ─────────────
export type Lexicon = Map<string, Analysis>;

interface DeckEntry {
  lemma: string;
  pos: string[];
}

function readDeck(dir: string): DeckEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const parsed = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as {
        entries?: DeckEntry[];
      };
      return parsed.entries ?? [];
    });
}

/** El léxico de español: palabras gramaticales, verbos irregulares y el mazo con sus formas. */
export function buildSpanishLexicon(contentRoot = path.join(process.cwd(), 'content')): Lexicon {
  const lexicon: Lexicon = new Map();
  // La primera que llega manda: gramaticales, luego irregulares, luego el mazo.
  const add = (form: string, analysis: Analysis) => {
    const key = form.toLowerCase();
    if (key !== '' && !lexicon.has(key)) lexicon.set(key, analysis);
  };

  for (const line of CLOSED.split('\n')) {
    const match = /^(\S+(?: \S+)?) (\w+): (.+)$/.exec(line.trim());
    if (!match) continue;
    const [, lemma, pos, forms] = match as unknown as [string, string, Upos, string];
    for (const form of forms.split(' ')) add(form, { lemma, pos });
  }
  for (const [lemma, entry] of Object.entries(IRREGULAR)) {
    for (const form of verbForms(lemma, entry)) add(form, { lemma, pos: entry.pos ?? 'VERB' });
    add(lemma, { lemma, pos: entry.pos ?? 'VERB' });
  }
  // Los nombres propios que más salen: se marcan como tales aunque abran la frase.
  for (const name of NAMES) add(name, { lemma: name, pos: 'PROPN' });

  for (const { lemma, pos } of readDeck(path.join(contentRoot, 'es', 'dictionary'))) {
    if (lemma.includes(' ')) continue;
    const upos = POS_OF_DECK[pos[0] ?? ''] ?? 'NOUN';
    const lemmaKey = lemma.toLowerCase();
    if (lemmaKey in IRREGULAR) continue;
    if (upos === 'VERB' || upos === 'AUX') {
      // «llamarse»: las formas salen de «llamar», con el lema reflexivo.
      add(lemmaKey, { lemma: lemmaKey, pos: upos });
      for (const form of verbForms(lemmaKey)) add(form, { lemma: lemmaKey, pos: upos });
    } else if (upos === 'NOUN') {
      for (const form of nounForms(lemmaKey)) add(form, { lemma: lemmaKey, pos: upos });
    } else if (upos === 'ADJ') {
      for (const form of adjectiveForms(lemmaKey)) add(form, { lemma: lemmaKey, pos: upos });
    } else {
      add(lemmaKey, { lemma: lemmaKey, pos: upos });
    }
  }
  // Formas sueltas que no salen de ninguna regla (irregulares, apócopes…): forma → lema|CATEGORÍA.
  const formas = path.join(contentRoot, 'es', 'wordlists', 'formas.json');
  if (existsSync(formas)) {
    const extra = JSON.parse(readFileSync(formas, 'utf8')) as Record<string, string>;
    for (const [form, value] of Object.entries(extra)) {
      const [lemma, pos] = value.split('|');
      if (lemma && pos) add(form, { lemma: lemma.toLowerCase(), pos: pos as Upos });
    }
  }
  return lexicon;
}

/** Las vocales para contar sílabas (ver `countSyllablesEs`). */
export const SPANISH_VOWELS = VOWELS;
