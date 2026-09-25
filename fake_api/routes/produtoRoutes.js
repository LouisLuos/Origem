const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

// Define as rotas usando os controladores
router.get('/', produtoController.getProdutos);
router.post('/', produtoController.createProduto);
router.get('/:id', produtoController.getProdutoById);
router.patch('/:id', produtoController.updateProduto);
router.delete('/:id', produtoController.deleteProduto);

module.exports = router;