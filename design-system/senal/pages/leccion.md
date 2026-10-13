# Lección (lectura y escucha) — lo que se aparta de MASTER

Rutas: `/leer/[id]` y `/escuchar/[id]`. Solo lo que cambia respecto a [MASTER](../MASTER.md).

## Layout

MASTER pide una columna centrada de 680 px en las pantallas de ejercicio. Una lección la usa en
todas las fases de **una sola columna**, y se ensancha al contenedor de página (1.200 px) en las
fases donde el texto convive con las preguntas:

| Lección | Fases en columna de 680 px | Fases a 1.200 px, en dos columnas |
|---|---|---|
| Lectura | Preparar | Vistazo, Lectura, Preguntas, Foco, Resultado |
| Escucha | Todas las demás | Texto (transcripción + repaso de las preguntas) |

- En dos columnas: el texto a la izquierda (máx. 68 caracteres por línea) y, a la derecha, un
  panel de 22–26 rem que se queda fijo bajo la cabecera al hacer scroll.
- Por debajo de 1.280 px no caben las dos: en la lectura se ve una cada vez, con dos pestañas
  en píldora; en la escucha, el repaso de las preguntas va debajo de la transcripción.
- En la fase **Lectura** no hay panel: el texto va solo y centrado, sin tarjeta alrededor.

## Fondo de papel

Si en Ajustes está marcado «Fondo de papel en el lector», el texto de la lectura va dentro de un
contenedor con `data-theme="paper"` (ver [ajustes](ajustes.md)). Es la única superficie clara
dentro de una pantalla oscura.

## Acción principal

Una por fase: «Empezar…», «Comprobar», «Continuar». El reproductor no cuenta como acción: su
botón de reproducir es secundario y el cobalto lo lleva la onda, que es una barra de progreso.
