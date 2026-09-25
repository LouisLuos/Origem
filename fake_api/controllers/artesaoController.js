const db = require('../data/database');

function matches(value, query) {
  return value.toLowerCase().includes(query.toLowerCase());
}

exports.getArtesaos = (req, res) => {
  const { q, nome, hub, technique, page = 1, limit = 20 } = req.query;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Number.parseInt(limit, 10) || 20);
  const search = q || nome;

  let resultado = db.artesaos;
  if (search) {
    resultado = resultado.filter((artesao) =>
      [artesao.name, artesao.hub, artesao.technique].some((field) => matches(field, search)),
    );
  }
  if (hub) resultado = resultado.filter((artesao) => matches(artesao.hub, hub));
  if (technique) resultado = resultado.filter((artesao) => matches(artesao.technique, technique));

  const startIndex = (currentPage - 1) * pageSize;
  const dados = resultado.slice(startIndex, startIndex + pageSize);

  res.status(200).json({
    dados,
    meta: {
      totalItens: resultado.length,
      paginaAtual: currentPage,
      totalPaginas: Math.ceil(resultado.length / pageSize),
    },
  });
};

exports.getArtesaoById = (req, res) => {
  const artesao = db.artesaos.find((item) => item.id === req.params.id);
  if (!artesao) return res.status(404).json({ erro: 'Artesão não encontrado.' });
  res.status(200).json(artesao);
};

exports.createArtesao = (req, res) => {
  const requiredFields = ['name', 'hub', 'technique', 'bio', 'since', 'photoUrl', 'photoAlt', 'coverUrl', 'coverAlt'];
  const missingField = requiredFields.find((field) => req.body[field] === undefined);
  if (missingField) return res.status(400).json({ erro: `Campo obrigatório: ${missingField}.` });

  const normalizedEmail = req.body.email?.trim().toLowerCase();
  if (normalizedEmail && db.artesaos.some((item) => item.email === normalizedEmail)) {
    return res.status(409).json({ erro: 'Já existe um artesão com este e-mail.' });
  }

  const artesao = {
    ...req.body,
    id: `a-${Date.now().toString(36)}`,
    since: Number(req.body.since),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
  };
  db.artesaos.unshift(artesao);
  res.status(201).json(artesao);
};