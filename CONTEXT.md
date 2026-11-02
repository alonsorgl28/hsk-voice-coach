# HSK Voice Coach — contexto actual

Actualizado: 2026-11-01 (noche). Rama de implementación y entrega: `feat/guided-learning`.

**Entrada principal: curso del libro HSK Standard Course 1** (marco HSK 2009). Ruta de 15 lecciones en el orden del libro; lecciones 1–3 completas (你好, 谢谢你, 你叫什么名字), 4–15 «Por preparar». Pinyin y español por defecto, caracteres opcionales, sin escribir caracteres para avanzar (voz, opciones o pinyin). Progreso por objetivos comunicativos y por frase, separado del repertorio HSK 3.0. Profesora de voz integrada con el paso actual (`coachContext`) y subtítulos estructurados (`show_line`). Datos en `src/course.json`, lógica en `src/course.mjs`. Detalles, pruebas y pendientes: `docs/implementation-2026-11-01-curso.md`; fuente y páginas: `docs/hsk-source.md`.

ElevenLabs: el prompt del curso y la herramienta `show_line` (`tool_9201m6cx8zfae6e8yjd9pcv1scrb`) están en la rama `curso-libro-principiante` (`agtbrch_3701m6cxaeqze7dra9bz147vd9xs`, 0 % de tráfico). Main sigue con el prompt anterior; publicar la rama requiere la aprobación de Alonso (el cambio directo en Main fue bloqueado por permisos). Observado: una conversación desde 127.0.0.1:4173 conectó pese al allowlist.

Sin commit ni deploy de esta entrega.

## Estado anterior (31 oct – 1 nov, antes del curso)

Primera lección guiada HSK 1 «¿Agua o té?» implementada en cinco etapas con guardado, reanudación, ayudas progresivas y comprobación local. Audio de navegador separado de la conversación opcional con ElevenLabs. El cuaderno conserva evidencia, modalidad y fechas de repaso; frases personales separadas del progreso HSK. Configuración en `src/lessons.json` y `src/curriculum.json`.

Validado: 35 pruebas, TypeScript, build, recorrido de cinco etapas, persistencia al recargar y vista móvil. No se probó una conversación real con el micrófono del estudiante. La coincidencia de frases no evalúa pronunciación.

ElevenLabs: nuevo prompt, `suggest_phrase`, español adicional y Patient/15 segundos publicados el 2026-11-01 en Main con el 100 % del tráfico (verificado en UI: Live 100%). Para resolver la validación se retiraron localhost:5199 y localhost:5173; el allowlist conserva solo hsk-voice-coach.vercel.app. No se añadió un origen local. Sigue pendiente probar una conversación real de voz con el estudiante.

Vista local: http://127.0.0.1:4173/. Proyecto Vercel existente: `hsk-voice-coach`, equipo `alonsos-projects-bad65756`; dominio de producción: https://hsk-voice-coach.vercel.app. Detalles y pendientes en `docs/implementation-2026-10-31.md`.
