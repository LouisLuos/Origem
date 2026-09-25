const express = require('express');
const cors = require('cors');
const produtoRoutes = require('./routes/produtoRoutes');
const produtoController = require('./controllers/produtoController');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json()); // Permite ler JSON no corpo das requisições (POST/PUT)

// Registrar as rotas (Prefixando com /api/v1)
app.use('/api/v1/produtos', produtoRoutes);
app.post('/api/v1/estoque/reservas', produtoController.reserveStock);

// Tratamento para rotas inexistentes
app.use((req, res) => {
    res.status(404).json({ erro: "Endpoint não encontrado nesta Fake API." });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Fake API rodando em http://localhost:${PORT}/api/v1/`);
});