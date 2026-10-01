require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Origens padrão autorizadas
const DEFAULT_ORIGINS = [
  'https://gastos-casal-26c77.web.app',
  'https://gastos-casal-26c77.firebaseapp.com',
];

// Origens de desenvolvimento local (apenas fora de produção)
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
];

/**
 * Obtém a lista de origens autorizadas a partir do ambiente ou padrões seguros.
 */
function getAllowedOrigins() {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  return isProduction
    ? [...DEFAULT_ORIGINS]
    : [...DEFAULT_ORIGINS, ...DEV_ORIGINS];
}

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();

    // Permite chamadas sem header Origin (health check interno do Render, same-origin, curl local)
    if (!origin) {
      return callback(null, true);
    }

    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error(`Acesso bloqueado por política de CORS: origem '${origin}' não autorizada.`);
    error.status = 403;
    error.code = 'CORS_NOT_ALLOWED';
    return callback(error);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 horas de cache para preflight (OPTIONS)
};

module.exports = {
  corsOptions,
  getAllowedOrigins,
};
