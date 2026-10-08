# PWA, rendimiento, accesibilidad e idioma de la interfaz

> **Propósito:** que Señal se instale en el móvil, funcione sin conexión para escuchar, vaya rápida y sea accesible.
> **Relacionado:** [Audio y reproductor](05-audio-y-reproductor.md) · [Sistema de diseño](../03-producto/05-sistema-de-diseno.md) · [ADR-0008](../adr/0008-pwa-antes-que-app-nativa.md)

---

## 1. PWA

### 1.1 Manifiesto (`src/app/manifest.ts`)

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Señal — inglés A1→C2',
    short_name: 'Señal',
    description: 'Listening y reading con diagnóstico, repaso espaciado y plan diario.',
    start_url: '/hoy',
    display: 'standalone',
    background_color: '#070b14',
    theme_color: '#070b14',
    lang: 'es',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

### 1.2 *Service worker*

Opción recomendada: **Serwist** en su variante para **Turbopack** (`@serwist/turbopack`), porque Next 16 usa Turbopack por defecto y las librerías PWA antiguas dependían de webpack. Sigue la guía oficial de Serwist para Turbopack (configuración en `next.config.ts`, ruta que sirve el SW, `SerwistProvider` en el *layout*). Alternativa: *service worker* escrito a mano (más código, cero dependencias).

Estrategias:

| Recurso | Estrategia |
|---|---|
| *Shell* (JS/CSS de Next, fuentes, iconos) | Precaché |
| Navegación | *Network-first* con página `/offline` de respaldo |
| **Audio** (`*.m4a` de R2) | **Cache-first** + **peticiones por rango** + expiración (60 ficheros / 90 días) |
| JSON de lecciones descargadas | Cache API explícita (botón «Descargar») |
| Llamadas a Supabase y a la IA | Solo red (nunca se cachean) |

Configuración orientativa del audio en el SW (verifica nombres y *imports* con la versión de Serwist instalada):

```ts
// src/app/sw.ts (fragmento)
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, RangeRequestsPlugin } from 'serwist';

const AUDIO_ORIGIN = 'https://audio.tu-dominio.dev'; // o el de NEXT_PUBLIC_AUDIO_BASE_URL

const audioRoute = {
  matcher: ({ url }: { url: URL }) => url.origin === AUDIO_ORIGIN && url.pathname.endsWith('.m4a'),
  handler: new CacheFirst({
    cacheName: 'audio-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 }),
    ],
  }),
};
```

---

## 2. Instalación

- Android/Chrome: aviso de instalación propio (botón en Ajustes) usando `beforeinstallprompt`.
- iOS/Safari: instrucción «Compartir → Añadir a pantalla de inicio» (no hay aviso automático).

---

## 3. Audio sin conexión

1. El `<audio>` lleva **`crossOrigin="anonymous"`** y R2 tiene CORS para el origen de la app: así las respuestas no son opacas y el SW puede guardarlas y servirlas por rangos.
2. «Descargar lección» hace `fetch` del audio **completo** (sin cabecera `Range`) y del JSON (`/api/lessons/[id]/download`) y los guarda en caché.
3. Safari reproduce pidiendo rangos (`206`): el `RangeRequestsPlugin` recorta la respuesta completa cacheada.
4. Sin red, las lecciones descargadas se abren en `/offline/[id]`, una página **100 % cliente** que lee de la Cache API y usa el mismo reproductor.
5. Ajustes muestra el espacio usado (`navigator.storage.estimate()`) y permite borrar descargas; se pide `navigator.storage.persist()` para que el navegador no las elimine.

---

## 4. Cola sin conexión

- Intentos, repasos SRS y registros del diario hechos sin red se guardan en **IndexedDB** (`idb-keyval`) con un `client_id` (UUID).
- Se vacía la cola al recuperar la red (`online`), al volver a la app (`visibilitychange`) y al abrir `/hoy`.
- El servidor es **idempotente** (`unique (user_id, client_id)`): reintentar nunca duplica.
- Los ratings se recalculan en el servidor al procesar la cola, en orden cronológico (`created_at` del cliente).

---

## 5. Rendimiento

### 5.1 Presupuestos

| Métrica (móvil medio, 4G) | Objetivo |
|---|---|
| LCP | < 2,0 s |
| INP | < 200 ms |
| CLS | < 0,05 |
| JS inicial por ruta | < 170 KB comprimido |
| Inicio de reproducción tras pulsar ▶︎ (audio en caché) | < 150 ms |

### 5.2 Técnicas

- **RSC por defecto**; islas cliente pequeñas. El reproductor y el lector se cargan solo en sus rutas.
- `next/dynamic` para lo pesado y no inmediato: gráficas de progreso, onda en `<canvas>`, editor de writing.
- Fuentes con `next/font` (autoalojadas, subconjunto latino, `display: swap`).
- La transcripción usa nodos ligeros y actualizaciones por atributo (sin re-render por palabra).
- El índice de contenido se lee en servidor; al cliente solo llega lo que la pantalla necesita.
- Audio con `preload="metadata"` en bibliotecas y `preload="auto"` dentro de la lección.
- **Medir antes de optimizar:** Lighthouse en CI (no bloqueante) y Vercel Speed Insights si lo activas.

---

## 6. Accesibilidad

Objetivo **WCAG 2.2 AA** (detalle de diseño en [Sistema de diseño §8](../03-producto/05-sistema-de-diseno.md#8-accesibilidad-wcag-22-aa)).

Pruebas:
- **Automáticas:** `@axe-core/playwright` en las pantallas principales dentro de los e2e (sin violaciones serias).
- **Teclado:** recorrido completo de una lección de escucha y una sesión de repaso sin ratón.
- **Lector de pantalla:** prueba rápida con VoiceOver (iOS/macOS) al cerrar cada fase del roadmap.
- **Zoom 200 %** y tamaño de letra grande del sistema sin solapes.

---

## 7. Idioma de la interfaz (i18n ligera)

- Diccionarios tipados: `src/lib/i18n/es.ts` (fuente de verdad) y `en.ts` (`satisfies typeof es`, así TypeScript avisa si falta una clave).
- `t('hoy.objetivo', { min: 45 })` con interpolación simple; idioma según `profiles.ui_locale`.
- Fechas y números con `Intl` (`es-ES`).
- El **contenido** de aprendizaje está siempre en inglés y marcado con `lang="en"`.
