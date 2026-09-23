import type { Product } from '@/design-system/components/ProductCard'

/**
 * Dados de vitrine para desenvolvimento visual do front-end.
 * Substituir por chamadas a `GET /produtos` quando a API estiver disponível
 * (ver RF-CAT-01, RF-CAT-02, RF-CAT-03).
 */
export const featuredProducts: Product[] = [
  {
    id: 'p-01',
    title: 'Boneco de Barro "Casal de Feira"',
    artisan: 'Zé Caboclo',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 189,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-1/800/800',
    imageAlt: 'Par de bonecos de barro pintados representando feirantes, típicos do Alto do Moura',
    description:
      'Dupla de bonecos modelados e pintados à mão no estilo figurativo do Alto do Moura, retratando feirantes do interior de Pernambuco. Cada peça é única: pequenas variações de traço e cor fazem parte da técnica artesanal.',
    details: [
      'Argila crua queimada em forno a lenha',
      'Pintura acrílica fosca, fixada com verniz',
      'Aprox. 18cm de altura cada boneco',
      'Peça decorativa, não recomendada para uso infantil',
    ],
  },
  {
    id: 'p-02',
    title: 'Toalha de Renda Renascença',
    artisan: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    price: 245,
    compareAtPrice: 320,
    imageUrl: 'https://picsum.photos/seed/origem-renda-1/800/800',
    imageAlt: 'Toalha branca de renda renascença com padrões geométricos entrelaçados',
    description:
      'Toalha de mesa em renda renascença 100% algodão, tecida em bastidor com padrões geométricos tradicionais da Zona da Mata pernambucana. Leva cerca de 3 semanas de trabalho manual para ficar pronta.',
    details: [
      'Algodão fio 100, tecido em bastidor de madeira',
      '150cm x 220cm',
      'Lavar à mão com sabão neutro',
      'Cada peça é produzida sob encomenda',
    ],
  },
  {
    id: 'p-03',
    title: 'Xilogravura "Cordel do Boi Voador"',
    artisan: 'J. Borges Filho',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    price: 95,
    imageUrl: 'https://picsum.photos/seed/origem-xilo-1/800/800',
    imageAlt: 'Gravura em preto e branco no estilo xilogravura de cordel, com boi estilizado',
    description:
      'Gravura impressa a partir de matriz de madeira entalhada à mão, inspirada nos folhetos de cordel nordestinos. Tiragem limitada e numerada, impressa em papel canson 300g.',
    details: [
      'Impressão em papel canson 300g, 30cm x 40cm',
      'Tiragem limitada e numerada',
      'Assinada pelo artesão',
      'Vem sem moldura',
    ],
  },
  {
    id: 'p-04',
    title: 'Baú de Madeira Entalhada',
    artisan: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    price: 620,
    imageUrl: 'https://picsum.photos/seed/origem-madeira-1/800/800',
    imageAlt: 'Baú de madeira maciça com entalhes artesanais na tampa',
    description:
      'Baú maciço entalhado à mão pela família Souza, marcenaria tradicional de Garanhuns há três gerações. Ideal como peça de apoio ou baú de guarda-roupa, com dobradiças e fechos em ferro forjado.',
    details: [
      'Madeira de reflorestamento certificada',
      'Dobradiças e fechos em ferro forjado',
      '90cm x 45cm x 40cm (L x P x A)',
      'Acabamento em óleo natural, sem verniz sintético',
    ],
  },
  {
    id: 'p-05',
    title: 'Vaso de Cerâmica Vitrificada Terracota',
    artisan: 'Ateliê Barro Vivo',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    price: 168,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-2/800/800',
    imageAlt: 'Vaso de cerâmica vitrificada em tom terracota com acabamento fosco',
    description:
      'Vaso torneado em roda de oleiro e vitrificado em forno a gás, com acabamento fosco em tom terracota. Peça funcional que também serve como objeto decorativo em qualquer ambiente.',
    details: [
      'Cerâmica vitrificada, resistente à água',
      '22cm de altura x 16cm de diâmetro',
      'Indicada para plantas ou uso decorativo',
      'Base emborrachada antiderrapante',
    ],
  },
  {
    id: 'p-06',
    title: 'Jogo Americano em Renda de Bilro',
    artisan: 'Cooperativa Mãos de Renda',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    price: 78,
    imageUrl: 'https://picsum.photos/seed/origem-renda-2/800/800',
    imageAlt: 'Jogo americano artesanal feito em renda de bilro sobre mesa de madeira',
    description:
      'Conjunto com 4 jogos americanos em renda de bilro, produzido por uma cooperativa de rendeiras de Nazaré da Mata. Renda visualmente rica com fio 100% algodão.',
    details: [
      'Conjunto com 4 unidades, 35cm x 45cm cada',
      'Algodão fio 100',
      'Lavar à mão, não usar alvejante',
      'Renda passa por controle de qualidade da cooperativa',
    ],
  },
  {
    id: 'p-07',
    title: 'Cordel Ilustrado "A Origem do Barro"',
    artisan: 'Folheteria Bezerros',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    price: 42,
    imageUrl: 'https://picsum.photos/seed/origem-xilo-2/800/800',
    imageAlt: 'Capa de livro de cordel ilustrada com xilogravura tradicional',
    description:
      'Folheto de cordel com capa ilustrada em xilogravura, contando em versos a história da cerâmica do Alto do Moura. Impressão artesanal em prelo tipográfico.',
    details: [
      '16 páginas, formato 11cm x 16cm',
      'Capa em xilogravura, miolo tipográfico',
      'Papel jornal reciclado',
      'Edição da Folheteria Bezerros',
    ],
  },
  {
    id: 'p-08',
    title: 'Cadeira de Palha Trançada',
    artisan: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    price: 340,
    compareAtPrice: 410,
    imageUrl: 'https://picsum.photos/seed/origem-madeira-2/800/800',
    imageAlt: 'Cadeira artesanal de madeira com assento de palha trançada',
    description:
      'Cadeira de armação em madeira maciça com assento e encosto em palha trançada à mão, técnica passada entre gerações na marcenaria da família Souza.',
    details: [
      'Armação em madeira de reflorestamento',
      'Assento e encosto em palha natural trançada',
      'Suporta até 120kg',
      'Montagem simples incluída no manual',
    ],
  },
]

export const secondaryProducts: Product[] = [
  {
    id: 'p-09',
    title: 'Panela de Barro para Cozido',
    artisan: 'Zé Caboclo',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 112,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-3/800/800',
    imageAlt: 'Panela de barro tradicional usada para cozidos nordestinos',
    description:
      'Panela de barro modelada à mão, própria para cozidos em fogo baixo. Distribui o calor de forma uniforme e realça o sabor dos temperos nordestinos.',
    details: [
      'Argila crua, queima tradicional em forno a lenha',
      'Capacidade de 2 litros',
      'Vedar com água antes do primeiro uso',
      'Não indicada para fogo alto ou choque térmico',
    ],
  },
  {
    id: 'p-10',
    title: 'Bolsa de Renda Renascença Forrada',
    artisan: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    price: 156,
    imageUrl: 'https://picsum.photos/seed/origem-renda-3/800/800',
    imageAlt: 'Bolsa artesanal forrada com detalhes em renda renascença',
    description:
      'Bolsa de tecido forrada em algodão, com painel frontal em renda renascença feito à mão. Alça reforçada e fechamento em botão de madeira.',
    details: [
      'Forro 100% algodão, painel em renda renascença',
      '30cm x 25cm x 10cm',
      'Alça de ombro ajustável',
      'Fechamento em botão de madeira',
    ],
  },
]

export const allProducts: Product[] = [...featuredProducts, ...secondaryProducts]
