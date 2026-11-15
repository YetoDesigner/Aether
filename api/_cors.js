// Utilidad compartida (los archivos que empiezan con "_" no se publican como rutas en Vercel).
// ALLOWED_ORIGINS: orígenes extra separados por coma si la app se sirve desde otro dominio.
module.exports = function applyCors(req, res) {
    const origin = req.headers.origin;
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
};
