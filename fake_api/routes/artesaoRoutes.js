const express = require('express');
const artesaoController = require('../controllers/artesaoController');

const router = express.Router();

router.get('/', artesaoController.getArtesaos);
router.post('/', artesaoController.createArtesao);
router.get('/:id', artesaoController.getArtesaoById);

module.exports = router;