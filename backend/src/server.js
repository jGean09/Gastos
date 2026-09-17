const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes/expenseRoutes');

const app = express();

// ── Middlewares ──
app.use(cors()); // Permite requisições do Frontend (Vercel)
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
