# ADR-0037 · Los datos del usuario, por idioma

- **Estado:** Aceptada (tercer paso de la base para practicar varios idiomas; sigue a [ADR-0036](0036-idioma-que-practicas.md))
- **Fecha:** 2026-10-18

## Contexto

Con el selector de idioma (ADR-0036), cada sección enseña solo el contenido del idioma que se practica. Pero el nivel declarado, los niveles por destreza, el léxico y las tarjetas de repaso eran únicos por usuario: un B2 de inglés habría servido de nivel para un A1 de español, y la palabra «come» habría sido la misma en los dos idiomas.

## Decisión

1. **Lo que depende de la lengua lleva `language`** (migración `0009_datos_por_idioma.sql`):
   - `skill_ratings` y `rating_history`: los niveles por destreza son de cada idioma. La clave pasa a `(user_id, language, skill)`.
   - `lexicon`: `(user_id, language, lemma)`. Un lema puede estar en dos idiomas, cada uno con su estado.
   - `srs_cards`: la unicidad (una tarjeta por palabra) incluye el idioma.
   - **Nivel declarado:** tabla nueva `language_levels (user_id, language, declared_level)`, con las mismas políticas que el resto (leer, crear y cambiar lo propio).
2. **Lo ligado a un contenido no cambia.** `lesson_progress`, `item_attempts`, `listening_diagnostics` y `writing_submissions` apuntan a un id de contenido, y ese id ya dice el idioma (`es-a1-rea-001`, ADR-0035). La actividad diaria, la racha, el diario, el plan y los límites de la IA siguen siendo del usuario: estudiar español cuenta para la racha de inglés.
3. **Nada de lo que ya existe se mueve.** Las columnas nuevas valen `'en'` por defecto y todo lo anterior es de inglés. El nivel de `profiles.declared_level` se copia a `language_levels` (inglés); la columna se deja sin uso, para quitarla en otra migración cuando todo esté probado.
4. **`apply_lesson_attempts` recibe el idioma de la lección** (`p_language`, por defecto `'en'`): sus ratings y su historial son de ese idioma. Al cambiar la firma, la migración quita la anterior.
5. **Los ratings de un idioma se crean al usarlo.** Un usuario nuevo tiene sus seis ratings de inglés (el disparador no cambia); de otro idioma se leen como el valor inicial hasta que guarda la primera lección.
6. **En el código, el idioma sale del contenido cuando hay contenido, y del perfil cuando no.** Guardar el resultado de una lección, de una ficha, de un ejercicio o de una consigna usa el idioma de su id (`languageOfId`); el repaso, el mazo de palabras, el léxico y los listados usan el idioma que practica (`getPracticeLanguage()`). `levelOfLemma(lemma, idioma)` lee las listas de ese idioma; los que aún no las tienen no dan nivel a ninguna palabra.

## Alternativas consideradas

- **Guardar los datos por idioma en `settings` (jsonb).** Sin migración, pero sin claves ni restricciones, y el léxico tiene miles de filas.
- **Prefijar el lema (`es:come`).** Evita cambiar claves, pero ensucia cada consulta y los datos.
- **Una base de datos o un perfil por idioma.** Duplica la cuenta, los ajustes y la racha.
- **Quitar `profiles.declared_level` ya.** Quedaría más limpio, pero sin vuelta atrás si algo falla al desplegar: se quitará después.

## Consecuencias

- **Producción:** la migración la aplica el dueño (`npx supabase db push`). Los datos que hay no cambian de sitio ni se pierden. Pero **migración y código van juntos**: el código anterior usa las claves antiguas (`user_id,lemma`, `user_id,skill`) y fallaría con las nuevas, así que hay que aplicar la migración justo antes de publicar la versión que la usa, y no volver al código anterior sin deshacer la migración. Antes de aplicarla, copia de seguridad con `pg_dump` (`copias-bd/`).
- Cambiar de idioma lleva a elegir nivel en el nuevo (si no lo tiene, `/hoy` lleva a `/nivel`), y a ver sus tarjetas, su léxico y sus niveles, vacíos al principio.
- Una lección de otro idioma abierta por su dirección usa el idioma de la lección para guardar ratings, tarjetas y exposición, pero el estado de las palabras que se ve (cobertura, glosario) es el del idioma que se practica. Basta con cambiar el selector.
- El repaso muestra solo las tarjetas del idioma que se practica; el tope de tarjetas nuevas al día y el tiempo repasado hoy siguen contando todos los idiomas juntos.
- Falta, para tener español de verdad: las listas de palabras por nivel de ese idioma (`content/es/wordlists/`) y su búsqueda de palabras (Wiktionary y el mazo siguen siendo de inglés).
