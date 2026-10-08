# Señal — inglés de A1 a C2, del ruido a la señal

Documentación completa para construir **Señal**, tu web app personal para aprender inglés de A1 a C2 con foco en **listening** y **reading**, y tu **plan de estudio** para pasar de B1 a B2 mientras la construyes.

> Escrita como tu profesor de inglés y como ingeniero de software. Versiones y servicios verificados en **octubre de 2026** (Next.js 16, Supabase, Cloudflare R2, Azure AI Speech, Claude API, ts-fsrs). «Señal» es un nombre de trabajo: cámbialo cuando quieras.

---

## Por dónde empezar

| Si quieres… | Empieza por |
|---|---|
| **Estudiar hoy mismo** (sin esperar a la app) | [Tu plan B1 → B2](docs/07-tu-plan/01-plan-b1-a-b2.md) → [Rutina semanal](docs/07-tu-plan/02-rutina-semanal.md) |
| **Construir la app** | [Visión](docs/00-vision/01-vision-y-alcance.md) → [Roadmap](docs/06-desarrollo/01-roadmap.md) → [Entornos](docs/06-desarrollo/04-entornos-y-despliegue.md) → [Prompts por fase](docs/06-desarrollo/05-prompts-por-fase.md) |
| **Entender el método** | [Metodología](docs/01-pedagogia/02-metodologia.md) → [Listening](docs/01-pedagogia/03-listening.md) |

---

## Decisiones de partida

| Tema | Decisión |
|---|---|
| Público | Solo tú (un usuario), con `user_id` + RLS en todo por si algún día la abres |
| IA | Contenido **pregenerado** y revisado + **corrección de writing en vivo** con límite diario y tope de gasto |
| Stack | **Next.js 16 + Supabase**, PWA, audio en **Cloudflare R2**, TTS con **Azure AI Speech**, IA con la **Claude API** |
| Tu nivel | **B1** → contenido producido primero para B1 y B2 |
| Prioridad | Listening > Reading > Vocabulario > Writing > Speaking |
| Coste | ≈ 0 € de infraestructura; IA ≈ 25–35 $ en total para todo el currículo + céntimos al mes de writing |

---

## Contenido del paquete

```
senal/
├── README.md                       ← estás aquí
├── CLAUDE.md                       ← instrucciones para Claude Code (va a la raíz del repo)
├── .claude/skills/crear-leccion/   ← skill de Claude Code para crear y publicar lecciones
├── skill-claude-ai/senal/          ← guía maestra en formato skill, para usar en claude.ai
└── docs/
    ├── 00-vision/                  visión, alcance y glosario
    ├── 01-pedagogia/               cómo se aprende con Señal (el «porqué» de cada función)
    ├── 02-curriculo/               un documento por nivel A1–C2
    ├── 03-producto/                funcionalidades, pantallas, plan diario, gamificación, diseño
    ├── 04-arquitectura/            stack, carpetas, BD (SQL), contenido (Zod), audio, IA, seguridad, PWA
    ├── 05-contenido/               pipeline, calidad, licencias, prompts y 2 lecciones de ejemplo
    ├── 06-desarrollo/              roadmap, convenciones, testing, despliegue, prompts por fase
    ├── 07-tu-plan/                 tu plan de estudio B1 → B2, rutina y recursos
    └── adr/                        10 decisiones de arquitectura
```

---

## Índice completo

### 00 · Visión
- [Visión y alcance](docs/00-vision/01-vision-y-alcance.md) — problema, propuesta en 5 pilares, alcance, métricas, riesgos.
- [Glosario](docs/00-vision/02-glosario.md) — términos de pedagogía, medición y técnica.

### 01 · Pedagogía
- [El marco: MCER, horas, vocabulario y escala interna](docs/01-pedagogia/01-marco-mcer.md)
- [Metodología](docs/01-pedagogia/02-metodologia.md) — diez principios y reparto de tiempo.
- [Listening](docs/01-pedagogia/03-listening.md) — por qué te cuesta, ciclo de escucha, dictado diagnóstico, drills, acentos.
- [Reading](docs/01-pedagogia/04-reading.md) — ciclo de lectura, subdestrezas, velocidad, volumen, selección de textos.
- [Vocabulario y SRS](docs/01-pedagogia/05-vocabulario-y-srs.md) — léxico personal, cobertura, FSRS, tipos de tarjeta.
- [Gramática](docs/01-pedagogia/06-gramatica.md) — formato de fichas y ficha de ejemplo.
- [Writing y speaking](docs/01-pedagogia/07-writing-y-speaking.md) — rúbrica, feedback, *shadowing*.
- [Evaluación y nivel](docs/01-pedagogia/08-evaluacion-y-nivel.md) — test inicial, Elo, pruebas de confirmación.
- [Errores típicos de hispanohablantes](docs/01-pedagogia/09-errores-hispanohablantes.md) — sonidos, formas débiles, habla conectada, falsos amigos.

### 02 · Currículo
- [Cómo leer el currículo](docs/02-curriculo/00-como-leer-el-curriculo.md) · [A1](docs/02-curriculo/A1.md) · [A2](docs/02-curriculo/A2.md) · [**B1**](docs/02-curriculo/B1.md) · [**B2**](docs/02-curriculo/B2.md) · [C1](docs/02-curriculo/C1.md) · [C2](docs/02-curriculo/C2.md)

### 03 · Producto
- [Funcionalidades](docs/03-producto/01-funcionalidades.md) — catálogo con prioridad y fase; definición del MVP.
- [Pantallas y flujos](docs/03-producto/02-pantallas-y-flujos.md) — rutas, *wireframes*, flujos, atajos.
- [Motor del plan diario](docs/03-producto/03-motor-del-plan-diario.md) — algoritmo de «Hoy».
- [Gamificación sana](docs/03-producto/04-gamificacion.md) — XP, racha, barras de señal, logros.
- [Sistema de diseño](docs/03-producto/05-sistema-de-diseno.md) — tokens, tipografía, componentes, accesibilidad.

### 04 · Arquitectura
- [Stack](docs/04-arquitectura/01-stack.md) · [Arquitectura y carpetas](docs/04-arquitectura/02-arquitectura-y-carpetas.md) · [Base de datos](docs/04-arquitectura/03-base-de-datos.md) · [Modelo de contenido](docs/04-arquitectura/04-modelo-de-contenido.md) · [Audio y reproductor](docs/04-arquitectura/05-audio-y-reproductor.md) · [IA](docs/04-arquitectura/06-ia.md) · [Seguridad y privacidad](docs/04-arquitectura/07-seguridad-y-privacidad.md) · [PWA, rendimiento y accesibilidad](docs/04-arquitectura/08-pwa-rendimiento-accesibilidad.md)

### 05 · Contenido
- [Pipeline](docs/05-contenido/01-pipeline.md) · [Control de calidad](docs/05-contenido/02-control-de-calidad.md) · [Fuentes y licencias](docs/05-contenido/03-fuentes-y-licencias.md) · [Prompts de generación](docs/05-contenido/04-prompts-de-generacion.md)
- [Ejemplos](docs/05-contenido/ejemplos/README.md): [*Watching the Orionids*](docs/05-contenido/ejemplos/b1-lis-001.md) (escucha B1) · [*The Second Life of Old Games*](docs/05-contenido/ejemplos/b1-rea-001.md) (lectura B1)

### 06 · Desarrollo
- [Roadmap](docs/06-desarrollo/01-roadmap.md) · [Convenciones](docs/06-desarrollo/02-convenciones.md) · [Testing y calidad](docs/06-desarrollo/03-testing-y-calidad.md) · [Entornos y despliegue](docs/06-desarrollo/04-entornos-y-despliegue.md) · [Prompts por fase](docs/06-desarrollo/05-prompts-por-fase.md)

### 07 · Tu plan
- [Plan B1 → B2](docs/07-tu-plan/01-plan-b1-a-b2.md) · [Rutina semanal](docs/07-tu-plan/02-rutina-semanal.md) · [Recursos externos](docs/07-tu-plan/03-recursos-externos.md)

### ADR
- [Índice de decisiones](docs/adr/README.md)

---

## Cómo usar este paquete

**Con Claude Code (para construir):**
1. Crea el proyecto siguiendo [Entornos §2](docs/06-desarrollo/04-entornos-y-despliegue.md#2-crear-el-proyecto).
2. Copia `docs/`, `CLAUDE.md` y `.claude/` a la raíz del repo y haz *commit*.
3. Abre Claude Code en el repo y pega el prompt de la [fase 0](docs/06-desarrollo/05-prompts-por-fase.md#fase-0--cimientos).

**En claude.ai (para pensar, planificar o generar lecciones en un chat):**
usa `skill-claude-ai/senal/` como una skill más, igual que las de tus otros proyectos. Si copias `docs/` dentro de esa carpeta, Claude podrá consultar el detalle.

**Para estudiar:** empieza hoy con [tu plan](docs/07-tu-plan/01-plan-b1-a-b2.md). La app irá sustituyendo los recursos externos fase a fase.

---

## Mantener la documentación viva

- Si cambia una decisión técnica → nuevo ADR, no edites el antiguo.
- Si cambia el método → actualiza el documento de pedagogía y, si afecta a la app, el de producto.
- Antes de instalar, comprueba las versiones actuales de los paquetes: esta documentación fija las decisiones, no los números de versión exactos.
