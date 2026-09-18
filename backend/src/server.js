const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes/expenseRoutes');

const app = express();

// ── Middlewares ──
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Render health-check, same-origin)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
})); // Permite requisições do Frontend autorizado
app.use(express.json({ limit: '10mb' })); // Limite aumentado para suportar imagens base64

// ── Rotas da API ──
app.use('/api', routes);

// ── Health check (Render usa isso para saber se o servidor está de pé) ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API Gastos Casal rodando 🚀' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
