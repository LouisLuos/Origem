const artesaos = [
  { id: "artisan-1", nome: "Associação Alto do Moura", email: "alto-do-moura@artesaos.origem.com", localizacao: "Caruaru, PE", especialidade: "Cerâmica" },
  { id: "artisan-2", nome: "Mestre Nuca (Oficina)", email: "mestre-nuca@artesaos.origem.com", localizacao: "Tracunhaém, PE", especialidade: "Barro" }
];

const produtos = [
  {
    id: "api-101",
    title: "Trio de Forrozeiros em Barro",
    artisan: "Associação Alto do Moura",
    hub: "Alto do Moura",
    technique: "Cerâmica Figurativa",
    price: 120.00,
    imageUrl: "https://picsum.photos/seed/api-101/800/800",
    imageAlt: "Trio de forrozeiros modelados em barro",
    description: "Peça artesanal modelada e pintada à mão no Alto do Moura.",
    details: ["Argila queimada em forno artesanal", "Peça decorativa"],
    ownerEmail: "alto-do-moura@artesaos.origem.com",
    stock: 8,
    active: true
  },
  {
    id: "api-102",
    title: "Vaso Rústico",
    artisan: "Associação Alto do Moura",
    hub: "Alto do Moura",
    technique: "Cerâmica Figurativa",
    price: 85.00,
    imageUrl: "https://picsum.photos/seed/api-102/800/800",
    imageAlt: "Vaso rústico de cerâmica",
    description: "Vaso de cerâmica com acabamento rústico artesanal.",
    details: ["Cerâmica artesanal", "Peça decorativa"],
    ownerEmail: "alto-do-moura@artesaos.origem.com",
    stock: 5,
    active: true
  },
  {
    id: "api-103",
    title: "Leão Cacheado",
    artisan: "Mestre Nuca (Oficina)",
    hub: "Tracunhaém",
    technique: "Escultura",
    price: 350.00,
    imageUrl: "https://picsum.photos/seed/api-103/800/800",
    imageAlt: "Escultura artesanal de leão em barro",
    description: "Escultura de barro inspirada na tradição de Tracunhaém.",
    details: ["Modelagem manual", "Peça única"],
    ownerEmail: "mestre-nuca@artesaos.origem.com",
    stock: 3,
    active: true
  }
];

module.exports = { artesaos, produtos };