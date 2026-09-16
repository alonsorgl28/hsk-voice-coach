# HSK Voice Coach

Una profesora de mandarín con voz, construida sobre ElevenLabs Agents, para practicar
diez minutos al día siguiendo el vocabulario del HSK.

![HSK Voice Coach](docs/screenshots/desktop.png)

## El problema

Aprender mandarín falla por falta de conversación, no por falta de material. Las apps de
tarjetas enseñan a reconocer caracteres, pero nadie practica hablar. Un profesor humano
resuelve eso y cuesta 20-40 USD la hora, con horario fijo. El resultado habitual es un
estudiante que lee HSK 2 y no sabe presentarse en voz alta.

## La solución

Una sesión diaria de diez minutos, hablada, con una profesora de IA que:

- ocupa el centro de una pantalla blanca y vacía como un gradiente animado que reacciona
  a la voz — escucha, piensa y habla, sin interfaz de chat de por medio;
- te da la frase cuando no sabes decir algo, y la deja fija en pantalla;
- habla principalmente en mandarín y explica en español;
- se limita al vocabulario del nivel HSK seleccionado;
- introduce como máximo cinco palabras nuevas por sesión;
- corrige mostrando 汉字 / pinyin / explicación breve;
- termina con vocabulario practicado, errores, recomendación y una tarea.

Todo queda en un cuaderno local que alimenta la sesión siguiente.

## Arquitectura

```
Navegador (React + Vite)
   │
   ├── @elevenlabs/react  ──WebRTC (voz) / WebSocket (texto)──►  ElevenLabs Agent
   │      · dynamicVariables: nivel, tema, vocabulario permitido
   │      · clientTool record_learning ◄── el agente registra lo aprendido
   │      · clientTool suggest_phrase  ◄── el agente fija una frase en pantalla
   │
   ├── src/learning.mjs   capa de validación (el agente no puede mentir)
   ├── src/subtitles.mjs  glosa palabra por palabra de lo que dice la profesora
   ├── src/Gradient.tsx   el gradiente animado, alimentado por el audio real
   │
   └── localStorage       cuaderno de sesiones
```

Sin backend y sin base de datos. El Agent ID es público por diseño; **no hay ninguna API
key en el cliente**, así que no hace falta un servidor que la proteja.

| Archivo | Responsabilidad |
|---|---|
| `src/App.tsx` | UI y ciclo de vida de la sesión |
| `src/Gradient.tsx` | El gradiente animado y sus cuatro estados |
| `src/subtitles.mjs` | Segmentación y glosa de los subtítulos |
| `src/learning.mjs` | Plan de la sesión + validación de lo que reporta el agente |
| `src/curriculum.json` | Niveles, temas, vocabulario y límites — todo configurable |
| `agent/system-prompt.md` | System prompt de la profesora |
| `agent/setup.md` | Cómo configurar el agente en el dashboard |
| `tests/learning.test.mjs` | Tests de contrato de la capa de validación |
| `tests/subtitles.test.mjs` | Tests de la glosa de subtítulos |
| `tests/phrase.test.mjs` | Tests de la frase fija de `suggest_phrase` |

## Uso de ElevenLabs

- **Agents** para el agente conversacional: voz, system prompt, variables dinámicas y
  herramientas de cliente.
- **`@elevenlabs/react`** (`useConversation`) para la integración: WebRTC en modo voz,
  WebSocket en modo texto, transcripción en vivo, y `record_learning` y `suggest_phrase`
  como client tools.
- **Variables dinámicas** para inyectar en cada sesión el nivel, el tema, el vocabulario
  permitido y la recomendación anterior, sin duplicar prompts por nivel.

### Tipografía

**General Sans** (Fontshare) en una sola familia y cuatro pesos, más **Noto Sans SC** para
el chino. Es una alternativa libre a PP Neue Montreal, que es la del estilo de referencia
y es de pago.

### La interacción: un objeto que escucha, no un hilo de mensajes

La sesión no se lee, se habla. Durante la conversación la pantalla está blanca y no hay
nada en ella salvo el gradiente y lo que la profesora acaba de decir. Ni reloj, ni barra
de navegación, ni lista de vocabulario: todo eso vive antes de empezar y después de
terminar, porque contar los segundos no enseña nada y mirar una lista mientras deberías
escuchar, tampoco.

En el centro hay un gradiente animado que es la profesora: un lienzo que dibuja cinco
masas de color sobre una base saturada y se mueve con el audio real de la conversación —
`getInputVolume()` mientras hablas tú, `getOutputVolume()` mientras habla ella. Tiene
cuatro estados con color, escala y velocidad propios: en reposo, escuchando, pensando y
hablando. El ataque es rápido y la caída lenta, así que la masa salta con la voz y se
asienta despacio en lugar de parpadear.

Cuatro detalles hacen el movimiento.

**El desplazamiento es ruido, no ondas.** Una onda tiene un periodo visible y a los diez
segundos ves el gradiente repetirse; el ruido de valor no se repite nunca.

**El contorno no es un círculo.** Se traza en coordenadas polares con el radio modulado
por ruido muestreado *sobre* una circunferencia, lo que lo hace periódico en θ de balde y
garantiza que la forma siempre cierre sobre sí misma.

**El motion blur es acumulación.** En vez de borrar el lienzo cada frame, se le pasa una
capa de blanco casi transparente por encima; lo que sobrevive debajo es la estela. Es el
mismo principio que el `WebGLRenderTarget` de las referencias en Three.js, pero en canvas
2D y sin una sola dependencia. Cuanto más baja la opacidad de ese lavado, más larga la
cola: al pensar es de `.04` y la estela es larga, en reposo es de `.085` y apenas se
insinúa.

**El cuerpo se compone a través de un desenfoque.** Se dibuja en un lienzo aparte y se
vuelca con `filter: blur()`, porque un `clip()` deja un borde a navaja y en la referencia
no hay un solo filo. El grano — cuatro texturas de ruido alternadas en `overlay` — va
recortado al cuerpo y no a toda la caja: pintado sobre la estela, que se vuelve a granular
en cada frame, se sedimenta en un moteado sucio.

Medido: 0,18 ms por frame a 640×640, contra un presupuesto de 16,7 ms.

Todo pasa fuera del ciclo de render de React: el nivel se lee dentro de `requestAnimationFrame`
a través de una referencia, nunca desde el estado, y el halo se controla con variables CSS
escritas directamente sobre el nodo.

### "Oye, ¿cómo digo esto?"

El caso de uso que más se repite aprendiendo un idioma es querer decir algo que todavía no
sabes decir. No hace falta ningún botón: se lo dices y ya está. Lo que hace la app es que
su respuesta **no se desvanezca** — la profesora la manda por la client tool
`suggest_phrase` y la tarjeta se queda fija hasta que la cierras, porque no puedes repetir
una frase que desapareció mientras la leías.

Esta es la única herramienta que acepta vocabulario fuera de tu nivel, y es deliberado:
pedir cómo se dice algo es, casi siempre, pedir lenguaje que aún no tienes. La app marca
esas frases como fuera de nivel y no las cuenta como vocabulario practicado, así que el
progreso HSK sigue siendo honesto.

### Los subtítulos: significado sin inventar traducciones

Bajo el gradiente aparece lo último que dijo la profesora, con el pinyin y el significado
en español debajo de cada palabra. El subtítulo se mantiene hasta que la frase siguiente lo
reemplaza: nunca se desvanece por su cuenta mientras lo estás leyendo. Un único control
recorre tres densidades — solo 汉字, con pinyin, y con significado — y recuerda cuál
prefieres. La glosa no se le pide al modelo: se calcula en el
cliente segmentando el chino contra `curriculum.json` (`src/subtitles.mjs`), prefiriendo
siempre la palabra más larga. Una palabra que no está en el vocabulario aparece sin
significado y la app lo dice, en vez de adivinar. Es una glosa palabra por palabra, no una
traducción de la frase, y la interfaz también lo advierte.

### La decisión de diseño principal: el agente no puede inventar progreso

Un LLM al que le pides un resumen pedagógico tiende a inflarlo — dice que practicaste
palabras que nunca aparecieron, o inventa correcciones plausibles. Eso convierte la app en
un juguete que te felicita.

Aquí `record_learning` no escribe directamente en el cuaderno. Pasa por
`validateLearningEvent` (`src/learning.mjs:29`), que rechaza:

- **vocabulario fuera de nivel** — el chino debe segmentarse íntegramente en palabras
  permitidas de esta sesión;
- **progreso sin evidencia** — cada palabra de `practiced` debe aparecer literalmente en
  la transcripción;
- **correcciones inventadas** — cada corrección exige una cita exacta de un mensaje real
  del estudiante.

Si falla, la herramienta devuelve un error al agente y este debe corregirse y reintentar.
El cuaderno solo guarda lo que de verdad ocurrió.

## Otras decisiones

- **Sin backend.** Un agente público solo necesita su ID. Añadir un servidor para el MVP
  habría sido arquitectura sin propósito.
- **Vocabulario en JSON, no en el prompt.** Añadir HSK 3 es editar `curriculum.json`.
- **Modo texto además de voz.** Sirve para probar sin gastar créditos de voz y como
  alternativa cuando el reconocimiento falla.
- **`?demo=1`.** Abre la vista de ejemplo con los subtítulos, sin conectar ni gastar
  créditos. Sirve para enseñar la app.
- **Cierre con tiempo límite.** A los 9 minutos la app pide el resumen; si el agente no
  responde en 45 segundos, corta igual y guarda la transcripción sin resumen. Una sesión
  desconectada nunca se marca como completada.

## Limitaciones

- **No evalúa pronunciación.** La plataforma no expone puntuación de tonos, y el prompt
  prohíbe explícitamente al agente fingir que puede medirla. Cualquier indicación de
  pronunciación es orientativa.
- **40 palabras**, no el temario completo (35 de HSK 1 y 5 de HSK 2). Es un repertorio de
  práctica inicial, no una preparación de examen. Ver `docs/hsk-source.md`.
- **El cuaderno vive en un solo navegador.** Sin cuentas ni sincronización. Hay exportación
  a JSON para no perderlo.
- **Sin control de gasto.** Cada sesión consume créditos de ElevenLabs.

## Ejecutar en local

```bash
npm install
cp .env.example .env      # opcional: el Agent ID también se puede pegar en la UI
npm run dev
```

Necesitas un agente propio en ElevenLabs. Los pasos están en
[`agent/setup.md`](agent/setup.md) — se tarda unos diez minutos.

```bash
npm test        # tests de validación y subtítulos
npm run build   # typecheck + build de producción
```

## Marco HSK

Se usa el temario HSK 3.0 publicado en noviembre de 2025 (implementación indicada para
julio de 2026). Las 40 entradas se verificaron contra sus secciones del documento oficial.
Los ejemplos, explicaciones y roleplays son originales; no se reproduce material de
examen ni de libros de texto. Detalle en [`docs/hsk-source.md`](docs/hsk-source.md).

## Capturas

| Escritorio | Móvil |
|---|---|
| ![](docs/screenshots/desktop.png) | ![](docs/screenshots/mobile.png) |

## Estado

| Entregable | Estado |
|---|---|
| Aplicación funcional | Hecho |
| Capa de validación + tests | Hecho (23/23) |
| Rediseño en blanco, solo voz y gradiente | Hecho |
| Interacción por gradiente animado + subtítulos | Hecho |
| Motion blur por acumulación y contorno deformable | Hecho |
| Frase fija al preguntar "¿cómo digo…?" | Hecho (falta declarar la tool en el dashboard) |
| Agente configurado en ElevenLabs | Pendiente |
| Cinco conversaciones de prueba | Pendiente |
| Despliegue | Pendiente |

Los resultados de las pruebas se publicarán en `docs/pruebas.md` cuando el agente esté
conectado. Este README no afirma que algo funcione antes de haberlo probado.
