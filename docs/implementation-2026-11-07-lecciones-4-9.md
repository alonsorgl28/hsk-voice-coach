# Lecciones 4–9 del curso — 7 de noviembre de 2026

Rama `main` (desde `a543ac6`). Fuente: *HSK Standard Course 1* (PDF renderizado, páginas 42–91, leídas completas) y su cuaderno; el resumen DOCX de clases solo como apoyo (su numeración no coincide; ver `docs/hsk-source.md`).

## Qué cambió

- **Seis lecciones nuevas disponibles** en `src/course.json`, con el mismo formato que 1–3 (enseñar → entender → responder con apoyo → recordar sin ayuda, y un repaso de la lección anterior al final). Lecciones 10–15 siguen «Por preparar».

| Lección | Objetivos comunicativos | Pasos | Libro (impresa / PDF) | Cuaderno |
|---|---|---|---|---|
| 4 · Tā shì wǒ de Hànyǔ lǎoshī | preguntar quién es alguien · presentar (profesora, compañero, amiga) · preguntar el país · decir tu país y devolver «¿y tú?» (呢) | 19 | 22–29 / 42–49 | 17–24 / 19–26 |
| 5 · Tā nǚ'ér jīnnián èrshí suì | preguntar cuántos son en la familia · decirlo · preguntar la edad (几岁 / 多大) · decir una edad; números hasta 99 | 20 | 30–39 / 50–59 | 25–32 / 27–34 |
| 6 · Wǒ huì shuō Hànyǔ | preguntar si alguien sabe hacer algo · decir lo que sabes y no sabes (会 / 不会) · «está muy rico» (很 + adjetivo) · preguntar cómo se escribe (怎么) | 18 | 40–47 / 60–67 | 33–40 / 35–42 |
| 7 · Jīntiān jǐ hào | preguntar la fecha · decir mes y día · día de la semana · 去 + lugar + acción | 20 | 48–55 / 68–75 | 41–48 / 43–50 |
| 8 · Wǒ xiǎng hē chá | preguntar qué quiere alguien · decir lo que quieres (想) · preguntar el precio (多少钱) · decir un precio (块) | 20 | 56–63 / 76–83 | 49–56 / 51–58 |
| 9 · Nǐ érzi zài nǎr gōngzuò | preguntar y decir dónde está alguien o algo (在 / 哪儿 / 那儿) · si está en casa · dónde trabaja alguien | 20 | 64–71 / 84–91 | 57–64 / 59–66 |

- Cada objetivo se usa al menos dos veces (responder con apoyo y recordar), con pequeñas variaciones de situación. Cada paso cita su texto, nota o ejercicio con página impresa y PDF. Los diálogos son frases cortas del libro; explicaciones, situaciones y traducciones son propias.
- **Respuestas personales acotadas** (`SLOTS` en `src/course.mjs`): una frase con «…» acepta un solo valor de un rango o una lista, nunca una cadena cualquiera ni un prefijo.
  - Números en pinyin, caracteres o cifras: edad 1–99, familia 1–20, precio 1–99, mes 1–12, día 1–31. El 2 solo es liǎng donde el chino lo exige (两岁, 两口人, 两块) y èr en fechas (二月, 二号). Se rechazan 一十, 0, 100, «er suì».
  - Fecha de hoy: en los pasos marcados `today` el mes, el día y el día de la semana deben coincidir con la fecha local del dispositivo en el momento de responder. La pantalla muestra «Hoy, en tu dispositivo: sábado 7 de noviembre» y el apoyo usa esa fecha. Los pasos del calendario del libro (9月1号) aceptan solo esa fecha.
  - Listas: país (28, con los hispanohablantes), bebida (茶, 水, 咖啡), lugar de trabajo (学校, 医院, 商店, 家, 公司, 饭馆儿; también 我是学生). Lo que no está en el libro se dice en la pista.
  - El apoyo de esas frases muestra un ejemplo concreto y qué valores valen; el audio reproduce el ejemplo; elegir la opción envía el ejemplo (cuenta como reconocimiento).
- **Profesora:** `coachContext` añade a los pasos personales «respuesta personal: vale cualquier valor válido…» o «la correcta es la fecha real de hoy, …»; `resultUpdate` incluye el modelo correcto al corregir. Los ejemplos se subtitulan como frases revisadas; las palabras de las listas tienen pinyin por palabras. No hay ninguna restricción a 1–3 en la app ni en el prompt publicado (leído en ElevenLabs el 7 nov: idéntico a `agent/system-prompt.md`), así que **no se cambió el agente remoto**.
- Interfaz: solo lo necesario para esas frases (ejemplo, pista, fecha de hoy, marcador de texto «en pinyin; los números pueden ir en cifras»). Mismo estilo visual.

## Compatibilidad

- Lecciones 1–3 sin cambios (mismo contenido —hash comprobado en las pruebas— y versión 2): sus sesiones siguen reanudándose.
- Nuevas lecciones en versión 1. Identificadores nuevos con prefijo `l4-`…`l9-` (frases) y `t4-`, `r5-`, `c9-`… (pasos); las frases de repaso copian la frase original con su mismo id y `from`. Una prueba exige que un id compartido sea la misma frase.
- Misma clave de localStorage, mismo cuaderno, mismos snapshots. El curso (`scope: "course"`, HSK 2009) sigue separado del repertorio HSK 3.0.

## Verificado

- `npm test`: 70/70 (56 anteriores, con dos ajustadas al nuevo número de lecciones, + 14 nuevas en `tests/course-lessons.test.mjs`: integridad de ids y referencias, enseñar antes de recordar, opciones y distractores, números, fecha real, listas, tonos, recorrido completo solo con pinyin y recarga a cada paso, cuaderno antiguo, contexto de la profesora, subtítulos). `npm run build`: correcto.
- Navegador (Chromium con Playwright, build servida en 127.0.0.1:4173), con un cuaderno inyectado que ya tenía 1–3 completadas, una lección antigua de bebidas y una conversación de voz:
  - Lecciones 4–9 recorridas enteras desde la ruta, sin escribir ni leer caracteres: opciones en la mitad de los pasos de responder, pinyin escrito en el resto y en todos los de recordar (edades, países, fechas reales y precios con valores propios). Ninguna respuesta rechazada; las seis terminan con todos los objetivos en «Usada sin modelo».
  - Recarga en el paso 7 de cada lección y «Continuar» desde la ruta: reanuda en el mismo paso.
  - Tras el recorrido: 11 sesiones; las 5 anteriores intactas; 1–3 pasan a «Repaso pendiente» (6 días después), 4–9 «Completada», 10–15 «Por preparar». Consola sin errores ni avisos.
  - Móvil 390 px sin desbordamiento horizontal: repaso sin ayuda de la lección 5 con error real («wo jinnian er sui» rechazado) y acierto en caracteres; repaso de la lección 7 con fecha equivocada (la corrección muestra la fecha real de hoy), caracteres visibles y «Seguir con ayuda».
- Capturas: `docs/screenshots/2026-11-07-lecciones-4-9/` (`d-*` escritorio, `m-*` móvil).

## No verificado

- **Sin conversación real con ElevenLabs ni micrófono** en este encargo. Lo de voz está probado con lógica y pruebas unitarias (contexto, subtítulos, enrutado de transcripciones con cifras).
- El audio del navegador no suena en Chromium sin voz de mandarín, así que en el recorrido no se registraron exposiciones de «Escuchar».

## Problemas de voz para un encargo posterior (observados en código y pruebas, no en conversación)

1. **Tonos**: al escribir o transcribir, nǎr y nàr (哪儿 / 那儿) son iguales; la app no puede distinguir la pregunta de la respuesta por pinyin sin tonos. Elegir la opción equivocada sí se rechaza.
2. **Números en la transcripción**: se aceptan cifras («我今年36岁»), pero falta comprobar cómo transcribe Scribe edades, fechas y precios dichos en voz alta (cifras, caracteres o mezcla).
3. **Frases nuevas de la profesora**: si dice una edad o un país distinto del ejemplo, solo hay pinyin por palabras sin traducción, salvo que llame a `show_line`.
4. **`new_words`**: la app envía todas las palabras de la lección (hasta 22 en la lección 5), pero el prompt dice «at most five». Revisar al ajustar la voz.
5. **Lección 3**: «Wǒ jiào + nombre» sigue aceptando cualquier texto tras «wo jiao» (no se cambió para no invalidar sesiones guardadas).
6. Pendientes de antes: prueba con el micrófono del alumno hablando mandarín; el origen 127.0.0.1 conectó pese al allowlist (1 nov).
