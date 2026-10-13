# Simulacro de examen — lo que se aparta de MASTER

Rutas: `/examenes/[id]` y `/examenes/[id]/resultado`. Solo lo que cambia respecto a
[MASTER](../MASTER.md).

## Layout

- La prueba usa el **contenedor de página (1.200 px)**, no la columna de 680 px: en las partes con
  un texto largo, el texto va a un lado y las preguntas al otro; la columna que se queda fija
  bajo la barra tiene su propio scroll. Por debajo de 1.280 px se apilan.
- El resultado (`/resultado`) sí es una columna de 680 px.

## Barra de la prueba

Mientras dura la prueba hay una barra fija bajo la cabecera con el reloj (o la cinta, en
Listening), las preguntas respondidas, «Entregar» y las partes. Es translúcida como la cabecera
y la separa del contenido un divisor (`border`).

## Acciones

- En el índice (`/examenes`), «Empezar» y «Repetir» son **secundarios**: hay una por prueba y
  varias en pantalla, así que ninguna es *la* acción.
- Dentro de la prueba el cobalto es «Empezar la prueba» y, al confirmar la entrega, «Entregar
  ahora». El «Entregar» de la barra es secundario: solo abre la confirmación.
- El aviso de tiempo (últimos cinco minutos) usa `warning` como texto, nunca como fondo.
