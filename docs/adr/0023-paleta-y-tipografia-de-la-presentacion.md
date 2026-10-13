# ADR-0023 · Paleta y tipografía de la presentación en toda la web

- **Estado:** Sustituida por [ADR-0027](0027-sistema-de-diseno-master.md) (en su día sustituyó la paleta cian y la tipografía Geist del sistema de diseño original)
- **Fecha:** 2026-10-11

## Contexto

Tras llevar a la web la estructura y las animaciones de la presentación ([ADR-0022](0022-diseno-de-la-presentacion-en-toda-la-web.md)), el dueño pidió que **los colores y el tipo de letra también cambiaran «a lo nuevo, la web entera»**: los de su página de Wix.

## Decisión

- **Paleta de la presentación como tema por defecto.** El tema **claro** pasa a ser el de la marca nueva y es el que se ve si no se ha elegido otro (`DEFAULT_THEME = 'light'`): fondo crema `#fcf9f2`, paneles `#f2f0ea`, texto azul marino `#2c3e50`, acento verde.
- **Verde algo más oscuro que el de Wix** (`#1f6b42` en vez de `#2a8050`): el de Wix no alcanza 4,5:1 sobre los paneles de color crema y el proyecto exige ese contraste (`contrast.test.ts`). Lo mismo para éxito, aviso y peligro.
- **Oscuro conservado, con la marca nueva:** azul marino profundo (`#16212b`) y verde aclarado (`#5cbf88`), para quien lo elija en Ajustes. «Papel» (lector y exámenes) usa el mismo texto azul marino y el mismo verde.
- **Tipografía:** títulos en **Fraunces**, interfaz en **Wix Madefor Text**. Se conservan **Geist Mono** (cifras y tiempos) y **Literata** (lectura larga), que cumplen una función propia.
- La presentación pública (`public/landing`) usa exactamente los mismos valores.

## Alternativas consideradas

- **Verde exacto de Wix (`#2a8050`).** Más fiel, pero con texto por debajo de 4,5:1 en paneles; descartado por accesibilidad.
- **Quitar el tema oscuro.** El dueño no lo pidió y el oscuro es útil para escuchar de noche.
- **Cambiar también la fuente de lectura.** Literata está elegida para leer mucho rato; no se toca.

## Consecuencias

- Quien tuviera guardado el tema oscuro lo sigue viendo, ahora en azul marino y verde; quien no lo tuviera guardado pasa a ver la web clara.
- El cian y el azul eléctrico originales desaparecen de la interfaz y de la documentación vigente.
- Las pruebas de contraste de los tres temas y las de accesibilidad de los e2e siguen en verde con la paleta nueva.
