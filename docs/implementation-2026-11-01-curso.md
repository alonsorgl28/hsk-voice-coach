# Curso del libro para principiante — 1 de noviembre de 2026

## Qué cambió

- **Entrada principal:** la ruta de *HSK Standard Course 1* en el orden del libro (15 lecciones). Las lecciones 1–3 están completas; 4–15 aparecen «Por preparar», con título, objetivo según el índice y página, sin botón. La lección de bebidas pasa a «Práctica adicional».
- **Enseñar antes de evaluar:** cada lección empieza con un diálogo del libro (escuchar y repetir), sigue con comprender, responder con apoyo visible y termina con pasos de recordar sin ayuda. El repaso de otro día solo contiene los pasos de recordar.
- **Pinyin y español por defecto.** Los caracteres son opcionales («Ver caracteres», preferencia guardada). Nada obliga a escribir ni leer caracteres: se avanza por voz, eligiendo una opción o escribiendo pinyin.
- **Pinyin escrito:** sin distinguir mayúsculas, espacios, puntuación ni tonos; ü puede escribirse v o u:. Se guarda como modalidad `pinyin` (escrita), distinta de la voz (`transcript`).
- **Profesora integrada:** el mismo estado (lección, paso, respuesta esperada, si el apoyo está visible, frases revisadas y lo ya dicho) llega a ElevenLabs en cada paso (`coachContext`). Comandos «Espera», «Repite», «Más lento», «No entendí», «Al principio» por botón o por voz; sin conexión funcionan con el audio del navegador.
- **Audio propio:** al reproducir un modelo con la profesora conectada se silencia el micrófono y lo que se transcriba durante el audio (+1,5 s) se ignora.
- **Subtítulos de la profesora:** pinyin y español revisados para las frases del curso; contrato `show_line` para cualquier otra frase; si no hay ninguno, solo pinyin por palabras con aviso «sin traducción revisada», o un aviso si tampoco hay pinyin. Los turnos vacíos («...») no borran el último subtítulo.
- **Progreso por lo que puedes comunicar:** objetivos por lección (saludar, pedir perdón, dar las gracias, decir tu nombre…), con evidencia por frase: escuchada → reconocida → dicha con apoyo → usada sin modelo. Solo un paso de recordar sin apoyo cuenta como uso sin modelo; elegir una opción es reconocimiento; ver o retirar el apoyo cuenta como apoyo. Repaso por fechas con los intervalos de `curriculum.json`.
- **Marcos separados:** el libro sigue el HSK de 2009; la conversación libre usa el temario HSK 3.0 (2025). La evidencia del libro se guarda con `scope: "course"` y no se mezcla con el repertorio de 40 palabras.
- **Compatibilidad:** misma clave de localStorage; las sesiones nuevas pasan `readHistory()`. Cada sesión guarda `lessonSnapshot` y la versión del contenido; una ejecución antigua no se reanuda contra contenido nuevo.

Archivos: `src/course.json` (contenido y referencias), `src/course.mjs` (lógica pura), `src/CourseLesson.tsx`, `src/CoursePath.tsx`, cambios en `src/App.tsx`, `src/progress.mjs` (planificador compartido), `src/useBrowserSpeech.ts` (aviso de fin o fallo), `src/styles.css`, `tests/course.test.mjs`, `agent/system-prompt.md`, `agent/setup.md`, `docs/hsk-source.md`.

## Verificado

- 56/56 pruebas (35 anteriores + 21 nuevas), TypeScript y build de Vite.
- Navegador (Chrome con Playwright, servidor local 127.0.0.1:4173): primera visita con cuaderno vacío; lecciones 1, 2 y 3 completas; corrección e «Intentar otra vez»; opciones; pinyin con y sin tonos y con números; nombre propio en «Wǒ jiào + nombre»; retirar apoyo sin borrar la ayuda usada; «No entendí», «Repite», «Más lento» y «Al principio» sin conexión; reanudación tras recargar; navegador sin voz de mandarín (simulado); vista móvil 390 px sin desbordamiento; cuaderno con sesiones antiguas inyectadas (bebidas y voz) intactas; repaso «otro día» (fechas desplazadas 2 días) que se despeja al recordar sin ayuda. Consola sin errores.
- Conversación real con ElevenLabs (conv_9501m6cx5vn8edbrscpg9q4m61tf, 29 s): la profesora recibió el contexto del paso 1 y lo siguió («你好！ Por favor, repite»); el subtítulo mostró «Nǐ hǎo! · ¡Hola!». El micrófono de la Mac captó audio de fondo en inglés y la app no lo calificó. Se corrigieron después: contexto duplicado, saludo interrumpido y turnos «...».
- Prueba simulada de ElevenLabs sobre la rama de revisión (texto, no voz): paso de recordar sin dar la respuesta, 3/3 aprobadas.

## No verificado

- Prueba con el micrófono del alumno hablando mandarín: no la hice; la transcripción de tus respuestas, los comandos por voz y el silenciado durante el audio propio están probados solo con lógica y pruebas unitarias.
- El nuevo prompt y `show_line` están en la rama `curso-libro-principiante` (0 % de tráfico). Main sigue con el prompt anterior: la app funciona con él, pero la profesora no sabe del contrato `show_line` ni de las reglas del curso hasta que publiques la rama.
- Sin deploy a Vercel ni commit.
