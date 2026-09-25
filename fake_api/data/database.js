const artesaos = [
  {
    id: "a-01",
    name: "Zé Caboclo",
    hub: "Alto do Moura, Caruaru",
    technique: "Cerâmica Figurativa",
    bio: "Terceira geração de ceramistas do Alto do Moura, mantém viva a tradição iniciada por Mestre Vitalino, retratando o cotidiano nordestino em barro.",
    since: 1994,
    photoUrl: "https://picsum.photos/seed/origem-artesao-1/600/700",
    photoAlt: "Ceramista trabalhando argila em torno de oleiro",
    coverUrl: "https://picsum.photos/seed/origem-atelie-1/1600/500",
    coverAlt: "Ateliê de cerâmica figurativa do Alto do Moura",
    email: "artesao@origem.com"
  },
  {
    id: "a-02",
    name: "Dona Analu",
    hub: "Nazaré da Mata",
    technique: "Renda Renascença",
    bio: "Aprendeu a técnica com a avó aos 9 anos e hoje coordena uma cooperativa de rendeiras, mantendo viva a tradição da Zona da Mata.",
    since: 2003,
    photoUrl: "https://picsum.photos/seed/origem-artesao-2/600/700",
    photoAlt: "Rendeira produzindo renda renascença em bastidor de madeira",
    coverUrl: "https://picsum.photos/seed/origem-atelie-2/1600/500",
    coverAlt: "Grupo de rendeiras trabalhando em bastidores de madeira",
    email: "dona-analu@artesaos.origem.com"
  },
  {
    id: "a-03",
    name: "J. Borges Filho",
    hub: "Bezerros",
    technique: "Xilogravura",
    bio: "Herdeiro de uma das famílias mais tradicionais da xilogravura pernambucana, ilustra folhetos de cordel com temas do sertão contemporâneo.",
    since: 1988,
    photoUrl: "https://picsum.photos/seed/origem-artesao-3/600/700",
    photoAlt: "Artesão entalhando matriz de madeira para xilogravura",
    coverUrl: "https://picsum.photos/seed/origem-atelie-3/1600/500",
    coverAlt: "Bancada de trabalho com matrizes de xilogravura",
    email: "j-borges@artesaos.origem.com"
  },
  {
    id: "a-04",
    name: "Marcenaria Irmãos Souza",
    hub: "Garanhuns",
    technique: "Marcenaria",
    bio: "Marcenaria de família especializada em móveis entalhados e peças em palha trançada, usando madeira de reflorestamento certificado.",
    since: 1976,
    photoUrl: "https://picsum.photos/seed/origem-artesao-4/600/700",
    photoAlt: "Marceneiro entalhando peça de madeira em oficina",
    coverUrl: "https://picsum.photos/seed/origem-atelie-4/1600/500",
    coverAlt: "Oficina de marcenaria com móveis de madeira maciça",
    email: "irmaos-souza@artesaos.origem.com"
  },
  {
    id: "a-05",
    name: "Ateliê Barro Vivo",
    hub: "Tracunhaém",
    technique: "Cerâmica Figurativa",
    bio: "Coletivo de ceramistas de Tracunhaém que combina técnicas tradicionais de vitrificação com desenhos contemporâneos.",
    since: 2011,
    photoUrl: "https://picsum.photos/seed/origem-artesao-5/600/700",
    photoAlt: "Ceramista vitrificando peça de barro em ateliê coletivo",
    coverUrl: "https://picsum.photos/seed/origem-atelie-5/1600/500",
    coverAlt: "Prateleiras com vasos de cerâmica vitrificada",
    email: "barro-vivo@artesaos.origem.com"
  },
  {
    id: "a-06",
    name: "Cooperativa Mãos de Renda",
    hub: "Nazaré da Mata",
    technique: "Renda Renascença",
    bio: "Cooperativa que reúne rendeiras de várias gerações, garantindo renda justa e comércio direto com quem compra.",
    since: 2008,
    photoUrl: "https://picsum.photos/seed/origem-artesao-6/600/700",
    photoAlt: "Rendeiras reunidas produzindo peças em renda",
    coverUrl: "https://picsum.photos/seed/origem-atelie-6/1600/500",
    coverAlt: "Mesa de trabalho da cooperativa com peças em renda",
    email: "maos-de-renda@artesaos.origem.com"
  },
  {
    id: "a-07",
    name: "Folheteria Bezerros",
    hub: "Bezerros",
    technique: "Xilogravura",
    bio: "Editora artesanal de cordéis que imprime em prelo tipográfico há mais de trinta anos, unindo xilogravura e literatura popular.",
    since: 1991,
    photoUrl: "https://picsum.photos/seed/origem-artesao-7/600/700",
    photoAlt: "Impressor operando prelo tipográfico para folhetos de cordel",
    coverUrl: "https://picsum.photos/seed/origem-atelie-7/1600/500",
    coverAlt: "Prelo tipográfico e pilhas de folhetos de cordel",
    email: "folheteria-bezerros@artesaos.origem.com"
  }
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