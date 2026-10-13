# Writing — lo que se aparta de MASTER

Rutas: `/escribir/[id]` y `/escribir/historial/[id]`. Solo lo que cambia respecto a
[MASTER](../MASTER.md).

## Layout

Las dos usan el **contenedor de página (1.200 px)** en dos columnas a partir de 1.024 px, en vez
de la columna de 680 px:

- **Al escribir:** la consigna (con los consejos y el plan) a la izquierda y el texto a la
  derecha, algo más ancho (5 / 7).
- **Al corregir:** el texto con lo corregido resaltado y la reescritura a la izquierda; la
  corrección a la derecha. Así al entregar no cambia la disposición de la pantalla.

Por debajo de 1.024 px, al escribir se apilan y al corregir son dos pestañas en píldora.

## Acción principal

Con la corrección con IA disponible, «Corregir con IA» es la acción cobalto y «Revisar sin IA» la
secundaria; si no lo está, la cobalto es «Revisar sin IA».

## Texto corregido

Lo corregido se marca con el cobalto al 30 % de fondo; el significado no depende del color
porque cada corrección se lee, con su explicación, en la columna de al lado.
