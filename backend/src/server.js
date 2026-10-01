const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { corsOptions } = require('./config/cors');
const { enforceHttps, securityHeaders } = require('./middlewares/securityHeadersMiddleware');
const authRoutes = require('./routes/authRoutes');
const routes = require('./routes/expenseRoutes');

const app = express();

// Permite obter o IP real do cliente atrás de proxies reversos (Render, Cloudflare, Firebase)
app.set('trust proxy', 1);

// ── Middlewares de Segurança e Parsing ──
app.use(enforceHttps); // Redirecionamento 301 para HTTPS em produção
app.use(securityHeaders); // Injeta cabeçalhos HSTS, Anti-Clickjacking, Anti-Sniffing e oculta X-Powered-By
app.use(cors(corsOptions)); // CORS Estrito: autoriza apenas origens pré-aprovadas
app.use(express.json({ limit: '10mb' })); // Limite para suportar imagens base64

// ── Rotas da API ──
app.use('/api/auth', authRoutes);
app.use('/api', routes);

// ── Health check (Render usa isso para saber se o servidor está de pé) ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API Gastos Casal rodando 🚀' });
});

// ── Tratamento Global de Erros de CORS e Requisições Bloqueadas ──
app.use((err, req, res, next) => {
  if (err && (err.code === 'CORS_NOT_ALLOWED' || err.message?.includes('CORS'))) {
    return res.status(403).json({
      error: err.message || 'Origem não permitida pela política de segurança (CORS).',
      code: 'CORS_FORBIDDEN',
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
