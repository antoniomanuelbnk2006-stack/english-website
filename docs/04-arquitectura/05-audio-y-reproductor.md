# Audio y reproductor

> **Propósito:** cómo se produce, almacena y reproduce el audio; cómo funcionan el karaoke, la navegación por frases, las tarjetas de audio y la reproducción sin conexión.
> **Relacionado:** [Listening](../01-pedagogia/03-listening.md) · [Pipeline](../05-contenido/01-pipeline.md) · [PWA](08-pwa-rendimiento-accesibilidad.md) · [ADR-0004](../adr/0004-audio-en-r2.md) · [ADR-0005](../adr/0005-tts-azure-con-abstraccion.md)

---

## 1. Formato de los ficheros

| Propiedad | Valor | Motivo |
|---|---|---|
| Contenedor / códec | **`.m4a` (AAC-LC)** | Compatible con Safari/iOS, Chrome, Firefox y Android sin excepciones |
| Canales | Mono | Voz; la mitad de tamaño |
| Tasa de bits | 64 kbps | Voz clara; ~0,5 MB por minuto |
| Frecuencia de muestreo | 44,1 o 48 kHz (la del TTS) | Sin remuestreos innecesarios |
| Sonoridad | **−16 LUFS** integrados, pico real ≤ −1,5 dBTP | Volumen homogéneo entre lecciones (filtro `loudnorm` de ffmpeg) |
| Ruta | `audio/{nivel}/{lessonId}/v{version}.m4a` | Versionada → caché inmutable |
| Cabeceras | `Cache-Control: public, max-age=31536000, immutable` | El navegador y el *service worker* no vuelven a pedirlo |

Tamaño típico: lección B1 de 2,5 min ≈ 1,2 MB. 400 lecciones ≈ 0,5 GB (de 10 GB gratis en R2).

---

## 2. Del texto al audio con tiempos

```
segmentos (texto + hablante + voz)
  └─▶ SSML por segmento (voz, velocidad según nivel, pausas)
        └─▶ Azure TTS (SDK) ── audio PCM + eventos WordBoundary (offset, duración, texto)
              └─▶ ffmpeg: concatenar segmentos con pausas → loudnorm → AAC
                    └─▶ tiempos por palabra re-calculados en la línea de tiempo final
                          └─▶ alinear eventos con los tokens de `annotate` → token.s / token.e
                                └─▶ segment.start / end · audio.peaks · audio.wpm
```

Detalles:
- **SSML:** una petición por segmento con `<voice name="…">` y `<prosody rate="…">`. La velocidad se ajusta por nivel para acercarse a `target_wpm` (medido tras sintetizar; si se desvía más de un 8 %, se re-sintetiza con otro `rate`).
- **WordBoundary:** el SDK de Azure emite, por palabra, su desplazamiento y duración en *ticks* de 100 ns. Se convierten a segundos y se suma el inicio del segmento en el audio final.
- **Pausas:** entre segmentos del mismo hablante 250 ms; cambio de hablante 400 ms; A1–A2 hasta 700 ms. Se pueden forzar con `pause_after_ms`.
- **Alineación token ↔ evento:** emparejado secuencial normalizando texto (apóstrofos, guiones, números escritos). Los signos de puntuación no tienen tiempo.
- **Picos de onda:** se decodifica el audio final a PCM y se calculan 200–300 valores máximos normalizados (0–1) → `audio.peaks`.
- **Audio sin tiempos** (dominio público, propio): alineado forzado con una herramienta tipo Whisper con marcas de tiempo por palabra, en local.

---

## 3. Reproductor

### 3.1 Arquitectura

- **Un único `HTMLAudioElement`** por página, controlado por un *store* de Zustand (`lib/audio/store.ts`): `src`, `currentTime`, `playing`, `rate`, `segmentIndex`, `loop`, `mode`.
- La UI (botones, onda, transcripción) se suscribe con **selectores** finos para que el karaoke no re-renderice la transcripción entera.
- `playbackRate` entre 0,5 y 1,5 con `preservesPitch = true` (el tono no cambia al acelerar o frenar).

### 3.2 Navegación por frases

| Acción | Implementación |
|---|---|
| Frase anterior / siguiente | `currentTime = segments[i ± 1].start` |
| Repetir frase | `currentTime = segments[i].start` + reproducir hasta `end` |
| Bucle de frase | Al llegar a `end − 0,03 s`, volver a `start` |
| Parar al final de la frase (dictado) | Al llegar a `end`, pausar |

El evento `timeupdate` solo dispara unas 4 veces por segundo: para cortar con precisión al final de una frase se usa un bucle con `requestAnimationFrame` mientras suena.

### 3.3 Karaoke

- Bucle `requestAnimationFrame` → `currentTime` → **búsqueda binaria** en el array plano de tiempos de palabra → índice de la palabra activa.
- Solo cambian dos nodos por paso (la anterior y la nueva) mediante `data-active` y estilos CSS (`--karaoke`); nada de *setState* por palabra.
- Desplazamiento automático suave para mantener la frase activa a la vista (desactivable).

### 3.4 Pantalla de bloqueo (Media Session API)

```ts
navigator.mediaSession.metadata = new MediaMetadata({
  title: lesson.title, artist: 'Señal', album: `${lesson.level} · ${lesson.series}`,
  artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
});
navigator.mediaSession.setActionHandler('previoustrack', () => goToSegment(-1));
navigator.mediaSession.setActionHandler('nexttrack', () => goToSegment(+1));
navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-5));
navigator.mediaSession.setActionHandler('seekforward', () => seekBy(+5));
// + play/pause y setPositionState({ duration, playbackRate, position }) al cambiar
```

Así los botones de «anterior/siguiente» de los auriculares o de la pantalla de bloqueo **saltan de frase**.

### 3.5 Particularidades de iOS
- La reproducción debe empezar con un gesto del usuario (no hay *autoplay* con sonido).
- El comportamiento del audio en segundo plano en una PWA instalada **depende de la versión de iOS**: pruébalo en tu iPhone en la fase 7 y documenta lo que veas. Si no fuese fiable, la escucha extensiva en trayectos puede hacerse desde el navegador o, en una fase futura, con app nativa.

---

## 4. Audio «gratis» reutilizando tiempos

Como cada palabra tiene tiempos, muchas funciones **no necesitan ficheros nuevos**:

| Función | Cómo |
|---|---|
| Tarjeta de audio del SRS | Reproduce `start`–`end` del segmento en el fichero de la lección |
| «Escuchar esta palabra» en el glosario | Reproduce `token.s`–`token.e`: la palabra **tal como sonó en contexto** |
| Dictado | Mismo mecanismo con «parar al final de la frase» |
| Drill con frases propias | Fragmentos de tus lecciones |

Para pronunciar una palabra aislada «de diccionario» se puede usar la Web Speech API del navegador (gratis, calidad variable) como complemento.

---

## 5. Sin conexión

- **Descargar lección:** botón que guarda en la Cache API el JSON de la lección (`/api/lessons/[id]/download`) y su audio.
- El *service worker* sirve el audio con estrategia **cache-first** y soporte de **peticiones por rango** (*Range requests*): Safari pide el audio por trozos y sin ese soporte no reproduce desde caché.
- Las lecciones descargadas se abren en `/offline/[id]` (página 100 % cliente) cuando no hay red.
- Límite orientativo: 30 lecciones descargadas (~40 MB); la app muestra el espacio usado y permite borrar.

Detalle en [PWA, rendimiento y accesibilidad](08-pwa-rendimiento-accesibilidad.md).

---

## 6. Grabaciones (*shadowing*, fase 8)

- `MediaRecorder` → Blob (`audio/webm` o `audio/mp4` según el navegador) → IndexedDB.
- Reproducción A/B: original (segmento) ↔ tu grabación, con el mismo `playbackRate`.
- Nada sale del dispositivo; caducan a los 7 días.
- Permiso de micrófono solo en esa pantalla (`Permissions-Policy: microphone=(self)`).
