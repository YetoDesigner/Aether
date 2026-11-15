// Función serverless de Vercel: convierte texto en voz con OpenAI.
//
// Variables de entorno:
//   OPENAI_API_KEY            (obligatoria)
//   OPENAI_TTS_MODEL          (opcional, por defecto gpt-4o-mini-tts: económico y admite instrucciones de estilo)
//   OPENAI_TTS_VOICE          (opcional, voz por defecto: coral)
//   OPENAI_TTS_INSTRUCTIONS   (opcional, reemplaza las instrucciones de acento y tono)

const applyCors = require('./_cors');

const MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const DEFAULT_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
const VOICES = ['coral', 'nova', 'shimmer', 'sage', 'ballad', 'ash', 'echo', 'onyx', 'verse', 'alloy'];
const INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS ||
    'Habla en español latinoamericano neutro, con acento latino natural (no de España). ' +
    'Tono cálido, cercano y seguro, como un coach personal que acompaña. ' +
    'Ritmo fluido y conversacional, con pausas naturales y entonación expresiva; nunca robótico ni apresurado.';

module.exports = async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Falta la variable de entorno OPENAI_API_KEY' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
    }
    const text = body && typeof body.text === 'string' ? body.text.trim().slice(0, 1200) : '';
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
        const audio = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(audio);
    } catch (err) {
        return res.status(500).json({ error: 'No se pudo contactar a OpenAI' });
    }
};
