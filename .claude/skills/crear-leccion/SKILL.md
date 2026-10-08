---
name: crear-leccion
description: Crear, generar, revisar o publicar lecciones de Señal (escucha o lectura, cualquier nivel A1–C2) siguiendo el currículo, el modelo de contenido, el pipeline y el control de calidad. Úsala cuando se pida una lección nueva, un lote de una unidad, regenerar tareas, arreglar una lección que no pasa la validación o publicar contenido.
---

# Crear lecciones de Señal

Esta skill guía el flujo completo de contenido. **Lee primero** (si no lo has hecho en esta sesión):
- `docs/04-arquitectura/04-modelo-de-contenido.md` — el contrato (esquemas e invariantes).
- `docs/05-contenido/01-pipeline.md` — los pasos y comandos.
- `docs/05-contenido/02-control-de-calidad.md` — umbrales.
- El documento del nivel en `docs/02-curriculo/{A1..C2}.md`.

## 1. Decide el modo

| Situación | Modo |
|---|---|
| No existen aún `content:generate`/`content:review` (fases 1–3 del roadmap) | **Manual**: escribe tú el borrador JSON |
| Existe el pipeline completo (fase 4+) | **Automático**: especificación YAML → `pnpm content:run` |
| Una lección concreta falla el QA | **Reparación**: regenera solo lo que falla |

## 2. Especificación

1. Localiza la unidad en el currículo del nivel (tabla «Unidades»). Usa sus descriptores `can_do`, `grammar_focus`, temas y rasgos de habla conectada.
2. Crea o actualiza `content/specs/{nivel}/{unidad}-{slug}.yaml` con el formato de `docs/02-curriculo/00-como-leer-el-curriculo.md` §6.
3. IDs: `{nivel}-{lis|rea}-{nnn}` correlativos por nivel y destreza (busca el último existente en `content/lessons/{nivel}/`).
4. Respeta la especificación del nivel: velocidad, duración/longitud, acentos permitidos (proporción de no estándar), tipos de tarea.

## 3. Borrador

**Manual:** escribe `content/lessons/{nivel}/{listening|reading}/{id}.json` siguiendo los ejemplos de `docs/05-contenido/ejemplos/` y las reglas de los prompts de `docs/05-contenido/04-prompts-de-generacion.md` (§3 escucha, §4 lectura). `status: "draft"`, `version: 1`, `provenance` completo.

**Automático:** `pnpm content:generate --spec <yaml>` (Batch API; reanudable).

Comprobaciones mientras escribes:
- Segmentos ≤ 20 palabras; frases de lectura con IDs `p{n}s{m}`.
- Cada pregunta con `evidence` real, `rationale_es` en español de España.
- Opciones parafraseadas; la correcta no siempre en la misma letra ni siempre la más larga.
- Cada palabra por encima del nivel, en el glosario (con `surface` literal y `ref` correcto).
- `connected_speech` con frases literales del texto.
- Al menos una pregunta de inferencia/actitud desde B1; una «NG» en `true_false_ng` cuando tenga sentido.
- Dictado (escucha): 2–4 segmentos con rasgos de habla conectada; `reference` = texto exacto del segmento.

## 4. Validar y anotar

```bash
pnpm content:validate                 # esquemas + invariantes (I-1 … I-12)
pnpm content:annotate --ids <ids>     # tokens, lemas, niveles, cobertura, legibilidad, glosario que falte
```

Si falla la cobertura léxica del nivel (tabla §2.1 del control de calidad), sustituye palabras o glósalas; no bajes los umbrales.

## 5. Revisar

```bash
pnpm content:review --ids <ids>
```

Pasa a `reviewed` solo si: `answerable_with_text ≥ 0.9`, `answerable_without_text ≤ 0.4`, `level_ok`, `score ≥ 7` y 0 *blockers*. Si una pregunta concreta falla, **regenera solo esa tarea**.

## 6. Audio

```bash
pnpm content:tts --ids <ids>      # vigila el contador de caracteres del mes (capa gratuita de Azure)
pnpm content:audio --ids <ids>    # comprueba −16 LUFS ±1 y ppm dentro de ±8 % del objetivo
pnpm content:upload --ids <ids>
```

Voces: `scripts/content/voices.ts`; dos hablantes nunca comparten voz.

## 7. Publicar

1. Pide al usuario que la escuche/lea en `/studio` (o hazlo tú si solo hay que comprobar datos).
2. `status: "published"` y `provenance.reviewed_by`.
3. `pnpm content:validate && pnpm content:index`.
4. Commit en inglés: `content(b1): add b1-lis-002 voicemail about cloudy night`.

## 8. Cambios en lecciones publicadas

- Cualquier cambio de texto, tareas o audio ⇒ `version + 1` y audio nuevo `v{n}.m4a` (nunca sobrescribir).
- No cambies IDs de tareas existentes: los intentos guardados los referencian.

## Errores frecuentes

| Síntoma | Causa típica |
|---|---|
| I-3 falla | `evidence` apunta a `s12` pero la respuesta está en `s13` tras reordenar segmentos |
| I-7 falla | La `surface` del glosario no coincide literalmente (plural, mayúsculas con apóstrofo curvo) |
| `answerable_without_text` alto | La correcta es «obvia» por cultura general o es la única plausible |
| ppm fuera de rango | Frases muy cortas con muchas pausas, o `rate` de SSML mal ajustado |
