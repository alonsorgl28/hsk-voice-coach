# HSK Voice Coach — seguimiento

## Hecho

- [x] Entorno inspeccionado: GitHub y Vercel autenticados.
- [x] SDK oficial de ElevenLabs Agents revisado (`@elevenlabs/react`, `useConversation`).
- [x] Temario oficial HSK 3.0 verificado (publicado 2025-11, implementación 2026-07).
- [x] Interfaz, persistencia local y exportación del cuaderno.
- [x] Capa de validación anti-invención + 7 tests de contrato.
- [x] Rediseño con el sistema visual de ElevenLabs (tokens extraídos de elevenlabs.io).
- [x] Versiones de dependencias fijadas.
- [x] README, `agent/setup.md`, capturas de escritorio y móvil.

## Pendiente

- [ ] Configurar el agente real en el dashboard (requiere inicio de sesión — paso manual).
- [ ] Cinco conversaciones de prueba con evidencia en `docs/pruebas.md`.
- [ ] Despliegue en Vercel y allowlist del dominio en el agente.
- [ ] Párrafo de postulación y bullet de CV, escritos sobre resultados reales.

## Decisiones

React + Vite + SDK oficial. Sin backend ni API keys: un agente público solo necesita su
Agent ID. Historial en localStorage. Contenido y límites en `curriculum.json`. El agente
reporta el aprendizaje mediante una herramienta de cliente cuya salida se valida contra la
transcripción antes de guardarse.

No confundir los tests del código con conversaciones reales: hasta que no existan las
cinco pruebas, el proyecto no está validado.
