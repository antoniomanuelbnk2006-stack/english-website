# ADR-0029 · Política de privacidad, aceptación expresa en el formulario y solo nombre y correo en el pie

- **Estado:** Aceptada
- **Fecha:** 2026-10-14

## Contexto

Al pedir el consentimiento de cookies ([ADR-0028](0028-consentimiento-de-cookies.md)), el dueño pidió que con la política de privacidad pasara lo mismo «en el caso de tener una»: que sea el usuario quien la acepte o la rechace. La web no tenía ninguna, y el formulario de contacto pide nombre, apellidos, correo, nivel y un mensaje.

El dueño dijo que el responsable de los datos es él, y pidió quitar su teléfono del pie de todas las páginas y dejar solo su nombre y su correo. El pie enseñaba también un código postal y la ciudad, que venían de la plantilla de Wix.

## Decisión

1. **Una política de privacidad pública**, `/landing/privacidad.html`, escrita para quien la lee: qué datos, para qué, por qué se puede, cuánto tiempo, quién más interviene y qué derechos hay. Cubre las tres situaciones reales: escribir desde el formulario (o al correo), tener cuenta en la app y, simplemente, visitar la web.
2. **El responsable es el dueño**, con su nombre y su correo como único dato de contacto.
3. **El formulario no se envía sin aceptarla:** casilla sin marcar y obligatoria (`required`), con un enlace a la política y, debajo, la información básica (quién es el responsable, para qué se usan los datos y cómo ejercer los derechos). Es la primera capa de información; la política es la segunda.
4. **El pie de todas las páginas públicas** lleva solo el nombre y el correo, y enlaza la política de privacidad, la de cookies y «Configurar cookies». Fuera el teléfono y la dirección.
5. **Desde la app** se llega a la política en la pantalla de acceso y en Ajustes («Acerca de»).
6. **Los plazos que la política fija:** los mensajes de contacto se borran como mucho un año después de la última respuesta; los datos de una cuenta, mientras exista. Los ha propuesto quien escribe esto y el dueño puede cambiarlos.

## Alternativas consideradas

- **No escribir política, porque la app la usa una sola persona.** La parte pública sí recoge datos de otros (el formulario) y la dirección IP de cualquier visita pasa por los proveedores.
- **Aceptación implícita** («al enviar aceptas…»). El dueño pidió que el usuario decida, y una casilla sin marcar no deja dudas.
- **Un aviso legal con NIF y dirección** (artículo 10 de la LSSI). Solo hace falta si la web es una actividad económica, y el dueño pidió no publicar más datos que su nombre y su correo. Si un día cobra por algo, hay que añadirlo.
- **Condiciones de uso.** No se puede crear una cuenta desde la web: no hay nada que aceptar. Harán falta si se abre el registro.

## Consecuencias

- Lo que la web recoja de nuevo, o un proveedor nuevo, hay que contarlo en la política y actualizar su fecha.
- El formulario sigue sin servidor (prepara un correo); la casilla solo la comprueba el navegador, que es todo lo que hace falta, porque sin enviar el correo no llega nada.
- Los tests e2e comprueban que el pie de cada página pública no lleva teléfono ni dirección, que el formulario no se envía sin la casilla y que la política se ve sin sesión.
- La política dice que no hay exportar ni borrar desde Ajustes: se pide por correo. Si se construyen, hay que cambiarla.
