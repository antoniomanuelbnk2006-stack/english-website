# ADR-0032 · Cinco idiomas, para todo el público; la interfaz, en el idioma del navegador

- **Estado:** Aceptada (cambia el alcance de la [visión](../00-vision/01-vision-y-alcance.md) y, cuando se abra el registro, el [ADR-0010](0010-un-solo-usuario.md))
- **Fecha:** 2026-10-14

## Contexto

Señal nació para una persona hispanohablante que aprende inglés. El dueño ha decidido ampliarla:

- **Cinco idiomas para practicar:** español, inglés, francés, chino (mandarín) y japonés. Cada usuario elige el suyo.
- **Para todo el público**, no solo para él.
- **La interfaz en el idioma de cada usuario.** Lo pidió «según la ubicación».

Pidió ir paso a paso y dejar para el final todo lo que tenga coste.

## Decisión

El trabajo va en cuatro fases, cada una utilizable por sí sola:

1. **Interfaz en cinco idiomas** (esta). La app, la portada, el aviso de cookies y las páginas legales.
2. **La base para practicar varios idiomas.** El selector «idioma que practicas», el progreso por idioma, la escritura de chino y japonés (separar palabras, pinyin y furigana) y la capa de ayuda en el idioma de cada usuario.
3. **Abrir la web:** crear cuenta, servicio de correo propio, captcha, condiciones de uso, borrar la cuenta y límites de IA por usuario.
4. **El contenido de cada idioma**, de A1 a B1 primero, y después sus exámenes (DELE, DELF, HSK, JLPT).

Lo que tiene coste (voces de Azure para los idiomas que no son inglés, más almacenamiento, correo, generar contenido con IA) queda para el final.

Para la fase 1:

1. **Idiomas de interfaz:** `es`, `en`, `fr`, `zh` (chino simplificado) y `ja`, en `src/lib/i18n` (un diccionario por idioma, con las mismas claves que `es.ts`; un test lo exige). En el selector, cada idioma aparece con su propio nombre («Français», «简体中文», «日本語»).
2. **Se elige por el idioma del navegador, no por el país.** El idioma del navegador es el que el usuario tiene puesto. El país engaña: alguien de viaje, o un país con varios idiomas. Para detectarlo no hace falta guardar nada: llega en cada petición (`Accept-Language`). El chino tradicional cae en el simplificado, que es el que hay.
3. **Orden para decidir:**
   1. El idioma elegido en la dirección (`?lang=fr`).
   2. La cookie de preferencias, si se aceptó.
   3. El perfil de quien ha entrado.
   4. El idioma del navegador.
   5. Si no es ninguno de los cinco, **inglés**.
   Dentro de la app manda el perfil, que se cambia en Ajustes.
4. **Elegir otro idioma sin haber entrado:** la pantalla de acceso lleva un enlace por idioma (`?lang=`). Vale para esa página y no guarda nada, así que no necesita consentimiento. El proxy pasa ese idioma al renderizado en una cabecera propia y descarta la que pudiera llegar de fuera.
5. **Chino y japonés con las fuentes del sistema.** Inter y Archivo no tienen esos caracteres. Se añaden detrás, por idioma (`:lang(zh)`, `:lang(ja)`), porque un mismo carácter se dibuja distinto en chino y en japonés. No se descarga nada: las fuentes CJK pesan varios megas. `<html lang>` lleva la etiqueta completa (`zh-CN`) para que el navegador y los lectores de pantalla acierten.
6. **La base de datos admite los cinco idiomas** en `profiles.ui_locale` (migración 0008).

## Alternativas consideradas

- **El país por la IP.** Es lo que se pidió con «según la ubicación», pero falla justo en los casos que importan, depende del alojamiento (Vercel da la cabecera; otro servidor quizá no) y sigue sin servir a quien vive en un país y habla otro idioma.
- **El idioma en la ruta** (`/fr/hoy`). Es lo habitual para buscadores, pero obliga a rehacer todas las rutas de la app, que son privadas y no se indexan. Para la portada pública sí se usará (siguiente paso de esta fase).
- **Recordar en una cookie el idioma elegido sin haber entrado.** Es una cookie de preferencias: necesitaría consentimiento (ADR-0028). Con la dirección basta.
- **Descargar Noto Sans SC y Noto Sans JP.** Más uniformes, pero pesan mucho y todos los sistemas traen ya fuentes buenas para esos idiomas.

## Consecuencias

- **Lo que se traduce en esta fase es la interfaz, no la ayuda de las lecciones.** Glosas, fichas de gramática, consejos de pronunciación y correcciones siguen escritos para hispanohablantes que aprenden inglés. Los textos de la interfaz que hablan de ello lo dicen tal cual («traducción al español», «explicada en español»). La capa de ayuda en cada idioma es de la fase 2.
- Las traducciones de chino y japonés conviene que las revise alguien nativo.
- Un texto nuevo de la interfaz se escribe en los cinco diccionarios; el test de diccionarios falla si falta en alguno.
- La migración 0008 hay que aplicarla en producción antes de desplegar, o guardar un idioma nuevo en Ajustes fallaría.
- La detección no depende de Vercel: funcionará igual en el alojamiento al que se mude la web.
