# Pantallas y flujos

> **Propósito:** mapa de rutas, contenido de cada pantalla, flujos principales y atajos. Es la referencia para construir la interfaz.
> **Relacionado:** [Funcionalidades](01-funcionalidades.md) · [Sistema de diseño](05-sistema-de-diseno.md) · [Arquitectura y carpetas](../04-arquitectura/02-arquitectura-y-carpetas.md)

La interfaz está **en español** por defecto (rutas incluidas); el contenido de aprendizaje, en inglés. Desde B2 puedes cambiar la interfaz a inglés en Ajustes (inmersión).

---

## 1. Mapa de rutas

| Ruta | Pantalla | Fase |
|---|---|---|
| `/login` | Acceso con email + código | 0 |
| `/hoy` | Plan del día y resumen (inicio) | 1 (básico) → 5 (plan) |
| `/escuchar` | Biblioteca de escucha | 2 |
| `/escuchar/[id]` | Lección de escucha (ciclo completo) | 2 |
| `/escuchar/extensiva` | Biblioteca extensiva de audio | 4 |
| `/leer` | Biblioteca de lectura | 1 |
| `/leer/[id]` | Lección de lectura | 1 |
| `/leer/extensiva/[id]` | Lector extensivo por capítulos | 4 |
| `/repasar` | Sesión de repaso SRS | 3 |
| `/vocabulario` | Tu léxico (buscar, filtrar, editar estado) | 3 |
| `/gramatica` · `/gramatica/[id]` | Índice y fichas | 3 |
| `/use-of-english` · `/use-of-english/[id]` | Ejercicios con formato de examen, por nivel y por parte | 3 |
| `/entrenar/[drill]` | Drills sueltos (formas débiles, números…) | 2 |
| `/escribir` · `/escribir/[id]` | Consignas y editor con feedback | 6 |
| `/progreso` | Niveles, horas, gráficas, «Tu oído» | 5 |
| `/nivel` | Elegir el nivel (A1–C2); obligatorio en el primer acceso | 3 |
| `/nivel/test` · `/nivel/confirmar/[skill]` | Test de nivel y pruebas de confirmación | 5–6 |
| `/diario` | Diario de input (registrar y ver) | 1 |
| `/ajustes` | Perfil, objetivos, apariencia, datos | 0–1 |
| `/studio/*` | Revisión de contenido (**solo en desarrollo**) | 4 |

**Navegación:** en móvil, barra inferior con 5 entradas: **Hoy · Escuchar · Leer · Repasar · Más** (Más = vocabulario, gramática, escribir, progreso, diario, ajustes). En escritorio, barra lateral con todas.

---

## 2. Pantallas

### 2.1 Hoy (`/hoy`)

```
┌──────────────────────────────────────────────┐
│ Señal                          ▂▃▅▆▇█  B1    │  ← barras de señal = nivel
├──────────────────────────────────────────────┤
│ Jueves 8 · objetivo 45 min      ◔ 18/45 min  │
│ Racha 12 días · 1 comodín                    │
├──────────────────────────────────────────────┤
│ PLAN DE HOY                                  │
│ ✓ Repaso · 32 tarjetas               7 min   │
│ ▶ Escucha · Watching the Orionids   12 min   │
│     «Tu destreza más baja · en-GB/en-US»     │
│ ○ Drill · formas débiles              3 min  │
│     «46 % de tus fallos: no reconocida»      │
│ ○ Lectura extensiva · cap. 2         10 min  │
│ ○ Escucha libre (app o externa)      13 min  │
│                     [+ Registrar escucha]    │
├──────────────────────────────────────────────┤
│ Listening  B1 ███████░░░  63 % → B2   ↑ +24  │
│ Reading    B1 ████████░░  71 % → B2   ↑ +11  │
└──────────────────────────────────────────────┘
```

- El plan se genera **una vez al día** (zona horaria Europe/Madrid) y se guarda; marcar algo como hecho no lo regenera.
- Cada ítem explica **por qué** está ahí.
- Botón grande «Empezar» que encadena los ítems en orden.
- Estado vacío (fase 1, sin plan): accesos directos a bibliotecas y diario.

### 2.2 Biblioteca de escucha (`/escuchar`)
- Filtros: nivel, tema, acento, duración, estado (nueva / empezada / hecha), «para ti» (banda de dificultad + cobertura).
- Tarjeta: título, nivel, duración, acento(s) con bandera textual (en-GB), ppm, cobertura para ti, estado.
- Agrupación por **series** con su progreso.

### 2.3 Lección de escucha (`/escuchar/[id]`)

```
┌──────────────────────────────────────────────┐
│ ← Watching the Orionids        B1 · 2:41 · 140 ppm │
│ Fase 2 de 7 · Escucha de detalle   ●●○○○○○   │
├──────────────────────────────────────────────┤
│  ▁▂▅▇▅▃▂▁▂▃▆▇▆▄▂▁▂▄▆▇▅▃▁   1:12 / 2:41        │
│  [⏮ frase] [↻ repetir] [▶︎ ‖] [frase ⏭]  0,9× │
├──────────────────────────────────────────────┤
│ 3. How long does it take to drive there?     │
│   ○ 14 minutes   ○ 40 minutes                │
│   ○ 4 hours      ○ 24 minutes                │
│                              [Comprobar]     │
└──────────────────────────────────────────────┘
```

- **Barra de fases** arriba; cada fase tiene su vista (preparar, preguntas, dictado, transcripción, drills, escucha final, cosecha).
- **Fase 0 — Preparar:** se elige cómo hacer la lección: **a ciegas** (el ciclo de abajo) o **con transcripción** (reproductor y texto con karaoke y glosario desde el principio, sin preguntas ni nota; [ADR-0013](../adr/0013-escucha-con-transcripcion.md)).
- **Fase 1:** la transcripción **no se envía al cliente** hasta completar la fase 2 (ver [seguridad](../04-arquitectura/07-seguridad-y-privacidad.md) — es para ti mismo, pero así no hay tentación).
- **Fase 3 — Dictado:**

```
│ Frase 2 de 3                     [▶︎ escuchar] │
│ ┌──────────────────────────────────────────┐ │
│ │ how many meteors are we going see        │ │
│ └──────────────────────────────────────────┘ │
│ how many meteors are we [gonna→ going to] see│
│              ✗ falta «to»  · causa: [no reconocida ▾] │
```

- **Fase 4 — Transcripción karaoke:** palabras tocables; rasgos de habla conectada subrayados con punteado; cada pregunta fallada enlaza a su frase.
- Al salir a mitad, se guarda la fase y se retoma ahí.

### 2.4 Lección de lectura (`/leer/[id]`)

```
┌──────────────────────────────────────────────┐
│ ← The Second Life of Old Games   B1 · 386 pal. │
│ Fase 2 · Lectura (inmersión)  ⏱ 2:51         │
├──────────────────────────────────────────────┤
│   When a video game company stops updating  │
│   a game, most players move on. New games   │
│   arrive every week, and old ones are       │
│   quickly forgotten. But some games refuse  │
│   to die. …                                  │
│                                              │
│   (pulsación larga = marcar desconocida)     │
├──────────────────────────────────────────────┤
│                       [He terminado de leer] │
└──────────────────────────────────────────────┘
```

- Columna de lectura de 60–72 caracteres, tipografía de lectura, ajustes de tamaño a mano.
- Fase 4 (ayudas): toque en palabra → *popover* con glosario contextual, audio de la palabra y de la frase, «añadir al repaso», «ya la conozco».

### 2.5 Repaso (`/repasar`)
- Una tarjeta a pantalla completa; anverso → «Mostrar» (espacio) → reverso con botones **Otra vez · Difícil · Bien · Fácil** (teclas 1–4) mostrando el próximo intervalo de cada una.
- Tarjetas de audio: reproducir (R), escribir lo que oyes, «Comprobar» → diff + valoración sugerida.
- Barra de progreso de la sesión, contador de nuevas/repasos, aviso al llegar al tope de 15 min.

### 2.6 Vocabulario (`/vocabulario`)
Tabla filtrable de tu léxico: lema, nivel MCER, estado, veces visto, próxima revisión, fuente. Acciones masivas (marcar como conocidas, ignorar).

### 2.7 Escribir (`/escribir/[id]`)
Consigna arriba; editor a la izquierda; feedback a la derecha (en móvil, pestañas). Contador de usos del día («2 de 10 correcciones hoy»).

### 2.8 Progreso (`/progreso`)
- Nivel por destreza (estimado + confirmado), gráfica de rating en el tiempo.
- Horas de input por semana (apiladas por tipo), palabras leídas, lemas conocidos por nivel.
- **«Tu oído»**: distribución de causas de fallo, velocidad cómoda, minutos por acento.

### 2.9 Diario (`/diario`)
Registro en dos toques: tipo (escucha/lectura), minutos (chips 10/20/30/60), título y URL opcionales, nivel percibido. Lista y totales semanales.

---

## 3. Flujos principales

### 3.1 Primer uso
`/login` → código OTP → **bienvenida** (qué es Señal, 3 pantallas) → intereses y objetivo diario → **test de nivel** (o «más tarde» → nivel declarado B1) → `/hoy`.

### 3.2 Sesión diaria típica (45 min)
`/hoy` → Empezar → Repaso (7 min) → Lección de escucha (12 min, ciclo completo) → Drill sugerido (3 min) → Lectura extensiva (10 min) → Escucha libre (13 min, en la app o externa + registro) → resumen del día (XP, racha, mejoras).

### 3.3 Lección de escucha
Preparar → escucha global + 2 preguntas → escucha de detalle + 5–8 preguntas → dictado de 2–4 frases + causas → transcripción karaoke → 2–4 drills → escucha final + autoevaluación → cosecha (≤ 5 tarjetas) → siguiente del plan.

### 3.4 Lección de lectura
Preparar → vistazo 60–90 s + 1–2 preguntas → lectura en inmersión (cronometrada) → preguntas → relectura con ayudas + foco lingüístico → lectura+audio (opcional) → cosecha (≤ 8 tarjetas).

### 3.5 Prueba de confirmación
Aviso en `/hoy` («Puedes intentar confirmar B2 en Listening») → `/nivel/confirmar/listening` → instrucciones → 4 partes con tiempo → resultado → actualización de nivel confirmado.

---

## 4. Atajos de teclado

| Contexto | Tecla | Acción |
|---|---|---|
| Reproductor | `Espacio` | Reproducir / pausa |
| | `R` | Repetir frase actual |
| | `←` / `→` | Frase anterior / siguiente |
| | `[` / `]` | Velocidad −0,05 / +0,05 |
| | `T` | Mostrar/ocultar transcripción (si la fase lo permite) |
| Repaso | `Espacio` | Mostrar respuesta |
| | `1`–`4` | Otra vez / Difícil / Bien / Fácil |
| | `R` | Reproducir audio de la tarjeta |
| Lector | `G` | Abrir glosario de la palabra enfocada |
| | `M` | Marcar palabra enfocada como desconocida |
| Global | `/` | Buscar |
| | `?` | Ver atajos |

---

## 5. Estados transversales

| Estado | Tratamiento |
|---|---|
| Cargando | *Skeletons* con la forma real; nunca *spinners* a pantalla completa |
| Sin conexión | Banda superior discreta; lo descargado sigue funcionando; los intentos se encolan |
| Error | Mensaje en español claro + reintentar; los errores se registran (Sentry, opcional) |
| Vacío | Explica qué hacer y ofrece la acción (p. ej. «Aún no tienes tarjetas: termina una lección») |
| Límite de IA alcanzado | «Has usado tus 10 correcciones de hoy. Vuelven mañana.» |
