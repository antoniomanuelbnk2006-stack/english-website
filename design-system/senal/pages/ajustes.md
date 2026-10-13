# Ajustes y temas — lo que se aparta de MASTER

Ruta: `/ajustes`. Solo lo que cambia respecto a [MASTER](../MASTER.md).

## Temas

MASTER define una interfaz oscura. Ajustes deja elegir además **claro**, **según el sistema** y
un **fondo de papel** para el lector; se conservan porque ya existían. No son otro diseño: mismo
cobalto, misma tipografía y mismas formas, con los niveles de fondo invertidos.

| Token | Oscuro (MASTER) | Claro | Papel |
|---|---|---|---|
| `canvas` | `#171721` | `#f5f5f9` | `#f3efe4` |
| `surface` | `#1e1e2a` | `#ffffff` | `#faf7ee` |
| `surface-2` | `#272735` | `#e9e9f1` | `#e9e4d6` |
| `border` | `#70707d` | `#7a7a8a` | `#827c6e` |
| `border-soft` | `#e2e3ed` | `#2c2c3a` | `#2c2c3a` |
| `text` | `#ededf3` | `#171721` | `#171721` |
| `muted` | `#c3c3cc` | `#4b4b5a` | `#4b4b5a` |
| `accent` | `#5266eb` | `#5266eb` | `#5266eb` |
| `accent-text` | `#8b98ff` | `#3447c8` | `#3447c8` |
| `success` / `error` / `warning` | `#6cbf95` / `#e07575` / `#d8ad5a` | `#17603b` / `#a52c2c` / `#6f4a00` | como el claro |

- Los valores viven en `src/styles/globals.css`; esta tabla solo los explica.
- `src/styles/contrast.test.ts` exige a los tres temas lo mismo que MASTER al oscuro.
- «Papel» no es un tema de la app: se aplica solo al contenedor del texto en el lector (y a la
  muestra de Ajustes).
- El logotipo es de un solo tono: claro sobre fondo oscuro y oscuro sobre fondo claro.

## Controles nativos

Las casillas, los botones de opción y los deslizadores son los del navegador, teñidos con el
cobalto (`accent-color`). Los temas de interés son píldoras con su casilla dentro: marcada, la
píldora lleva el borde cobalto y el texto en `accent-text`.
