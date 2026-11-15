// Función serverless de Vercel: convierte texto en voz con OpenAI.
//
// Variables de entorno:
//   OPENAI_API_KEY            (obligatoria)
//   OPENAI_TTS_MODEL          (opcional, por defecto gpt-4o-mini-tts: económico y admite instrucciones de estilo)
//   OPENAI_TTS_VOICE          (opcional, voz por defecto: ash, masculina)
//   OPENAI_TTS_INSTRUCTIONS   (opcional, reemplaza las instrucciones de acento y tono)

// La respuesta se transmite en streaming: con GET /api/tts?text=...&voice=... el navegador
// empieza a reproducir mientras llega el audio, en una sola locución continua.

const { Readable } = require('stream');
const applyCors = require('./_cors');

const MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const DEFAULT_VOICE = process.env.OPENAI_TTS_VOICE || 'ash';
const VOICES = ['ash', 'echo', 'onyx', 'verse', 'ballad', 'coral', 'nova', 'shimmer', 'sage', 'alloy'];
const INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS ||
    'Habla en español latinoamericano neutro, con acento latino natural (no de España). ' +
    'Eres un coach personal: tono cálido, cercano, seguro y motivador. ' +
    'Habla con fluidez continua, enlazando las frases de forma natural, sin pausas largas ni cortes entre oraciones. ' +
    'Ritmo conversacional ágil, entonación expresiva y natural; nunca robótico, monótono ni apresurado.';

module.exports = async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Falta la variable de entorno OPENAI_API_KEY' });

    let body = req.method === 'GET' ? (req.query || {}) : req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
    }
    const text = body && typeof body.text === 'string' ? body.text.trim().slice(0, 1500) : '';
    if (!text) return res.status(400).json({ error: 'No hay texto' });
    const voice = VOICES.includes(body.voice) ? body.voice : DEFAULT_VOICE;

    const payload = { model: MODEL, voice, input: text, response_format: 'mp3' };
    // Los modelos tts-1 no aceptan instrucciones de estilo
    if (!MODEL.startsWith('tts-1')) payload.instructions = INSTRUCTIONS;

    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            let message = 'Error de OpenAI';
            try { const data = await response.json(); message = (data.error && data.error.message) || message; } catch {}
            return res.status(502).json({ error: message });
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        // Reenviar el audio a medida que OpenAI lo genera
        Readable.fromWeb(response.body).pipe(res);
    } catch (err) {
        return res.status(500).json({ error: 'No se pudo contactar a OpenAI' });
    }
};
