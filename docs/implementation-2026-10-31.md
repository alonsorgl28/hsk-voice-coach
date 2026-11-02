# Implementación — 31 de octubre de 2026

## Implementado

- Primera lección HSK 1 «¿Agua o té?»: recordar, escuchar, practicar, conversar y comprobar. Avance controlado por respuestas; pistas y modelos con asistencia persistente. Permite guardar y retomar.
- Audio de modelos con voces de mandarín disponibles en el navegador, velocidad configurable y alternativa de lectura. Discriminación hē/hé sin puntuación de pronunciación.
- Conversación opcional de ElevenLabs vinculada a la etapa. Controles de repetición, ritmo, pistas, texto y subtítulos ocultables. Una corrección visible a la vez.
- Cuaderno con evidencia de exposición, reconocimiento, repetición y uso sin modelo. Modalidades separadas; las palabras de la profesora y los comandos de la app no cuentan como producción del alumno.
- Repaso por fecha, intervalos configurables 1/3/7/14 días y recuperación posterior; las respuestas del mismo día no extienden el intervalo. Frases personales practicables sin sumar progreso HSK.
- Registro de interrupciones y proxy transcripción→audio del cliente. No mide latencia acústica ni precisión de tonos.

## Validación

- 35/35 pruebas de dominio y contratos aprobadas.
- TypeScript y build de Vite aprobados. Permanece el aviso de bundle grande (~834 kB, ~232 kB gzip), principalmente integración de voz existente.
- Recorrido manual en navegador: cinco etapas, respuesta incorrecta bloqueada, lectura alternativa, guardado y continuación tras recargar, cierre y cuaderno. Revisión móvil sin desbordamiento horizontal; consola sin errores en el recorrido local.
- No se ha probado una conversación real de voz con el micrófono del alumno; el reconocimiento bilingüe y la paciencia percibida requieren esa prueba.
- Instalada en el proyecto original, rama `feat/guided-learning`; vista local `http://127.0.0.1:4173/`. Entrega a GitHub y Vercel solicitada posteriormente por el usuario; el estado de la publicación se comprueba en el historial Git y Vercel.

## ElevenLabs

El agente publicado el 1 de noviembre de 2026 contiene el nuevo prompt de `agent/system-prompt.md`, saludo con identificación de IA, idioma adicional español, herramienta cliente `suggest_phrase`, modo Patient y espera de silencio de 15 segundos (antes 7). La voz Yun ya estaba a velocidad 0.9; se conserva el modelo y el reconocimiento existentes.

**Publicado el 1 de noviembre de 2026:** Main activo con el 100 % del tráfico, confirmado en ElevenLabs. Se retiraron los hosts inválidos `localhost:5199` y `localhost:5173`; permanece autorizado `hsk-voice-coach.vercel.app`. No se añadió `127.0.0.1:4173`. Las pruebas de voz con el estudiante siguen pendientes.

## Alcance y próximos pasos

La primera lección usa un repertorio pequeño y respuestas previstas; una respuesta distinta puede ser válida aunque no coincida con el ejercicio. El currículo conserva las 40 palabras verificadas y añade andamiaje conversacional marcado por separado, no el temario HSK completo. Completar la secuencia no certifica fluidez.

Pendientes: probar conversación de voz en español/mandarín y medir interrupciones; ampliar lecciones y variantes aceptadas usando el mismo formato de configuración; comparar retención en sesiones de distintos días.
