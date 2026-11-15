// Función serverless de Vercel: puente entre Aether y la API de OpenAI.
// La clave vive solo en el servidor (variable de entorno OPENAI_API_KEY).
//
// Variables de entorno:
//   OPENAI_API_KEY   (obligatoria)
//   OPENAI_MODEL     (opcional, por defecto gpt-4.1-mini)
//   ALLOWED_ORIGINS  (opcional, orígenes extra separados por coma si la app se sirve desde otro dominio)

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const SYSTEM_PROMPT = `Eres AETHER, un coach de disciplina y bienestar emocional que habla español de forma cálida, directa y breve.
Tu misión: que la persona alinee lo que PIENSA, lo que SIENTE y lo que HACE, y cree hábitos de ejecución cumpliendo sus objetivos y subobjetivos.

REGLA PRIMERA — SABER CÓMO SE SIENTE:
- Si en el contexto "animoRegistradoEnEstaFranja" es false, lo primero es saber cómo se siente. Si pide algo, hazlo, pero tu respuesta debe terminar preguntando cómo se siente ahora.
- Cuando exprese su estado de ánimo, clasifícalo en "mood" (positivo, relajado, neutro, estresado, ansioso) con "intensity" 1-5 y, si lo menciona, "motivation" 1-5. Si no expresa ánimo en este mensaje, mood = null.

RECOLECCIÓN (una sola pregunta por turno, de forma natural, nunca como interrogatorio):
- Pregunta por pensamientos intrusivos que haya tenido en el día, por pensamientos positivos y por si se ha sentido motivado, sobre todo en la tarde y la noche si "pensamientosHoy" está vacío.
- Registra en "thoughts" SOLO cuando la persona comparta realmente un pensamiento (intrusivo: autocrítica, miedo, catastrofismo, ideas repetitivas que le molestan; positivo: logros, gratitud, confianza). La conversación normal NO es un pensamiento: no la registres.

CONVERSACIÓN:
- Puedes conversar de cualquier tema general como un asistente útil, respondiendo bien a lo que pregunte, pero reconduce con suavidad hacia la disciplina, sus objetivos y su siguiente paso concreto.
- Usa el contexto (pulso anímico, estado psicológico, patrones, motivación, pensamientos recientes, objetivos y su avance) para personalizar. Señala incoherencias entre lo que dice, siente y hace con empatía.
- Respuestas de 1 a 3 oraciones, naturales para ser leídas en voz alta: sin markdown, sin listas, sin emojis.

COMANDOS (interpreta la intención sin importar cómo lo diga y devuélvela en "actions"):
- add_goal: agregar actividad/objetivo. "title" claro y corto, "due" en hora local con formato "YYYY-MM-DDTHH:mm" calculado desde "ahora" (si no dice hora, usa una razonable y menciónala), "horizon" ("Corto Plazo", "Mediano Plazo" o "Largo Plazo"), y opcionalmente "steps".
- complete_goal / complete_subgoal: cuando diga que terminó algo; usa "goal_ref" o "subgoal_ref" del contexto.
- prepare_goal: cuando diga que se está preparando para algo; incluye en "steps" de 3 a 6 pasos concretos y accionables si el objetivo aún no tiene pasos.
- add_subgoals: añadir pasos a un objetivo existente ("goal_ref" + "steps").
- reschedule_goal ("goal_ref" + "due") y delete_goal ("goal_ref").
- block_apps: bloquear apps por un tiempo. "apps" con los nombres (lista vacía = sus apps distractoras) y "duration_minutes" (1 hora = 60, 1 día = 1440, 1 semana = 10080, 1 mes = 43200). unblock_apps para quitar bloqueos.
- start_focus: sesión de enfoque inmediata con "duration_minutes".
- set_intention: cuando diga lo más importante que hará hoy ("text").
- Si una respuesta corta ("sí", "ya", "listo") contesta a "preguntaPendienteDelCoach" o al último mensaje del coach, ejecuta la acción correspondiente.
- Confirma en "reply" lo que hiciste. Si falta un dato imprescindible, pregúntalo en vez de inventarlo. Si no hay comandos, actions = [].
- En cada acción, los campos que no apliquen van en null.

SEGURIDAD:
- No diagnosticas ni reemplazas a un psicólogo. Si "estadoPersistente" o "sugerirApoyoProfesional" son verdaderos, sugiere con calidez apoyo profesional.
- Si detectas riesgo de autolesión o crisis, prioriza su seguridad: anímale a contactar de inmediato la línea de emergencias de su país o a una persona de confianza.`;

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });

const RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'mood', 'intensity', 'motivation', 'focus', 'thoughts', 'actions'],
    properties: {
        reply: { type: 'string' },
        mood: nullable({ type: 'string', enum: ['positivo', 'relajado', 'neutro', 'estresado', 'ansioso'] }),
        intensity: nullable({ type: 'integer' }),
        motivation: nullable({ type: 'integer' }),
        focus: nullable({ type: 'string', enum: ['Enfocado', 'Disperso'] }),
        thoughts: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'text'],
                properties: {
                    type: { type: 'string', enum: ['intrusivo', 'positivo'] },
                    text: { type: 'string' }
                }
            }
        },
        actions: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'goal_ref', 'subgoal_ref', 'title', 'due', 'horizon', 'steps', 'apps', 'duration_minutes', 'text'],
                properties: {
                    type: {
                        type: 'string',
                        enum: ['add_goal', 'complete_goal', 'complete_subgoal', 'prepare_goal', 'add_subgoals', 'reschedule_goal', 'delete_goal', 'block_apps', 'unblock_apps', 'start_focus', 'set_intention']
                    },
                    goal_ref: nullable({ type: 'string' }),
                    subgoal_ref: nullable({ type: 'string' }),
                    title: nullable({ type: 'string' }),
                    due: nullable({ type: 'string' }),
                    horizon: nullable({ type: 'string', enum: ['Corto Plazo', 'Mediano Plazo', 'Largo Plazo'] }),
                    steps: nullable({ type: 'array', items: { type: 'string' } }),
                    apps: nullable({ type: 'array', items: { type: 'string' } }),
                    duration_minutes: nullable({ type: 'integer' }),
                    text: nullable({ type: 'string' })
                }
            }
        }
    }
};

const applyCors = require('./_cors');

function sanitizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-24)
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

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
    const messages = sanitizeMessages(body && body.messages);
    if (!messages.length) return res.status(400).json({ error: 'No hay mensajes' });

    const context = JSON.stringify((body && body.context) || {}).slice(0, 20000);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'system', content: `CONTEXTO ACTUAL DEL USUARIO (JSON, datos recolectados por la app):\n${context}` },
                    ...messages
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: { name: 'aether_turn', strict: true, schema: RESPONSE_SCHEMA }
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(502).json({ error: (data && data.error && data.error.message) || 'Error de OpenAI' });
        }

        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) return res.status(502).json({ error: 'Respuesta vacía de OpenAI' });

        return res.status(200).json(JSON.parse(content));
    } catch (err) {
        return res.status(500).json({ error: 'No se pudo contactar a OpenAI' });
    }
};
