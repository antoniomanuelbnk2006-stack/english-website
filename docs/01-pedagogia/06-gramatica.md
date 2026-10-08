# Gramática: al servicio de la comprensión

> **Propósito:** qué papel tiene la gramática en Señal, cómo son las fichas y cómo se conectan con los textos y con tus errores.
> **Relacionado:** [Currículo](../02-curriculo/00-como-leer-el-curriculo.md) · [Errores típicos](09-errores-hispanohablantes.md) · [Modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md)

---

## 1. Principios

1. **Gramática para entender antes que para producir.** En B1→B2 lo urgente es *reconocer* estructuras complejas al leer y escuchar (pasivas, relativas reducidas, condicionales mixtas, inversión, *cleft sentences*), no producirlas todas.
2. **Breve y en español.** Cada ficha cabe en una pantalla de móvil. La explicación, en español; los ejemplos, en inglés con audio.
3. **Contrastiva.** Cada ficha dice **en qué se parece y en qué no al español**, porque ahí nacen los errores.
4. **Contextualizada.** Toda ficha enlaza con las lecciones donde aparece la estructura, y las lecciones enlazan a sus fichas (`grammar_focus`).
5. **Cómo suena.** Muchas estructuras «desaparecen» en el habla (*I'd have*, *you've been*, *should've*): la ficha incluye su forma oral.
6. **Reciclada.** Los errores de tus writings y de los ejercicios generan tarjetas `grammar` en el SRS.

---

## 2. Formato de una ficha

Las fichas viven en `content/grammar/{nivel}/{id}.mdx`. ID: `{nivel}.{slug}` (p. ej. `b1.present-perfect-vs-past-simple`).

```mdx
---
id: b1.present-perfect-vs-past-simple
level: B1
title: "Present perfect vs past simple"
summary_es: "Pasado con conexión al presente vs pasado cerrado."
skills: [reading, listening, writing]
related: [a2.past-simple, b1.present-perfect-continuous]
---

## En una frase
## Forma
## Uso
## Contraste con el español
## Errores típicos
## Cómo suena
## Ejemplos (con audio)
## Mini-práctica (5 ítems)
## Dónde aparece (generado: lecciones con este grammar_focus)
```

---

## 3. Ficha de ejemplo

### `b1.present-perfect-vs-past-simple` — *Present perfect vs past simple*

**En una frase.** El *present perfect* habla de un pasado **conectado con ahora** (experiencia, resultado, periodo no terminado); el *past simple*, de un pasado **cerrado** (cuándo exacto o periodo terminado).

**Forma.**
- *Present perfect*: `have/has + participio` → *I've finished. She hasn't called. Have you ever been to Dublin?*
- *Past simple*: `verbo-ed / irregular` → *I finished at six. She didn't call yesterday.*

**Uso.**

| Present perfect | Past simple |
|---|---|
| Experiencia sin fecha: *I've seen that film.* | Momento concreto: *I saw it last week.* |
| Resultado presente: *I've lost my keys* (no las tengo). | Historia terminada: *I lost my keys and found them later.* |
| Periodo abierto: *I've drunk three coffees today.* | Periodo cerrado: *I drank three coffees yesterday.* |
| Con *for/since* hasta ahora: *I've lived here for two years.* | Con *for* en algo terminado: *I lived there for two years* (ya no). |

**Contraste con el español.** Se parece al pretérito perfecto español («he terminado»), pero:
- En muchas zonas de España se dice «esta mañana **he ido**» → en inglés, si la mañana ya pasó, **past simple**: *I went this morning*.
- «Llevo dos años viviendo aquí» → *I've lived / I've been living here for two years* (¡no presente!: ✗ *I live here since two years*).

**Errores típicos.**
- ✗ *I have seen him yesterday.* → ✓ *I saw him yesterday.*
- ✗ *I live here since 2020.* → ✓ *I've lived here since 2020.*
- ✗ *When have you arrived?* → ✓ *When did you arrive?* (*when* pide momento → past simple)

**Cómo suena.** En el habla, *have/has* se reducen y casi no se oyen:
- *I've been* → /aɪv bɪn/ (a veces /aɪbɪn/)
- *She's finished* → /ʃiːz ˈfɪnɪʃt/ (*'s* = *has*, no *is*: lo distingue el participio)
- *Have you ever…?* → /həvjə ˈevə/

Pista de escucha: si oyes un participio (*been, done, seen, finished*) tras un sujeto, busca el *'ve* / *'s* «invisible».

**Ejemplos (con audio).**
1. *Have you ever seen a meteor shower?* — *No, I haven't. I've never been anywhere dark enough.*
2. *I've just finished the mod. I started it in March.*

**Mini-práctica.**
1. I ___ (never / try) sushi. → *have never tried*
2. We ___ (go) to Lisbon last summer. → *went*
3. ___ you ___ (finish) the report yet? → *Have / finished*
4. She ___ (live) in Seville since 2019. → *has lived*
5. When ___ you ___ (start) learning English? → *did / start*

---

## 4. Gramática receptiva prioritaria para B1→B2

Estructuras que más bloquean la **comprensión** a tu nivel (las fichas de estas van primero en el roadmap de contenido):

| ID | Estructura | Por qué bloquea |
|---|---|---|
| `b1.relative-clauses-defining` | Relativas especificativas, con *that* omitido | *The game (that) I told you about* — el «que» desaparece |
| `b2.reduced-relative-clauses` | Relativas reducidas | *The players living in Japan…* = *who live* |
| `b1.passive-present-past` / `b2.passive-all-tenses` | Pasiva | *It was found that…*, *has been released* |
| `b2.mixed-conditionals` | Condicionales mixtas | *If I'd studied, I'd be…* — con *'d* ambiguo |
| `b1.phrasal-verbs-separable` | Verbos frasales | *turn it down*, *pick you up* |
| `b2.noun-phrases-premodification` | Grupos nominales largos | *a three-day open-source game jam* |
| `b2.linking-contrast-concession` | Conectores de contraste | *though, even so, whereas, despite* |
| `b2.reporting-verbs` | Verbos de estilo indirecto | *claim, deny, admit, suggest* + patrón |
| `c1.inversion-negative-adverbials` | Inversión | *Not only did they…*, *Rarely have I…* |
| `c1.cleft-sentences` | Oraciones escindidas | *What surprised me was…*, *It was Leo who…* |
| `c1.ellipsis-substitution` | Elipsis y sustitución | *So do I*, *I'd like to*, *the former/the latter* |

El alcance completo por nivel está en cada documento del [currículo](../02-curriculo/00-como-leer-el-curriculo.md).

---

## 5. Requisitos funcionales derivados

| ID | Requisito |
|---|---|
| FR-G-01 | Fichas MDX validadas por esquema (frontmatter) y renderizadas con audio. |
| FR-G-02 | Índice de gramática por nivel con estado (vista / practicada / dominada). |
| FR-G-03 | Enlace bidireccional ficha ↔ lecciones (`grammar_focus`). |
| FR-G-04 | Mini-práctica con corrección automática y alta de fallos en el SRS (`grammar`). |
| FR-G-05 | Los errores del writing con `type = grammar` se enlazan a la ficha correspondiente si existe. |
