// Entrada de elementos al verse (Tilt In, Arc In, fundidos) y menú móvil. Sin dependencias.
document.documentElement.classList.add('js');

const targets = document.querySelectorAll('.fade, .tilt, .arc');
const reveal = (el) => el.classList.add('in');
if (!('IntersectionObserver' in window)) targets.forEach(reveal);
else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.15 },
  );
  targets.forEach((el) => io.observe(el));
}

// Las tarjetas de una misma fila se escalonan 100 ms cada una, como en Wix.
document.querySelectorAll('.stagger').forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty('--d', `${(i + 1) * 0.1}s`));
});

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

// El formulario no tiene servidor: prepara un correo con lo escrito.
const form = document.querySelector('#solicitud');
if (form) {
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
    window.location.href = `mailto:hola@senal-english.com?subject=${encodeURIComponent('Solicitud de información')}&body=${encodeURIComponent(body)}`;
  });
}
