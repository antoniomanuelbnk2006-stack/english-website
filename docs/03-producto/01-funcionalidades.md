# Funcionalidades

> **Propósito:** catálogo completo de funcionalidades, con prioridad (MoSCoW) y fase del roadmap en la que entran.
> **Relacionado:** [Pantallas y flujos](02-pantallas-y-flujos.md) · [Roadmap](../06-desarrollo/01-roadmap.md) · Requisitos detallados en cada documento de [pedagogía](../01-pedagogia/02-metodologia.md)

**Prioridad:** **M** = imprescindible (MVP) · **S** = debería (v1) · **C** = podría (después de v1) · **W** = no por ahora.

---

## 1. Núcleo y cuenta

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-001 | Acceso con email + código OTP (sin registro público; solo tu email permitido) | M | 0 |
| F-002 | Perfil y ajustes: objetivo diario (min), intereses, tema (oscuro/claro/papel), tamaño de letra, velocidad por defecto, idioma de la interfaz (es/en) | M | 0–1 |
| F-003 | Shell de la app: navegación inferior en móvil, lateral en escritorio | M | 0 |
| F-004 | Exportar todos tus datos (JSON) y borrar cuenta | S | 5 |

## 2. Contenido

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-010 | Carga de lecciones desde `content/` validadas con Zod en build | M | 1 |
| F-011 | Biblioteca de **escucha** filtrable (nivel, tema, acento, duración, estado, «para ti») | M | 2 |
| F-012 | Biblioteca de **lectura** filtrable (nivel, tema, género, longitud, cobertura) | M | 1 |
| F-013 | Series temáticas con progreso | S | 1 |
| F-014 | Biblioteca **extensiva** (episodios y relatos largos por capítulos) | S | 4 |
| F-015 | Fichas de **gramática** (MDX) con audio y mini-práctica | S | 3 |
| F-016 | Clásicos de dominio público con audio alineado (C1–C2) | C | 8 |
| F-017 | **Use of English** por nivel con formato de examen de Cambridge (elegir la palabra, completar, formar palabras, transformar frases), corregido en servidor y con fallos al repaso ([ADR-0012](../adr/0012-use-of-english-y-nivel-declarado.md)) | M | 3 |
| F-018 | **Elegir el nivel** (A1–C2) en el primer acceso; las bibliotecas enseñan primero ese nivel | M | 3 |

## 3. Listening

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-020 | Reproductor por segmentos (anterior / repetir / siguiente), velocidad 0,5–1,5×, atajos | M | 2 |
| F-021 | Transcripción con modos (oculta / tras responder / karaoke) | M | 2 |
| F-022 | **Ciclo de escucha** completo (fases 0–7) | M | 2 |
| F-023 | **Dictado diagnóstico** con alineación y propuesta de causa | M | 2 |
| F-024 | Drills de habla conectada generados por causa | S | 2 |
| F-025 | Marcas de habla conectada en la transcripción | S | 2 |
| F-026 | Registro rápido de **escucha extensiva externa** | M | 1 |
| F-027 | Media Session (pantalla de bloqueo) y audio sin conexión | S | 7 |
| F-028 | Perfil «Tu oído»: causas de fallo, velocidad cómoda, acentos | S | 5 |
| F-029 | *Shadowing* con grabación local A/B | C | 8 |
| F-030 | Importar audio propio (uso personal) con transcripción local | C | 8+ |

## 4. Reading

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-040 | Lector con modo inmersión y modo ayudas | M | 1 |
| F-041 | Marcar palabras desconocidas (pulsación larga / clic derecho) | M | 3 |
| F-042 | Glosario contextual por palabra + alta en SRS | M | 3 |
| F-043 | Medición de ppm | M | 1 |
| F-044 | Preguntas con evidencia resaltada | M | 1 |
| F-045 | Lectura + audio sincronizado | S | 2 |
| F-046 | Traducción de frase bajo demanda (límite por texto) | S | 3 |
| F-047 | Relectura cronometrada programada | C | 5 |
| F-048 | Resaltado léxico por estado (desconocida/aprendiendo) | S | 3 |

## 5. Vocabulario y repaso

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-060 | Léxico personal (estados, fuente, búsqueda) | M | 3 |
| F-061 | SRS con FSRS (ts-fsrs) y límites diarios | M | 3 |
| F-062 | Tarjetas `word`, `chunk`, `audio`, `grammar` | M | 3 |
| F-063 | Valoración sugerida automática (audio, gramática) | M | 3 |
| F-064 | Cosecha priorizada al terminar lecciones | M | 3 |
| F-065 | Cobertura por texto («para ti: 96 %») | M | 3 |
| F-066 | Optimización de parámetros FSRS con tu historial | C | 8 |
| F-067 | Tarjetas de producción (ES→EN) opcionales | C | 8 |
| F-068 | Mazo de palabras por nivel (A1–C2) con traducción y ejemplo: explorar, estudiar en tandas y mandar al repaso ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)) | S | 8 (adelantada) |
| F-069 | Diccionario completo de consulta: cualquier palabra o expresión, con traducción, definiciones y pronunciación, consultada en Wiktionary ([ADR-0016](../adr/0016-diccionario-de-consulta-con-wiktionary.md)) | S | 8 (adelantada) |

## 6. Nivel y plan

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-080 | Test de nivel (vocabulario sí/no + adaptativos) | M | 5 |
| F-081 | Rating Elo por destreza con historial | M | 5 |
| F-082 | **Plan diario «Hoy»** | M | 5 |
| F-083 | Pruebas de confirmación de nivel | S | 6 |
| F-084 | Progreso: niveles, horas, palabras, gráficas | M | 5 |
| F-085 | Diario de input (app + externo) | M | 1 |

## 7. Writing (IA)

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-100 | Consignas por nivel y tipo de texto | S | 6 |
| F-101 | Editor con contador y autoguardado local | S | 6 |
| F-102 | Feedback IA estructurado (rúbrica + correcciones + subir de nivel) | S | 6 |
| F-103 | Límite diario y tope de gasto mensual | M (si F-102) | 6 |
| F-104 | Historial y evolución por criterio | S | 6 |
| F-105 | Errores recurrentes al SRS | S | 6 |
| F-106 | Revisión sin IA: comprobaciones automáticas, respuesta modelo y autoevaluación ([ADR-0014](../adr/0014-writing-revision-sin-ia.md)) | S | 6 |

## 7 bis. Speaking

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-110 | Pronunciación con el reconocimiento de voz del navegador: ejercicios por sonido con consejos para las confusiones típicas ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)) | S | 8 (adelantada) |
| F-111 | Práctica libre de pronunciación con cualquier palabra o frase | S | 8 (adelantada) |
| F-112 | Evaluación de pronunciación por sonidos (Azure) | C | 8 |
| F-113 | Consejos automáticos de pronunciación cuando una palabra o frase no se entiende | S | 8 (adelantada) |

## 8. Motivación

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-120 | XP por minuto activo, objetivo diario, racha con comodines | S | 5 |
| F-121 | Misiones semanales derivadas de tus puntos débiles | C | 5 |
| F-122 | Logros | C | 5 |
| F-123 | Recordatorio diario (notificación push de la PWA) | C | 8 |

## 9. Plataforma

| ID | Funcionalidad | Prioridad | Fase |
|---|---|---|---|
| F-140 | PWA instalable (manifiesto, iconos, *service worker*) | S | 7 |
| F-141 | Descarga de lecciones para uso sin conexión | S | 7 |
| F-142 | Cola de intentos sin conexión con sincronización posterior | S | 7 |
| F-143 | Studio (solo desarrollo): revisar, escuchar, aprobar lecciones | M | 4 |
| F-144 | Accesibilidad WCAG 2.2 AA | M | Transversal |

## 10. Fuera de alcance (W)

Multiusuario y pagos · rankings y social · conversación por voz con IA en tiempo real · app nativa · contenido con copyright de terceros dentro de la app.

---

## 11. MVP (fin de la fase 3)

Lo mínimo que ya te sirve **todos los días**:

- Acceso, shell, ajustes básicos.
- Bibliotecas de escucha y lectura con las primeras ~10 lecciones (los dos [ejemplos](../05-contenido/ejemplos/README.md) más otras escritas a mano o generadas en un chat a partir de las especificaciones), locutadas con el **pipeline mínimo de audio** de la fase 2.
- Reproductor con transcripción, ciclo de escucha y dictado diagnóstico.
- Lector con preguntas, ppm y glosario.
- Léxico + SRS con tarjetas de palabra y de audio.
- Diario de input externo.

Con eso ya puedes sustituir parte de tus recursos externos; el plan diario y el rating llegan en la fase 5, cuando haya contenido suficiente para que elegir tenga sentido.
