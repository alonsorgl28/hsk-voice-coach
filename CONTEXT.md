# HSK Voice Coach — contexto actual

Actualizado: 2026-11-07. Lecciones 4–9 en la rama `curso-lecciones-4-9` (commit `544cce1`, push hecho, **sin merge a `main`**), creada desde `main` en `a543ac6`.

**Entrada principal: curso del libro HSK Standard Course 1** (marco HSK 2009). Ruta de 15 lecciones en el orden del libro; **lecciones 1–9 completas** (1–3 desde el 1 nov; 4–9 desde el 7 nov), 10–15 «Por preparar». Pinyin y español por defecto, caracteres opcionales, sin escribir caracteres para avanzar (voz, opciones o pinyin). Progreso por objetivos comunicativos y por frase, separado del repertorio HSK 3.0. Respuestas personales (edad, familia, país, fecha real, bebida, trabajo, precio) validadas con rangos y listas cerradas (`SLOTS`). Profesora de voz integrada con el paso actual (`coachContext`) y subtítulos (`show_line`). Datos en `src/course.json`, lógica en `src/course.mjs`.

Detalles: `docs/implementation-2026-11-07-lecciones-4-9.md` (lecciones 4–9, pruebas, problemas de voz pendientes) y `docs/implementation-2026-11-01-curso.md` (diseño del curso). Fuente y páginas: `docs/hsk-source.md`.

Verificado el 7 nov: 70 pruebas, build, recorrido completo de 4–9 en navegador (escritorio y móvil, recarga, cuaderno anterior intacto). **No** probado con ElevenLabs ni micrófono en este encargo.

ElevenLabs: prompt y `show_line` publicados en Main el 2026-11-01 (versión `agtvrsn_3701m6d5174bf9t99jf8t53jtnde`). Leído el 7 nov: sin restricciones a lecciones concretas; no hizo falta cambiarlo para 4–9.

Producción: https://hsk-voice-coach.vercel.app (proyecto Vercel `hsk-voice-coach`, equipo `alonsos-projects-bad65756`). Deploy a producción el 2026-11-07 con `vercel --prod` desde `544cce1` (`dpl_A6XsTmafMBVZHCjRxFPeAzx8TzZx`), comprobado: lecciones 1–9 disponibles, consola sin errores. Producción va por delante de `main` hasta hacer el merge. Vista local: http://127.0.0.1:4173/.

## Próximos pasos

- Merge de `curso-lecciones-4-9` a `main`.

- Encargo de voz: ver la lista «Problemas de voz» en `docs/implementation-2026-11-07-lecciones-4-9.md`.
- Lecciones 10–15 con el mismo patrón.

## Estado anterior

- 1 nov: curso del libro con lecciones 1–3, profesora integrada, deploy a producción (`efc38a4`, después en `main`).
- 31 oct – 1 nov: lección guiada de bebidas «¿Agua o té?» (ahora «Práctica adicional», `src/lessons.json`).
