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

// Portada: acercamiento al portátil con el scroll (design-system/senal/pages/portada.md, «Hero»).
// La escena se acerca a la pantalla del portátil hasta que la copia de «Hoy» que lleva dentro
// ocupa la ventana; en ese momento se cambia por la misma pantalla a tamaño real, que se ve nítida.
// Solo se tocan propiedades del CSSOM (transform, opacity…): la CSP de la portada no admite
// atributos style="…", pero sí esto.
{
  const hero = document.querySelector('.zoom-hero');
  const template = document.querySelector('#pantalla-hoy');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (hero && template) {
    const stage = hero.querySelector('.zoom-stage');
    const scene = hero.querySelector('.zoom-scene');
    const desk = hero.querySelector('.scene-desk');
    const lid = hero.querySelector('.laptop-lid');
    const screen = hero.querySelector('.laptop-screen');
    const mini = hero.querySelector('.zoom-mini');
    const glare = hero.querySelector('.laptop-glare');
    const copy = hero.querySelector('.zoom-copy');
    const hint = hero.querySelector('.zoom-hint');
    const app = hero.querySelector('.zoom-app');

    // La misma pantalla dos veces: en el portátil y a tamaño real. Con la fecha de hoy en Madrid.
    const today = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Madrid',
    }).format(new Date());
    for (const target of [mini, app]) {
      const clone = template.content.cloneNode(true);
      const date = clone.querySelector('.rep-date');
      if (date) date.textContent = today;
      target.append(clone);
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

    layout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    reduced.addEventListener('change', layout);
    document.fonts?.ready.then(layout);
  }
}
