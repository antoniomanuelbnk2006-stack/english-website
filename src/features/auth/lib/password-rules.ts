// Reglas de la contraseña de acceso (docs/adr/0026-contrasena-en-vez-de-codigo-fijo.md). Sin
// dependencias: las comparten el formulario (navegador), el servidor y el script que la pone.

/** Con menos que esto, quien sepa el email solo tendría que probar: es lo que le pasaba al código fijo. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** El apartado de Ajustes donde se pone la contraseña (ADR-0031): `/ajustes#contrasena`. */
export const PASSWORD_SECTION_ID = 'contrasena';
