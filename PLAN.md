# HSK Voice Coach — seguimiento

## Hecho

- [x] Entorno inspeccionado: GitHub y Vercel autenticados.
- [x] SDK oficial de ElevenLabs Agents revisado (`@elevenlabs/react`, `useConversation`).
- [x] Temario oficial HSK 3.0 verificado (publicado 2025-11, implementación 2026-07).
- [x] Interfaz, persistencia local y exportación del cuaderno.
- [x] Capa de validación anti-invención + 7 tests de contrato.
- [x] Rediseño con el sistema visual de ElevenLabs (tokens extraídos de elevenlabs.io).
- [x] Interacción tipo Mural: el chat se sustituye por un escenario con un gradiente
      animado que reacciona al audio real (cuatro estados) y subtítulos con pinyin y
      significado palabra por palabra bajo la voz de la profesora.
- [x] Rediseño en blanco: durante la conversación no hay nada en pantalla salvo el
      gradiente y lo que ella acaba de decir. Reloj, navegación y vocabulario se fueron
      a antes y después.
- [x] Gradiente con grano y ruido de valor, borde disuelto y paleta luminosa sobre blanco.
- [x] `suggest_phrase`: al preguntar "¿cómo digo esto?" la frase queda fija en pantalla.
      Acepta vocabulario fuera de nivel y lo marca sin contarlo como practicado.
- [x] Versiones de dependencias fijadas.
- [x] README, `agent/setup.md`, capturas de escritorio y móvil.
- [x] Enlace `?demo=1` para enseñar la app sin gastar créditos.

## Pendiente

- [ ] Configurar el agente real en el dashboard (requiere inicio de sesión — paso manual).
      Ahora son DOS client tools: `record_learning` y `suggest_phrase`.
- [ ] Verificar el gradiente contra la referencia de grainient.supply (el original es un
      MP4 tras un muro de pago; falta una captura para comparar).
- [ ] Cinco conversaciones de prueba con evidencia en `docs/pruebas.md`.
- [ ] Despliegue en Vercel y allowlist del dominio en el agente.
- [ ] Párrafo de postulación y bullet de CV, escritos sobre resultados reales.

## Decisiones

React + Vite + SDK oficial. Sin backend ni API keys: un agente público solo necesita su
Agent ID. La interacción sigue el modelo de Mural (un objeto vivo en el centro, no un hilo
de mensajes), pero sobre ElevenLabs en web, no OpenAI Realtime en iOS. El gradiente se
dibuja en canvas y lee el audio dentro de `requestAnimationFrame`, fuera del estado de
React. Los subtítulos se glosan en el cliente contra `curriculum.json`: el modelo nunca
aporta la traducción, así que no puede inventarla. Historial en localStorage. Contenido y límites en `curriculum.json`. El agente
reporta el aprendizaje mediante una herramienta de cliente cuya salida se valida contra la
transcripción antes de guardarse.

No confundir los tests del código con conversaciones reales: hasta que no existan las
cinco pruebas, el proyecto no está validado. Los estados del gradiente durante una sesión
real (escuchando / pensando / hablando) se verificaron en un banco de pruebas aislado, no
todavía con una conversación de verdad. La tarjeta de `suggest_phrase` se ha visto con
datos de ejemplo en `?demo=1`, nunca disparada por la profesora: eso requiere declarar la
herramienta en el dashboard.
