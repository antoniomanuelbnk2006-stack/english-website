# Gamificación sana

> **Propósito:** motivación que refuerza el aprendizaje real y nunca lo sustituye.
> **Relacionado:** [Metodología, principio 10](../01-pedagogia/02-metodologia.md#10-motivación-sostenible) · [Sistema de diseño](05-sistema-de-diseno.md)

---

## 1. Reglas de oro

1. **Nada se gana sin trabajar de verdad.** La XP depende del **tiempo activo** (audio sonando, interacción, lectura con scroll), no de clics.
2. **Ningún castigo.** Sin notificaciones culpabilizadoras, sin perder todo por un día malo.
3. **Competir solo contigo.** No hay rankings (ni tendrían sentido con un usuario).
4. **Lo que se celebra es el progreso real**: subir de nivel confirmado, mejorar tu dictado, acumular horas.

---

## 2. XP

| Acción | XP |
|---|---|
| Cada minuto activo (cualquier actividad) | 10 |
| Completar una lección (ciclo completo) | +25 |
| Dictado ≥ 90 % en una lección | +10 |
| Cumplir el objetivo diario | +30 |
| Completar un writing con reescritura | +20 |
| Confirmar un nivel | +500 |

**Tiempo activo:** se cuenta en intervalos de 15 s; un intervalo es activo si hay audio reproduciéndose, o interacción (tecla, toque, scroll) en los últimos 60 s. La XP no es el objetivo: es un reflejo del esfuerzo.

---

## 3. Racha

- Un día cuenta si haces **≥ 15 min activos** (umbral configurable, independiente del objetivo diario).
- **2 comodines al mes**, aplicados automáticamente si un día no llegas. No se acumulan.
- **Modo vacaciones**: pausa la racha hasta 14 días (por ejemplo, viajes).
- La racha se muestra pequeña; lo grande en `/hoy` es el **progreso de nivel**.

---

## 4. Barras de señal: el nivel

El nivel se representa con **seis barras de cobertura**, como la señal del móvil: una por nivel A1–C2.

```
A1 ▂  A2 ▃  B1 ▅  B2 ▆  C1 ▇  C2 █

Listening:  ▂▃▅▆░░   (B1 confirmado, barra de B2 llenándose al 63 %)
```

- Barras llenas = niveles confirmados; la barra en curso se rellena con el progreso del rating dentro de la banda.
- Es el elemento visual central del producto y conecta con el nombre: **más señal, menos ruido**.

---

## 5. Misiones semanales

Cada lunes se generan **3 misiones** a partir de tus datos (no aleatorias):

| Si… | Misión de ejemplo |
|---|---|
| Un acento tiene < 10 min en 30 días | «Escucha 2 audios con acento irlandés» |
| `not_recognized` es tu causa principal | «Haz 3 drills de formas débiles» |
| Lectura extensiva < objetivo semanal | «Lee 12.000 palabras esta semana» |
| Tarjetas de audio atrasadas | «Repasa 50 tarjetas de audio» |
| Sin writing en 7 días | «Escribe y reescribe un texto» |

Recompensa: XP extra y un sello en el progreso semanal. Sin consecuencias si no se cumplen.

---

## 6. Logros

| Código | Nombre | Condición |
|---|---|---|
| `first_signal` | Primera señal | Completar la primera lección de escucha |
| `decoder_100` | Descodificador | 100 frases dictadas |
| `decoder_1000` | Descodificador experto | 1.000 frases dictadas |
| `clean_dictation_10` | Oído fino | 10 dictados seguidos ≥ 95 % |
| `hours_10` / `hours_50` / `hours_100` / `hours_300` | Horas de vuelo | Horas de input acumuladas |
| `words_10k` / `words_100k` / `words_1m` | Lector de fondo | Palabras leídas |
| `lexicon_1k` … `lexicon_5k` | Léxico | Lemas conocidos añadidos desde el inicio |
| `accents_5` | Políglota de acentos | 30+ min con 5 acentos distintos |
| `speed_115` | Más rápido que la luz | Dictado ≥ 85 % a 1,15× |
| `streak_7` / `streak_30` / `streak_100` | Constancia | Días de racha |
| `writer_10` | Pluma | 10 writings con reescritura |
| `level_confirmed_b2_l` | B2 Listening | Confirmar B2 en listening |
| `level_confirmed_b2_r` | B2 Reading | Confirmar B2 en reading |
| `series_complete_5` | Narrador | Completar 5 series |

Los logros se evalúan con reglas puras sobre agregados (testeables), en un *server action* al terminar cada actividad.

---

## 7. Resumen del día

Al terminar el plan (o al cerrar la sesión con ≥ 15 min), una pantalla breve:
- Minutos y XP del día; racha.
- **Una mejora concreta** detectada («Tu dictado en frases con *gonna* pasó del 60 % al 85 %»).
- Lo que toca mañana (avance del plan).

---

## 8. Lo que evitamos a propósito

| Patrón | Por qué no |
|---|---|
| Vidas/corazones que bloquean | Castigan el error, que es parte del aprendizaje |
| XP por respuesta rápida | Premia adivinar |
| Notificaciones de culpa | Erosionan la motivación intrínseca |
| Tienda de objetos | Distrae del objetivo |
| Rachas como métrica principal | El objetivo es el nivel, no la racha |
