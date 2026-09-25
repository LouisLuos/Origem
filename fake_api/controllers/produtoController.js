const db = require('../data/database');

exports.getProdutos = async (req, res) => {

    const { categoria, technique, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Number.parseInt(limit, 10) || 10);
    
    let resultado = db.produtos;

    // Aceita os dois nomes para facilitar a transição do contrato antigo.
    const filtroTecnica = technique || categoria;
    if (filtroTecnica) {
        resultado = resultado.filter(p => p.technique.toLowerCase() === filtroTecnica.toLowerCase());
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = currentPage * pageSize;
    const produtosPaginados = resultado.slice(startIndex, endIndex);

    res.status(200).json({
        dados: produtosPaginados,
        meta: {
            totalItens: resultado.length,
            paginaAtual: currentPage,
            totalPaginas: Math.ceil(resultado.length / pageSize)
        }
    });
};

exports.getProdutoById = async (req, res) => {
    const produto = db.produtos.find(p => p.id === req.params.id);

    if (!produto) {
        return res.status(404).json({ erro: "Produto não encontrado." });
    }
    res.status(200).json(produto);
};

exports.createProduto = async (req, res) => {
    const requiredFields = ["title", "artisan", "hub", "technique", "price", "imageUrl", "imageAlt", "ownerEmail", "stock"];
    const missingField = requiredFields.find((field) => req.body[field] === undefined);

    if (missingField) {
        return res.status(400).json({ erro: `Campo obrigatório: ${missingField}.` });
    }

    const produto = {
        ...req.body,
        id: `api-${Date.now().toString(36)}`,
        price: Number(req.body.price),
        stock: Number(req.body.stock),
        active: req.body.active ?? true
    };

    db.produtos.unshift(produto);
    res.status(201).json(produto);
};

exports.updateProduto = async (req, res) => {
    const index = db.produtos.findIndex((produto) => produto.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ erro: "Produto não encontrado." });
    }

    const produto = {
        ...db.produtos[index],
        ...req.body,
        id: db.produtos[index].id
    };
    db.produtos[index] = produto;
    res.status(200).json(produto);
};

exports.deleteProduto = async (req, res) => {
    const index = db.produtos.findIndex((produto) => produto.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ erro: "Produto não encontrado." });
    }

    db.produtos.splice(index, 1);
    res.status(204).send();
};

exports.reserveStock = async (req, res) => {
    const lines = req.body.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ erro: "Informe ao menos uma linha de reserva." });
    }

    for (const line of lines) {
        const produto = db.produtos.find((item) => item.id === line.productId);
        if (!produto || !produto.active) {
            return res.status(409).json({ erro: "Uma das peças do pedido não está mais disponível." });
        }
        if (produto.stock < Number(line.quantity)) {
            return res.status(409).json({ erro: `Estoque insuficiente para ${produto.title}.` });
        }
    }

    for (const line of lines) {
        const produto = db.produtos.find((item) => item.id === line.productId);
        produto.stock -= Number(line.quantity);
    }

    res.status(200).json({ dados: db.produtos });
};