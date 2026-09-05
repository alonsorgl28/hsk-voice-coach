# Configurar el agente en ElevenLabs

Unos diez minutos en el dashboard. No hace falta ninguna API key: la app solo usa el
**Agent ID**, que es público por diseño.

## 1. Crear el agente

1. Entra en <https://elevenlabs.io/app/agents> y crea un agente en blanco.
2. Nómbralo `HSK Voice Coach`.

## 2. System prompt

Copia el contenido completo de [`system-prompt.md`](system-prompt.md) en el campo
**System prompt**. Está en inglés a propósito: los modelos siguen instrucciones de formato
con más fiabilidad en inglés, aunque el agente hable en mandarín y español.

## 3. Idioma y voz

| Campo | Valor |
|---|---|
| Agent language | Chinese (Mandarin) |
| Additional languages | Spanish |
| Voice | Una voz femenina con soporte de mandarín. `Xiaoyin` o similar funciona bien. |
| First message | *(vacío)* — el prompt ya define el saludo |

Baja la velocidad de la voz si suena rápida para nivel principiante.

## 4. Variables dinámicas

La app envía estas siete variables en cada sesión. Decláralas en
**Agent → Dynamic variables** con un valor por defecto cualquiera (se sobrescriben al
conectar):

| Variable | Contenido |
|---|---|
| `hsk_level` | Nivel elegido (1 o 2) |
| `topic` | Título del tema del día |
| `session_minutes` | Duración objetivo (10) |
| `allowed_vocabulary` | JSON con el vocabulario permitido, pinyin y glosa |
| `new_words` | JSON con las palabras objetivo (máx. 5) |
| `review_words` | JSON con las palabras a repasar (máx. 3) |
| `previous_recommendation` | Recomendación de la sesión anterior |

## 5. Herramienta de cliente `record_learning`

En **Agent → Tools → Add tool → Client tool**:

| Campo | Valor |
|---|---|
| Name | `record_learning` |
| Description | `Save a lesson phrase, a correction or the final session summary to the student's notebook. Argument payload is serialized JSON. Returns OK or an ERROR to repair and retry.` |
| Wait for response | **Sí** (el agente debe leer el error si el registro se rechaza) |

Un único parámetro:

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `payload` | String | Sí | `Serialized JSON. One of the lesson, correction or summary objects described in the system prompt. No markdown fences.` |

El contrato de los tres objetos está al final de `system-prompt.md`.

## 6. Seguridad y dominios

En **Security**:

- Deja el agente como **público** (sin autenticación). Es lo que permite que la app
  funcione sin backend.
- En **Allowlist**, añade los dominios donde vaya a correr: `localhost` para desarrollo y
  el dominio de producción.

## 7. Conectar la app

Copia el Agent ID (empieza por `agent_`) y pégalo en el icono de configuración de la app,
o en `.env` como `VITE_ELEVENLABS_AGENT_ID`.

> El Agent ID no es una API key. Nunca pegues una API key en el cliente ni la subas al
> repositorio.

## 8. Comprobación

Abre la app, elige **Texto** y pulsa empezar. El modo texto no gasta créditos de voz y
sirve para verificar que el prompt y `record_learning` funcionan antes de hablar.

Señales de que está bien configurado:

- la profesora saluda con 你好 y hace **una** pregunta;
- al corregirte aparece una tarjeta con 汉字, pinyin y explicación;
- al pulsar "Resumir y terminar" el cuaderno guarda vocabulario, errores y tarea.

Si las tarjetas no aparecen, la herramienta de cliente no está bien declarada: revisa que
el parámetro se llame exactamente `payload` y sea de tipo String.
