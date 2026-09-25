const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

// Define as rotas usando os controladores
router.get('/', produtoController.getProdutos);
router.get('/:id', produtoController.getProdutoById);

module.exports = router;