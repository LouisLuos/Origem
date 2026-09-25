const express = require('express');
const cors = require('cors');
const produtoRoutes = require('./routes/produtoRoutes');
const artesaoRoutes = require('./routes/artesaoRoutes');
const produtoController = require('./controllers/produtoController');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json());

// Registrar as rotas (Prefixando com /api/v1)
app.use('/api/v1/produtos', produtoRoutes);
app.use('/api/v1/artesaos', artesaoRoutes);
app.post('/api/v1/estoque/reservas', produtoController.reserveStock);

// Tratamento para rotas inexistentes
app.use((req, res) => {
    res.status(404).json({ erro: "Endpoint não encontrado nesta Fake API." });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/api/v1/`);
});