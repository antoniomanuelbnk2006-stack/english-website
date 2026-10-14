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
  const PREFERENCE_STORAGE = ['senal:accent'];
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
  };

  const open = () => {
    if (banner) return banner;
    banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-label', 'Cookies');

    const text = document.createElement('p');
    text.append(
      'Señal usa cookies necesarias para que puedas entrar y, si aceptas, para recordar tu sesión y tus preferencias: tema, idioma y acento. No hay análisis ni publicidad. ',
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

// Portada: «Crea tu plan», la pantalla final del acercamiento (portada.md). Cuatro preguntas, una
// por paso: el idioma, el nivel, para qué y cuánto tiempo al día; después, el resumen. Por ahora no
// se guarda nada: el resumen lleva a entrar en Señal. Sin JavaScript se ven todas a la vez. Va antes
// que el acercamiento, que copia esta pantalla en el portátil tal como queda al empezar.
{
  const form = document.querySelector('#plan');

  if (form) {
    const steps = [...form.querySelectorAll('.plan-step')];
    const summary = form.querySelector('.plan-summary');
    const count = form.querySelector('#plan-paso');
    const error = form.querySelector('#plan-error');
    const actions = form.querySelector('[data-plan="pasos"]');
    const back = form.querySelector('[data-plan="atras"]');
    const next = actions.querySelector('[type="submit"]');
    const exam = form.querySelector('[data-exam]');
    const out = (name) => form.querySelector(`[data-out="${name}"]`);
    const picked = (name) => form.querySelector(`input[name="${name}"]:checked`);

    // El examen oficial de cada idioma, para la opción «Aprobar el examen oficial» y el resumen.
    const EXAMS = {
      en: ['Cambridge English', 'Aprobar un examen de Cambridge'],
      es: ['DELE', 'Aprobar el DELE'],
      fr: ['DELF y DALF', 'Aprobar el DELF o el DALF'],
      zh: ['HSK', 'Aprobar el HSK'],
      ja: ['JLPT', 'Aprobar el JLPT'],
    };

    let current = 0;
    const show = (index) => {
      current = index;
      steps.forEach((step, i) => {
        step.hidden = i !== index;
      });
      const done = index >= steps.length;
      summary.hidden = !done;
      actions.hidden = done;
      back.hidden = index === 0;
      next.textContent = index === steps.length - 1 ? 'Ver mi plan' : 'Siguiente';
      count.textContent = done ? 'Listo' : `Paso ${index + 1} de ${steps.length}`;
      form.dataset.step = String(index + 1);
      error.textContent = '';
    };
    // Al cambiar de paso, el foco va a la respuesta elegida o a la primera: así se sigue con el
    // teclado sin volver a buscar dónde estaba.
    const focus = () => {
      if (current >= steps.length) summary.focus();
      else (steps[current].querySelector('input:checked') ?? steps[current].querySelector('input'))?.focus();
    };

    const fill = () => {
      const language = picked('idioma');
      const goal = picked('objetivo');
      out('idioma').textContent = language.dataset.summary;
      out('nivel').textContent = picked('nivel').dataset.summary;
      out('objetivo').textContent =
        goal.value === 'examen' ? EXAMS[language.value][1] : goal.dataset.summary;
      out('minutos').textContent = `${picked('minutos').value} minutos`;
      out('nota').textContent =
        language.value === 'en'
          ? 'Las lecciones, los repasos y los simulacros de Cambridge de inglés ya están en Señal.'
          : `Estamos preparando las lecciones de ${language.dataset.summary.toLowerCase()}. De momento, en Señal están las de inglés.`;
    };

    form.addEventListener('change', (event) => {
      error.textContent = '';
      if (event.target.name === 'idioma') exam.textContent = EXAMS[event.target.value][0];
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!steps[current]?.querySelector('input:checked')) {
        error.textContent = 'Elige una opción para seguir.';
        steps[current]?.querySelector('input')?.focus();
        return;
      }
      if (current === steps.length - 1) fill();
      show(current + 1);
      focus();
    });
    back.addEventListener('click', () => {
      show(current - 1);
      focus();
    });
    form.querySelector('[data-plan="cambiar"]').addEventListener('click', () => {
      show(0);
      focus();
    });

    show(0);
  }
}

// Portada: acercamiento al portátil con el scroll (design-system/senal/pages/portada.md, «Hero»).
// La escena se acerca a la pantalla del portátil hasta que la copia de «Hoy» que lleva dentro
// ocupa la ventana; en ese momento se cambia por la misma pantalla a tamaño real, que se ve nítida.
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

    // En el portátil va una copia de «Crea tu plan», como una imagen: sin ids ni nombres (no pueden
    // repetirse en la página) y en un contenedor `inert`, así que no se puede tocar.
    const replica = app.querySelector('.app-screen')?.cloneNode(true);
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

    const progress = () => {
      const r = hero.getBoundingClientRect();
      return clamp(-r.top / (r.height - window.innerHeight));
    };

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
    };

    // Al cargar y cada vez que cambia lo que cabe: el tamaño de la ventana, las fuentes (el
    // titular ocupa otra cosa) o la preferencia de movimiento.
    const layout = () => {
      measure();
      if (!geo) return;
      current = target = progress();
      render(current);
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
