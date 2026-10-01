const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { logger } = require('./config/logger');
const { corsOptions } = require('./config/cors');
const { enforceHttps, securityHeaders } = require('./middlewares/securityHeadersMiddleware');
const { correlationIdMiddleware, requestLogger } = require('./middlewares/loggerMiddleware');
const { createHealthRouter } = require('./routes/healthRoutes');
const { db } = require('./config/firebase');
const authRoutes = require('./routes/authRoutes');
const routes = require('./routes/expenseRoutes');

const app = express();

// Permite obter o IP real do cliente atrás de proxies reversos (Render, Cloudflare, Firebase)
app.set('trust proxy', 1);

// ── Middlewares de Correlação e Observabilidade ──
app.use(correlationIdMiddleware);
app.use(requestLogger);

// ── Middlewares de Segurança e Parsing ──
app.use(enforceHttps); // Redirecionamento 301 para HTTPS em produção
app.use(securityHeaders); // Injeta cabeçalhos HSTS, Anti-Clickjacking, Anti-Sniffing e oculta X-Powered-By
app.use(cors(corsOptions)); // CORS Estrito: autoriza apenas origens pré-aprovadas
app.use(express.json({ limit: '10mb' })); // Limite para suportar imagens base64

// ── Rotas de Health Check e Diagnóstico da Aplicação ──
app.use(createHealthRouter(db));
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API Gastos Casal rodando 🚀', healthEndpoint: '/health' });
});

// ── Rotas da API ──
app.use('/api/auth', authRoutes);
app.use('/api', routes);

// ── Tratamento Global de Erros de CORS e Requisições Bloqueadas ──
app.use((err, req, res, next) => {
  const log = req.log || logger;
  if (err && (err.code === 'CORS_NOT_ALLOWED' || err.message?.includes('CORS'))) {
    log.warn({ err: err.message, origin: req.headers.origin }, 'Requisição bloqueada por CORS');
    return res.status(403).json({
      error: err.message || 'Origem não permitida pela política de segurança (CORS).',
      code: 'CORS_FORBIDDEN',
    });
  }

  log.error({ err: err.message, stack: err.stack }, 'Exceção não tratada na requisição HTTP');
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, `🚀 Servidor rodando na porta ${PORT}`);
});

