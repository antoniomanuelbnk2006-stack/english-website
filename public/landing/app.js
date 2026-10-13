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
