// Menú móvil y formulario de contacto. Sin dependencias.
// La clase deja constancia de que el script se ha ejecutado (lo comprueban los tests de la CSP).
document.documentElement.classList.add('js');

const nav = document.querySelector('.nav');
const button = document.querySelector('.menu-btn');
if (nav && button) {
  const toggle = (open) => {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Cerrar el menú' : 'Abrir el menú');
  };
  button.addEventListener('click', () => toggle(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
}

// El formulario no tiene servidor: prepara un correo con lo escrito, dirigido a la dirección de
// contacto que la propia página enseña en el pie (así solo está escrita en un sitio).
const form = document.querySelector('#solicitud');
const contact = document.querySelector('.foot a[href^="mailto:"]');
if (form && contact) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = [
      `Nombre: ${data.get('nombre')} ${data.get('apellidos')}`,
      `Correo: ${data.get('correo')}`,
      `Nivel actual: ${data.get('nivel')}`,
      '',
      data.get('mensaje'),
    ].join('\n');
    const note = document.querySelector('#nota');
    if (note) note.textContent = 'Se abrirá tu programa de correo con el mensaje preparado.';
    const address = contact.getAttribute('href').split('?')[0];
    window.location.href = `${address}?subject=${encodeURIComponent('Solicitud de información')}&body=${encodeURIComponent(body)}`;
  });
}

// Aviso de cookies (ADR-0028). Escribe la misma cookie que la app (src/lib/consent.ts), así que
// la decisión vale para toda la web. Las necesarias van siempre; aquí se aceptan o se rechazan
// las de preferencias. Si cambia algo aquí, cambia también en ese fichero (un test lo vigila).
{
  const NAME = 'senal_consent';
  const VERSION = 'v1';
  const MAX_AGE = 15724800; // seis meses, en segundos
  const PREFERENCE_COOKIES = ['senal_theme', 'senal_locale'];
  const PREFERENCE_STORAGE = ['senal:accent', 'senal:plan'];
  const CHOICES = { necessary: 'solo las necesarias', all: 'necesarias y de preferencias' };
  const attributes = `Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;

  const read = () => {
    for (const pair of document.cookie.split(';')) {
      const [name, value = ''] = pair.trim().split('=');
      const parts = value.split('.');
      if (name === NAME && parts.length === 2 && parts[0] === VERSION && parts[1] in CHOICES) {
        return parts[1];
      }
    }
    return null;
  };

  const save = (choice) => {
    document.cookie = `${NAME}=${VERSION}.${choice}; Max-Age=${MAX_AGE}; ${attributes}`;
    if (choice === 'all') return;
    // Rechazar deshace lo que se hubiera aceptado antes.
    for (const name of PREFERENCE_COOKIES) document.cookie = `${name}=; Max-Age=0; ${attributes}`;
    try {
      for (const key of PREFERENCE_STORAGE) window.localStorage.removeItem(key);
    } catch {
      // Sin almacenamiento (modo privado estricto) no había nada que borrar.
    }
  };

  // En la página de la política: la decisión actual y los botones para cambiarla.
  const state = document.querySelector('[data-cookie-state]');
  const options = document.querySelectorAll('[data-cookie-choice]');
  const show = () => {
    const choice = read();
    if (state) state.textContent = choice ? `${CHOICES[choice]}.` : 'todavía no has elegido.';
    for (const option of options) {
      option.setAttribute('aria-pressed', String(option.dataset.cookieChoice === choice));
    }
  };

  let banner = null;
  const close = () => {
    banner?.remove();
    banner = null;
    document.body.classList.remove('has-cookie-banner');
  };
  const decide = (choice) => {
    save(choice);
    close();
    show();
    // «Crea tu plan» se guarda en cuanto se aceptan las preferencias, aunque ya estuviera a medias.
    document.dispatchEvent(new CustomEvent('senal:consent', { detail: choice }));
  };

  const open = () => {
    if (banner) return banner;
    banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-label', 'Cookies');

    const text = document.createElement('p');
    text.append(
      'Señal usa cookies necesarias para que puedas entrar y, si aceptas, para recordar tu sesión y tus preferencias: tema, idioma, acento y tu plan. No hay análisis ni publicidad. ',
    );
    const more = document.createElement('a');
    more.href = '/landing/cookies.html';
    more.textContent = 'Más información';
    text.append(more);

    // «Rechazar» y «Aceptar» pesan lo mismo: mismo botón, uno al lado del otro.
    const actions = document.createElement('div');
    actions.className = 'cookie-actions';
    for (const [choice, label] of [
      ['necessary', 'Rechazar'],
      ['all', 'Aceptar'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost';
      button.textContent = label;
      button.addEventListener('click', () => decide(choice));
      actions.append(button);
    }

    banner.append(text, actions);
    document.body.append(banner);
    // La página gana por abajo el sitio del aviso: todo se puede subir por encima de él.
    document.body.classList.add('has-cookie-banner');
    return banner;
  };

  for (const option of options) {
    option.addEventListener('click', () => decide(option.dataset.cookieChoice));
  }
  // «Configurar cookies», en el pie: vuelve a abrir el aviso y lleva el foco a sus botones.
  for (const trigger of document.querySelectorAll('[data-cookies]')) {
    trigger.addEventListener('click', () => open().querySelector('button').focus());
  }

  show();
  if (read() === null) open();
}

// Portada: la palabra del titular se escribe y se borra, un idioma tras otro (portada.md,
// «Titular: la palabra que se escribe»). Los lectores de pantalla leen siempre «Domina el
// Inglés con Señal»: la palabra animada va oculta para ellos y la fija, oculta a la vista.
// Con movimiento reducido o sin JavaScript se queda «Inglés». Va antes que el acercamiento:
// este mide el titular, y el titular tiene que tener ya su alto definitivo.
{
  const slot = document.querySelector('.typed');
  const word = slot?.querySelector('.typed-word');
  const heading = slot?.closest('h1');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (slot && word && heading) {
    const WORDS = slot.dataset.words.split(' ');
    const TYPE_MS = 1000; // escribir cada palabra, sea larga o corta: del hueco a entera
    const HOLD_MS = 1500; // la palabra entera, quieta
    const DELETE_MS = 1000; // borrarla: de la primera letra que se va al hueco
    const caret = document.createElement('span');
    caret.className = 'typed-caret';
    caret.setAttribute('aria-hidden', 'true');
    slot.append(caret);

    // El titular guarda el alto que tiene con la palabra que más ocupa: así no cambia de
    // líneas mientras se escribe, ni mueve lo que hay debajo.
    const reserve = () => {
      const shown = word.textContent;
      heading.style.minHeight = '';
      let tallest = 0;
      for (const text of WORDS) {
        word.textContent = text;
        tallest = Math.max(tallest, heading.getBoundingClientRect().height);
      }
      word.textContent = shown;
      heading.style.minHeight = `${tallest}px`;
    };

    let index = 0;
    let timer = 0;
    const later = (step, ms) => {
      timer = window.setTimeout(step, ms);
    };
    const type = (text, letters) => {
      word.textContent = text.slice(0, letters);
      if (letters < text.length) later(() => type(text, letters + 1), TYPE_MS / text.length);
      else later(erase, HOLD_MS);
    };
    const erase = () => {
      const text = word.textContent.slice(0, -1);
      word.textContent = text;
      if (text.length > 0) {
        later(erase, DELETE_MS / Math.max(1, WORDS[index].length - 1));
      } else {
        // En cuanto se queda en blanco empieza la siguiente: de ahí a entera, TYPE_MS justos.
        index = (index + 1) % WORDS.length;
        later(() => type(WORDS[index], 1), TYPE_MS / WORDS[index].length);
      }
    };

    // Empieza con «Inglés» ya escrito, como lo pinta el HTML.
    const start = () => {
      window.clearTimeout(timer);
      index = 0;
      word.textContent = WORDS[0];
      slot.classList.toggle('is-on', !reduced.matches);
      if (!reduced.matches) later(erase, HOLD_MS);
    };

    // Se mide con el cursor puesto, que también ocupa.
    const restart = () => {
      start();
      reserve();
    };
    restart();
    window.addEventListener('resize', reserve);
    reduced.addEventListener('change', restart);
    document.fonts?.ready.then(reserve);
  }
}

// Portada: «Crea tu plan», la pantalla final del acercamiento (portada.md). Una pregunta por paso
// (el idioma, el nivel, para qué, cuándo es el examen si es para eso, y cuánto tiempo al día) y,
// al final, un plan hecho con las respuestas: la meta, el plazo, el reparto de los minutos, la
// semana y por dónde empezar. El plan lleva a entrar en Señal. Con las cookies de preferencias
// aceptadas, las respuestas se recuerdan en este navegador (`senal:plan`): al volver, la pantalla
// sale donde se dejó —la pregunta por la que se iba o el plan ya hecho— y no en la primera
// pregunta. Sin JavaScript se ven todas las preguntas a la vez. Va antes que el acercamiento, que
// copia esta pantalla en el portátil tal como queda al empezar (ya con lo recordado).
{
  const form = document.querySelector('#plan');

  if (form) {
    const all = [...form.querySelectorAll('.plan-step')];
    const summary = form.querySelector('.plan-summary');
    const count = form.querySelector('#plan-paso');
    const error = form.querySelector('#plan-error');
    const actions = form.querySelector('[data-plan="pasos"]');
    const back = form.querySelector('[data-plan="atras"]');
    const next = actions.querySelector('[type="submit"]');
    const exam = form.querySelector('[data-exam]');
    const out = (name) => form.querySelector(`[data-out="${name}"]`);
    const picked = (name) => form.querySelector(`input[name="${name}"]:checked`);

    // --- Lo que sabe el plan de cada idioma ---

    const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    // Horas de estudio acumuladas para llegar a cada nivel, desde cero (orientativas): las guías de
    // Cambridge para inglés, francés y español; las del JLPT para quien no sabe kanji, y las que se
    // suelen dar para el HSK a quien no habla una lengua de Asia oriental.
    const HOURS = {
      cefr: { A1: [90, 100], A2: [180, 200], B1: [350, 400], B2: [500, 600], C1: [700, 800], C2: [1000, 1200] },
      zh: { A1: [120, 200], A2: [250, 400], B1: [500, 800], B2: [900, 1400], C1: [1500, 2200], C2: [2200, 3000] },
      ja: { A1: [325, 575], A2: [575, 1000], B1: [950, 1700], B2: [1600, 2600], C1: [3000, 4800], C2: [3000, 4800] },
    };
    const LANGUAGES = {
      en: { name: 'inglés', hours: HOURS.cefr, exams: { A1: 'A2 Key', A2: 'A2 Key', B1: 'B1 Preliminary', B2: 'B2 First', C1: 'C1 Advanced', C2: 'C2 Proficiency' }, examLabel: 'Cambridge English' },
      es: { name: 'español', hours: HOURS.cefr, exams: { A1: 'DELE A1', A2: 'DELE A2', B1: 'DELE B1', B2: 'DELE B2', C1: 'DELE C1', C2: 'DELE C2' }, examLabel: 'DELE' },
      fr: { name: 'francés', hours: HOURS.cefr, exams: { A1: 'DELF A1', A2: 'DELF A2', B1: 'DELF B1', B2: 'DELF B2', C1: 'DALF C1', C2: 'DALF C2' }, examLabel: 'DELF y DALF' },
      zh: { name: 'chino', hours: HOURS.zh, exams: { A1: 'HSK 1', A2: 'HSK 2', B1: 'HSK 3', B2: 'HSK 4', C1: 'HSK 5', C2: 'HSK 6' }, examLabel: 'HSK', equivalent: true },
      ja: { name: 'japonés', hours: HOURS.ja, exams: { A1: 'JLPT N5', A2: 'JLPT N4', B1: 'JLPT N3', B2: 'JLPT N2', C1: 'JLPT N1', C2: 'JLPT N1' }, examLabel: 'JLPT', equivalent: true },
    };

    // En qué se van los minutos de cada día, según para qué se aprende (en %).
    const SPLITS = {
      viajar: [['Escuchar', 35], ['Hablar', 25], ['Vocabulario', 20], ['Repaso', 20]],
      trabajo: [['Escuchar', 25], ['Leer', 20], ['Escribir', 20], ['Vocabulario', 15], ['Repaso', 20]],
      estudios: [['Leer', 30], ['Escribir', 25], ['Escuchar', 20], ['Vocabulario', 10], ['Repaso', 15]],
      examen: [['Escuchar', 25], ['Leer', 25], ['Gramática', 20], ['Escribir', 15], ['Repaso', 15]],
      gusto: [['Escuchar', 40], ['Leer', 30], ['Vocabulario', 15], ['Repaso', 15]],
    };
    // Chino y japonés empiezan por su escritura: se lleva una parte del tiempo en A1.
    const SCRIPT = { zh: 'Caracteres', ja: 'Kana y kanji' };
    const SATURDAY = {
      viajar: 'Practica en voz alta lo de la semana, como si estuvieras de viaje',
      trabajo: 'Escribe un correo o prepara una reunión en {lengua}',
      estudios: 'Lee un texto largo y resúmelo',
      examen: 'Un simulacro del {examen}, por partes',
      gusto: 'Un capítulo de una serie o un podcast en {lengua}',
    };
    const FOCUS = {
      viajar: 'Situaciones de viaje: transporte, alojamiento y restaurantes',
      trabajo: 'Reuniones, correos y llamadas',
      estudios: 'Textos académicos y apuntes',
      examen: 'El formato del {examen}, parte por parte',
      gusto: 'Series y podcasts de tu nivel',
    };
    const START = {
      ja: ['Hiragana y katakana', 'Saludos, números y tus primeras 100 palabras', 'Tus primeros kanji'],
      zh: ['El pinyin y los cuatro tonos', 'Saludos, números y tus primeros 100 caracteres', 'Frases completas sobre tu día'],
      other: ['Los sonidos del idioma y los saludos', 'Las 300 palabras más frecuentes', 'Entender conversaciones lentas'],
    };
    // «¿Cuándo es tu examen?»: cuántos meses quedan, más o menos.
    const DATES = { 3: ['en menos de 3 meses', 2], 6: ['en 3–6 meses', 4.5], 12: ['en 6 meses–1 año', 9], 24: ['en más de un año', 18] };
    const DAYS = 6; // días de estudio a la semana: de lunes a sábado
    const WEEKS_PER_MONTH = 4.345;

    // --- Cálculos ---

    const number = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
    const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]);

    /** Horas para llegar a `level` desde el nivel anterior (o desde cero en A1). */
    const hoursFor = (language, level) => {
      const target = language.hours[level];
      const index = LEVELS.indexOf(level);
      if (index === 0) return target;
      const before = language.hours[LEVELS[index - 1]];
      return [Math.max(10, target[0] - before[0]), Math.max(10, target[1] - before[1])];
    };

    /** «unas 6–8 semanas», «unos 10–12 meses», «unos 3–5,5 años». */
    const duration = (lowWeeks, highWeeks) => {
      const say = (a, b, one, many, article) =>
        a === b
          ? a === 1
            ? `${article === 'unas' ? 'una' : 'un'} ${one}`
            : `${article} ${number(a)} ${many}`
          : `${article} ${number(a)}–${number(b)} ${many}`;
      if (highWeeks < 9) {
        return say(Math.max(1, Math.round(lowWeeks)), Math.max(1, Math.round(highWeeks)), 'semana', 'semanas', 'unas');
      }
      const lowMonths = lowWeeks / WEEKS_PER_MONTH;
      const highMonths = highWeeks / WEEKS_PER_MONTH;
      if (highMonths < 24) {
        return say(Math.max(1, Math.round(lowMonths)), Math.round(highMonths), 'mes', 'meses', 'unos');
      }
      const half = (months) => Math.max(0.5, Math.round((months / 12) * 2) / 2);
      return say(half(lowMonths), half(highMonths), 'año', 'años', 'unos');
    };

    /** Reparte los minutos según los porcentajes, sin perder ninguno por redondear. */
    const share = (minutes, parts) => {
      const raw = parts.map(([label, pct]) => [label, (minutes * pct) / 100]);
      const result = raw.map(([label, value]) => [label, Math.floor(value)]);
      let left = minutes - result.reduce((sum, [, value]) => sum + value, 0);
      const order = raw
        .map(([, value], i) => [value - Math.floor(value), i])
        .sort((a, b) => b[0] - a[0]);
      for (const [, i] of order) {
        if (left <= 0) break;
        result[i][1] += 1;
        left -= 1;
      }
      return result.filter(([, value]) => value > 0);
    };

    const list = (target, rows) => {
      target.replaceChildren(
        ...rows.map(([when, what]) => {
          const item = document.createElement('li');
          const label = document.createElement('span');
          label.className = 'plan-when';
          label.textContent = when;
          const text = document.createElement('span');
          text.textContent = what;
          // El espacio no se ve (es una rejilla), pero así un lector de pantalla no junta las palabras.
          item.append(label, ' ', text);
          return item;
        }),
      );
    };

    const build = () => {
      const languageInput = picked('idioma');
      const levelInput = picked('nivel');
      const goalInput = picked('objetivo');
      const minutes = Number(picked('minutos').value);
      const code = languageInput.value;
      const language = LANGUAGES[code];
      const goal = goalInput.value;
      const level = LEVELS.includes(levelInput.value) ? levelInput.value : null;
      const examName = level ? language.exams[level] : language.examLabel;
      const values = { lengua: language.name, examen: examName };

      out('titulo').textContent = `Tu plan de ${language.name}`;
      out('respuestas').textContent = [
        languageInput.dataset.summary,
        levelInput.dataset.summary,
        goalInput.dataset.summary,
        `${minutes} min al día`,
      ].join(' · ');

      // La meta y el plazo.
      const deadline = out('fecha');
      deadline.hidden = true;
      if (!level) {
        out('meta').textContent = 'Tu meta saldrá de la prueba de nivel.';
        out('plazo').textContent = 'Cuando sepas tu nivel, el plan te dirá cuánto tiempo te llevará el siguiente.';
      } else {
        if (goal === 'examen') {
          out('meta').textContent =
            code === 'en' && level === 'A1'
              ? 'Tu meta: el A1 y, después, el A2 Key, el primer examen de Cambridge para adultos.'
              : `Tu meta: el ${examName}${language.equivalent ? `, que equivale a un ${level}` : ''}.`;
        } else {
          out('meta').textContent = `Tu meta: llegar al ${level}.`;
        }
        const [low, high] = hoursFor(language, level);
        const perWeek = (minutes * DAYS) / 60;
        out('plazo').textContent =
          `Suele llevar entre ${number(low)} y ${number(high)} horas de estudio. ` +
          `Con ${minutes} min al día, de lunes a sábado, son ${duration(low / perWeek, high / perWeek)}.`;

        const date = goal === 'examen' ? DATES[picked('fecha')?.value] : undefined;
        if (date) {
          const [when, months] = date;
          const days = months * WEEKS_PER_MONTH * DAYS;
          const needLow = (low * 60) / days;
          const needHigh = (high * 60) / days;
          const five = (n) => Math.ceil(n / 5) * 5;
          deadline.textContent =
            minutes >= needHigh
              ? `Para tu examen, ${when}, llegas a tiempo.`
              : minutes >= needLow
                ? `Para tu examen, ${when}, llegas justo: no te saltes días.`
                : needLow > 120
                  ? `Para tu examen, ${when}, no da tiempo ni con dos horas al día: mejor una convocatoria más adelante.`
                  : `Para tu examen, ${when}, no llegas con ${minutes} min al día: necesitarías unos ${five(needHigh)} min al día.`;
          deadline.hidden = false;
        }
      }

      // Los minutos de cada día.
      let parts = SPLITS[goal];
      if (SCRIPT[code] && (level === 'A1' || !level)) {
        parts = [[SCRIPT[code], 20], ...parts.map(([label, pct]) => [label, pct * 0.8])];
      }
      const split = share(minutes, parts);
      out('minutos-titulo').textContent = `Tus ${minutes} minutos`;
      const bar = out('barra');
      bar.replaceChildren(
        ...split.map(([, value]) => {
          const segment = document.createElement('span');
          segment.style.flexGrow = String(value);
          return segment;
        }),
      );
      list(
        out('reparto'),
        split.map(([label, value]) => [`${value} min`, label]),
      );

      // La semana.
      list(out('semana'), [
        ['De lunes a viernes', `Tu rutina de ${minutes} minutos`],
        ['Sábado', fill(SATURDAY[goal], values)],
        ['Domingo', `Descanso, o algo en ${language.name} que te guste`],
      ]);

      // Por dónde empezar.
      const start = START[code] ?? START.other;
      const steps = !level
        ? [
            ['Primero', 'La prueba de nivel: con el resultado se ajusta el plan'],
            ['Primer mes', fill(FOCUS[goal], values)],
            ['Tercer mes', goal === 'examen' ? 'Tu primer simulacro del examen' : 'Textos y audios de tu nivel'],
          ]
        : level === 'A1'
          ? [
              ['Semanas 1 y 2', start[0]],
              ['Primer mes', start[1]],
              ['Tercer mes', goal === 'examen' ? `Tu primer simulacro del ${examName}` : start[2]],
            ]
          : [
              ['Semanas 1 y 2', 'Un diagnóstico: escucha y lectura de tu nivel para ver qué se te escapa'],
              ['Primer mes', fill(FOCUS[goal], values)],
              ['Tercer mes', goal === 'examen' ? `Tu primer simulacro completo del ${examName}` : `Textos y audios del ${level}`],
            ];
      list(out('pasos'), steps);

      const NOTES = {
        en: 'Las lecciones, los repasos y los simulacros de Cambridge de inglés ya están en Señal.',
        es: 'Las lecciones, los repasos y los simulacros del DELE de español ya están en Señal.',
      };
      out('nota').textContent =
        NOTES[code] ??
        `Estamos preparando las lecciones de ${language.name}. De momento, en Señal están las de inglés y español.`;
    };

    // --- Los pasos ---

    // La pregunta del examen solo cuenta si se aprende para aprobarlo.
    const active = () =>
      all.filter((step) => !step.dataset.when || picked('objetivo')?.value === step.dataset.when);

    let current = all[0];
    const show = (target) => {
      current = target;
      const steps = active();
      const done = target === summary;
      const index = done ? steps.length : steps.indexOf(target);
      for (const step of all) step.hidden = step !== target;
      summary.hidden = !done;
      actions.hidden = done;
      back.hidden = index === 0;
      next.textContent = index === steps.length - 1 ? 'Ver mi plan' : 'Siguiente';
      count.textContent = done ? 'Listo' : `Paso ${index + 1} de ${steps.length}`;
      form.dataset.progress = String(Math.round(((done ? steps.length : index + 1) / steps.length) * 100));
      error.textContent = '';
      remember();
    };
    // Al cambiar de paso, el foco va a la respuesta elegida o a la primera: así se sigue con el
    // teclado sin volver a buscar dónde estaba.
    const focus = () => {
      if (current === summary) summary.focus();
      else (current.querySelector('input:checked') ?? current.querySelector('input'))?.focus();
    };

    // --- Lo que se recuerda (solo con las cookies de preferencias aceptadas) ---

    const STORE = 'senal:plan';
    const NAMES = ['idioma', 'nivel', 'objetivo', 'fecha', 'minutos'];
    const allowed = () =>
      document.cookie.split(';').some((pair) => pair.trim() === 'senal_consent=v1.all');
    const remember = () => {
      if (!allowed()) return;
      const answers = {};
      for (const name of NAMES) {
        const input = picked(name);
        if (input) answers[name] = input.value;
      }
      const step = current === summary ? 'resumen' : active().indexOf(current);
      try {
        window.localStorage.setItem(STORE, JSON.stringify({ answers, step }));
      } catch {
        // Sin almacenamiento (modo privado estricto) no se recuerda: se empieza por la primera.
      }
    };
    // Vuelve a marcar las respuestas guardadas y enseña el paso donde se dejó. Solo se salta a una
    // pregunta si las anteriores tienen respuesta; si algo no cuadra, se empieza por la primera.
    const restore = () => {
      if (!allowed()) return false;
      let saved = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(STORE) ?? 'null');
      } catch {
        return false;
      }
      if (!saved || typeof saved !== 'object' || typeof saved.answers !== 'object') return false;
      for (const name of NAMES) {
        const value = saved.answers?.[name];
        const input = [...form.querySelectorAll(`input[name="${name}"]`)].find((el) => el.value === value);
        if (input) input.checked = true;
      }
      const language = picked('idioma');
      if (language) exam.textContent = LANGUAGES[language.value].examLabel;
      const steps = active();
      const answered = (list) => list.every((step) => step.querySelector('input:checked'));
      if (saved.step === 'resumen' && answered(steps)) {
        build();
        show(summary);
        return true;
      }
      const index = Number(saved.step);
      if (Number.isInteger(index) && index > 0 && index < steps.length && answered(steps.slice(0, index))) {
        show(steps[index]);
        return true;
      }
      return false;
    };

    form.addEventListener('change', (event) => {
      error.textContent = '';
      if (event.target.name === 'idioma') exam.textContent = LANGUAGES[event.target.value].examLabel;
      // Elegir el examen añade una pregunta (o quitarlo la quita): el «Paso 3 de 5» cambia ya.
      if (event.target.name === 'objetivo') show(current);
      remember();
    });
    document.addEventListener('senal:consent', (event) => {
      if (event.detail === 'all') remember();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (current === summary) return;
      if (!current.querySelector('input:checked')) {
        error.textContent = 'Elige una opción para seguir.';
        current.querySelector('input')?.focus();
        return;
      }
      const steps = active();
      const index = steps.indexOf(current);
      if (index === steps.length - 1) {
        build();
        show(summary);
      } else {
        show(steps[index + 1]);
      }
      focus();
    });
    back.addEventListener('click', () => {
      const steps = active();
      show(steps[steps.indexOf(current) - 1]);
      focus();
    });
    form.querySelector('[data-plan="cambiar"]').addEventListener('click', () => {
      show(all[0]);
      focus();
    });

    if (!restore()) show(all[0]);
  }
}

// Portada: acercamiento al portátil con el scroll (design-system/senal/pages/portada.md, «Hero»).
// La escena se acerca a la pantalla del portátil hasta que la copia que lleva dentro ocupa la
// ventana; en ese momento se cambia por la misma pantalla a tamaño real, que se ve nítida: «Crea tu
// plan». A quien ya usa Señal (cookies de preferencias aceptadas) el portátil le enseña «Hoy» y, al
// llenar la ventana, la portada entra en la app (/hoy; sin sesión, la app pide entrar).
// Solo se tocan propiedades del CSSOM (transform, opacity…): la CSP de la portada no admite
// atributos style="…", pero sí esto.
{
  const hero = document.querySelector('.zoom-hero');
  const app = hero?.querySelector('.zoom-app');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (hero && app) {
    const stage = hero.querySelector('.zoom-stage');
    const scene = hero.querySelector('.zoom-scene');
    const desk = hero.querySelector('.scene-desk');
    const lid = hero.querySelector('.laptop-lid');
    const screen = hero.querySelector('.laptop-screen');
    const mini = hero.querySelector('.zoom-mini');
    const glare = hero.querySelector('.laptop-glare');
    const copy = hero.querySelector('.zoom-copy');
    const hint = hero.querySelector('.zoom-hint');

    const returning = document.cookie
      .split(';')
      .some((pair) => pair.trim() === 'senal_consent=v1.all');
    const today = document.querySelector('#pantalla-hoy');

    // En el portátil va una copia de «Crea tu plan» (o de «Hoy»), como una imagen: sin ids ni
    // nombres (no pueden repetirse en la página) y en un contenedor `inert`, así que no se puede tocar.
    if (returning && today) {
      const copyOfToday = today.content.cloneNode(true);
      const date = copyOfToday.querySelector('[data-hoy-fecha]');
      if (date) {
        date.textContent = new Intl.DateTimeFormat('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date());
      }
      mini.append(copyOfToday);
    }
    const replica = returning && today ? null : app.querySelector('.app-screen')?.cloneNode(true);
    if (replica) {
      for (const el of [replica, ...replica.querySelectorAll('*')]) {
        for (const attr of ['id', 'for', 'name', 'role', 'aria-live', 'aria-labelledby']) {
          el.removeAttribute(attr);
        }
      }
      mini.append(replica);
    }

    const ZOOM_END = 0.72; // parte del recorrido que dura el acercamiento; el resto, la app quieta
    const GAP = 16; // px que se dejan entre los botones del titular y el portátil
    const MIN_FIT = 0.6; // si hay que encoger el portátil más que esto, mejor sin acercamiento
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const between = (p, a, b) => clamp((p - a) / (b - a));
    const smooth = (t) => t * t * (3 - 2 * t);

    // Lo que hace falta para pintar un punto del recorrido; `null` si no hay acercamiento
    // (movimiento reducido, o el titular y el portátil no caben en una pantalla).
    let geo = null;

    // Deja la portada como la pinta la hoja de estilos, sin nada de un fotograma anterior.
    const clear = () => {
      for (const el of [scene, copy, hint, app, glare]) {
        el.style.transform = '';
        el.style.opacity = '';
        el.style.visibility = '';
      }
    };

    const measure = () => {
      geo = null;
      clear();
      scene.style.minHeight = '';
      scene.style.setProperty('--fit', '1');
      // Se mide con el acercamiento puesto: el escenario mide una pantalla y el titular va encima.
      hero.classList.add('is-ready');
      let s = stage.getBoundingClientRect();
      const { width, height } = s;
      // La pantalla del aparato tiene la forma de la ventana (dentro de unos límites), así la
      // app no se recorta al llenarla: portátil en horizontal, móvil o tablet en vertical.
      const ratio = width / height;
      const shape =
        ratio >= 1 ? Math.min(2.2, Math.max(1.3, ratio)) : Math.min(0.8, Math.max(0.42, ratio));
      screen.style.aspectRatio = String(shape);

      // El portátil tiene que caber entero debajo del titular. Todo lo que hay sobre la mesa es
      // proporcional a --lw, así que basta con encogerlo en la misma proporción (--fit).
      const room = desk.getBoundingClientRect().bottom - copy.getBoundingClientRect().bottom - GAP;
      const tall = desk.getBoundingClientRect().bottom - lid.getBoundingClientRect().top;
      const fit = Math.min(1, room / tall);
      const fits = fit >= MIN_FIT;
      if (fits) scene.style.setProperty('--fit', String(fit));

      const pinned = fits && !reduced.matches;
      hero.classList.toggle('is-ready', pinned);
      // A quien entra en «Hoy», «Crea tu plan» no le sale en el acercamiento: no se puede llegar a
      // él con el tabulador. Sin acercamiento va en su sitio, como siempre.
      app.inert = Boolean(returning && today && pinned);
      if (!pinned) {
        // Sin acercamiento el titular va antes que la escena: se le guarda al portátil su alto,
        // y si los dos no caben en una pantalla, la portada sigue hacia abajo.
        const top = lid.getBoundingClientRect().top;
        scene.style.minHeight = `${scene.getBoundingClientRect().bottom - top + GAP}px`;
      }

      s = stage.getBoundingClientRect();
      const b = screen.getBoundingClientRect();
      // La copia mide lo que la ventana y se encoge hasta cubrir la pantalla del portátil.
      const k = Math.max(b.width / width, b.height / height);
      mini.style.width = `${width}px`;
      mini.style.height = `${height}px`;
      mini.style.transform = `scale(${k})`;
      if (!pinned) {
        app.classList.remove('is-on', 'is-live');
        return;
      }
      const cx = b.left - s.left + b.width / 2;
      const cy = b.top - s.top + b.height / 2;
      scene.style.transformOrigin = `${cx}px ${cy}px`;
      // Con la escala 1/k la copia mide justo lo que el escenario: ahí se cambia por la real.
      geo = { w: s.width, h: s.height, cx, cy, end: 1 / k };
    };

    // Sin recortar: por encima de 1 ya se ha pasado la portada (un enlace a #secciones, por ejemplo).
    const rawProgress = () => {
      const r = hero.getBoundingClientRect();
      return -r.top / (r.height - window.innerHeight);
    };
    const progress = () => clamp(rawProgress());

    // Entrar en «Hoy»: solo si se ha llegado al final del acercamiento bajando desde antes, en esta
    // misma visita. Así, al volver con «Atrás» (el navegador deja el scroll abajo) o al saltar a
    // otra parte de la portada con un enlace, no se vuelve a salir de ella.
    let armed = false;
    let leaving = false;
    const watchEntry = () => {
      if (!returning || !geo || leaving) return;
      const raw = rawProgress();
      if (raw < ZOOM_END - 0.05) armed = true;
      else if (armed && raw >= ZOOM_END && raw < 1) {
        leaving = true;
        window.location.assign('/hoy');
      }
    };
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      armed = false;
      leaving = false;
      watchEntry();
    });

    let target = 0;
    let current = 0;
    let frame = 0;
    const render = (p) => {
      // Escala geométrica: se siente como una cámara que avanza a velocidad constante.
      const e = smooth(between(p, 0, ZOOM_END));
      const scale = Math.pow(geo.end, e);
      const dx = (geo.w / 2 - geo.cx) * e;
      const dy = (geo.h / 2 - geo.cy) * e;
      scene.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      glare.style.opacity = String(1 - e);

      // El titular se va hacia arriba y se desvanece en el primer 20 % del recorrido.
      const t = between(p, 0.02, 0.2);
      copy.style.opacity = String(1 - t);
      copy.style.transform = `translateY(${-40 * t}px)`;
      copy.style.visibility = t >= 1 ? 'hidden' : 'visible'; // fuera del orden del tabulador
      hint.style.opacity = String(1 - between(p, 0, 0.06));

      // A quien entra en «Hoy» no se le cambia la copia por «Crea tu plan».
      if (returning && today) return;
      const swap = between(p, ZOOM_END - 0.015, ZOOM_END);
      app.style.opacity = String(swap);
      app.classList.toggle('is-on', swap > 0);
      if (p > ZOOM_END + 0.02) app.classList.add('is-live');
      else if (p < ZOOM_END - 0.05) app.classList.remove('is-live');
    };

    const loop = () => {
      frame = 0;
      if (!geo) return;
      // Un poco de inercia para que la rueda del ratón no dé saltos.
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.0005) current = target;
      render(current);
      if (current !== target) frame = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      if (!geo) return;
      target = progress();
      if (!frame) frame = requestAnimationFrame(loop);
      watchEntry();
    };

    // Al cargar y cada vez que cambia lo que cabe: el tamaño de la ventana, las fuentes (el
    // titular ocupa otra cosa) o la preferencia de movimiento.
    const layout = () => {
      measure();
      if (!geo) return;
      current = target = progress();
      render(current);
      if (rawProgress() < ZOOM_END - 0.05) armed = true;
    };

    // Con el teclado o un lector de pantalla se puede llegar a «Crea tu plan» antes de que se vea:
    // entonces se avanza el recorrido hasta el final del acercamiento, donde ya se ve entera.
    app.addEventListener('focusin', () => {
      if (!geo || app.classList.contains('is-live')) return;
      const r = hero.getBoundingClientRect();
      const top = window.scrollY + r.top + (ZOOM_END + 0.05) * (r.height - window.innerHeight);
      window.scrollTo({ top, behavior: 'instant' });
    });

    layout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    reduced.addEventListener('change', layout);
    document.fonts?.ready.then(layout);
  }
}
