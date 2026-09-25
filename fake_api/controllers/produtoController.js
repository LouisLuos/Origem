const db = require('../data/database');

// Simulador de atraso (ex: 800ms)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.getProdutos = async (req, res) => {
    await delay(800); // Simula lentidão da rede

    // Extrai parâmetros da URL (ex: ?categoria=ceramica&page=1)
    const { categoria, page = 1, limit = 10 } = req.query;
    
    let resultado = db.produtos;

    // Aplica filtro de categoria se existir
    if (categoria) {
        resultado = resultado.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase());
    }

    // Lógica de Paginação Mockada
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const produtosPaginados = resultado.slice(startIndex, endIndex);

    // Retorna um JSON estruturado com metadados
    res.status(200).json({
        dados: produtosPaginados,
        meta: {
            totalItens: resultado.length,
            paginaAtual: parseInt(page),
            totalPaginas: Math.ceil(resultado.length / limit)
        }
    });
};

exports.getProdutoById = async (req, res) => {
    await delay(500);
    const produto = db.produtos.find(p => p.id === parseInt(req.params.id));

    if (!produto) {
        return res.status(404).json({ erro: "Produto não encontrado." });
    }
    res.status(200).json(produto);
};