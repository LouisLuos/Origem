const artesaos = [
  { id: 1, nome: "Associação Alto do Moura", localizacao: "Caruaru, PE", especialidade: "Cerâmica" },
  { id: 2, nome: "Mestre Nuca (Oficina)", localizacao: "Tracunhaém, PE", especialidade: "Barro" }
];

const produtos = [
  { id: 101, artesaoId: 1, titulo: "Trio de Forrozeiros em Barro", preco: 120.00, categoria: "Ceramica", destaque: true },
  { id: 102, artesaoId: 1, titulo: "Vaso Rústico", preco: 85.00, categoria: "Ceramica", destaque: false },
  { id: 103, artesaoId: 2, titulo: "Leão Cacheado", preco: 350.00, categoria: "Escultura", destaque: true }
];

module.exports = { artesaos, produtos };