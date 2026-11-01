# HSK Voice Coach — contexto actual

Actualizado: 2026-10-31. Rama de implementación y entrega: `feat/guided-learning`.

Primera lección guiada HSK 1 «¿Agua o té?» implementada en cinco etapas con guardado, reanudación, ayudas progresivas y comprobación local. Audio de navegador separado de la conversación opcional con ElevenLabs. El cuaderno conserva evidencia, modalidad y fechas de repaso; frases personales separadas del progreso HSK. Configuración en `src/lessons.json` y `src/curriculum.json`.

Validado: 35 pruebas, TypeScript, build, recorrido de cinco etapas, persistencia al recargar y vista móvil. No se probó una conversación real con el micrófono del estudiante. La coincidencia de frases no evalúa pronunciación.

ElevenLabs: nuevo prompt, `suggest_phrase`, español adicional y Patient/15 segundos preparados en borrador. La publicación fue rechazada por la validación de los hosts existentes localhost:5199 y localhost:5173. Pendiente respuesta del usuario para sustituirlos por 127.0.0.1:4173 conservando el dominio de producción; no se modificó el allowlist. La versión publicada anterior sigue activa.

Vista local: http://127.0.0.1:4173/. Proyecto Vercel existente: `hsk-voice-coach`, equipo `alonsos-projects-bad65756`; dominio de producción: https://hsk-voice-coach.vercel.app. Detalles y pendientes en `docs/implementation-2026-10-31.md`.
