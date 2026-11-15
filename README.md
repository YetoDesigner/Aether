# Aether

Coach de disciplina y bienestar emocional por voz. Un orbe que te escucha, te responde y te ayuda a alinear lo que **piensas**, **sientes** y **haces**.

## Cómo se usa

- **Mantén presionado el orbe** para hablar; al soltar, el coach responde **en voz alta**.
- **Toca el orbe** para abrir el chat de texto (silencioso). Todo queda en un historial de conversaciones por día.
- **Primero, cómo te sientes**: en cada franja (mañana, tarde, noche) el coach pregunta tu ánimo antes que nada.
- **Comandos por voz o texto**, dichos como quieras:
  - «Agenda el gimnasio mañana a las 7»
  - «Ya terminé el informe» / «Me estoy preparando para la reunión»
  - «Bloquea Instagram y TikTok por 3 días»
  - «Modo enfoque 45 minutos»
- **Objetivos · Coach**: objetivos con fecha, hora, recordatorios y pasos; pulso anímico, pensamientos intrusivos y positivos, anillos de alineación.
- **Configuración**: voz, notificaciones, bloqueo de apps (enfoque y programado).

## Despliegue en Vercel (IA con OpenAI)

1. Importa este repositorio en [vercel.com/new](https://vercel.com/new). No necesita configuración de build.
2. En **Settings → Environment Variables** añade:
   - `OPENAI_API_KEY` — tu clave de OpenAI (obligatoria).
   - `OPENAI_MODEL` — opcional, por defecto `gpt-4.1-mini`.
   - `OPENAI_TTS_MODEL` — opcional, por defecto `gpt-4o-mini-tts` (voz económica con acento latino por instrucciones).
   - `OPENAI_TTS_VOICE` — opcional, voz por defecto `coral` (también se elige en Configuración).
3. Despliega. La app llama a `/api/chat` ([api/chat.js](api/chat.js)) y a `/api/tts` ([api/tts.js](api/tts.js)); la clave nunca llega al navegador.

Si la voz de OpenAI no está disponible, el orbe usa la voz del navegador automáticamente.

Sin servidor (por ejemplo en GitHub Pages o abriendo el archivo), la app funciona con un motor local más básico.

> El endpoint `/api/chat` es público: configura un límite de gasto en tu cuenta de OpenAI.

## Requisitos

- Chrome (recomendado) para reconocimiento y síntesis de voz.
- La página debe servirse por `https://` o `localhost` para usar el micrófono.

Los datos se guardan en el navegador (`localStorage`). En la versión web, el bloqueo de apps es un compromiso que el coach supervisa; bloquear otras apps del sistema requiere una app nativa.

> Aether es una herramienta de autoconocimiento y hábitos. No hace diagnósticos ni reemplaza a un psicólogo.
