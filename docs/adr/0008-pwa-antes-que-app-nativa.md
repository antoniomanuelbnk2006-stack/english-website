# ADR-0008 · PWA antes que app nativa

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Gran parte de la escucha ocurre en el móvil (trayectos, paseos), a veces sin cobertura. Sabes desarrollar nativo (Swift, Kotlin, Expo), pero una segunda base de código duplica el trabajo.

## Decisión
**PWA** sobre la misma app de Next.js: manifiesto, *service worker* (Serwist para Turbopack o manual), audio en caché con soporte de peticiones por rango, cola sin conexión en IndexedDB y Media Session API. La app nativa queda como **posible fase futura**, solo si la PWA no cubre bien la escucha en segundo plano en iOS.

## Alternativas consideradas
- **Expo/React Native desde el inicio (monorepo):** mejor audio en segundo plano y presencia en tiendas, pero mucho más trabajo y dos interfaces.
- **App nativa iOS (SwiftUI):** la mejor experiencia en tu iPhone, pero sin web y con otro stack.
- **Solo web sin PWA:** sin uso sin conexión.

## Consecuencias
- ✅ Una base de código; instalación sin tiendas; actualizaciones instantáneas.
- ⚠️ En iOS, el comportamiento del audio en segundo plano de una PWA instalada **depende de la versión del sistema**: se prueba en la fase 7 y se documenta.
- ⚠️ Safari exige soporte de *Range requests* para reproducir audio desde la caché del *service worker*.
- ↪️ Si se hiciera app nativa, reutilizaría el contenido (JSON + R2), Supabase y la lógica pura de `lib/` (portable a un paquete compartido).
