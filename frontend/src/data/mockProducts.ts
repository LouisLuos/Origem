import type { Product } from '@/design-system/components/ProductCard'

/**
 * Dados de vitrine para desenvolvimento visual do front-end.
 * Substituir por chamadas a `GET /produtos` quando a API estiver disponível
 * (ver RF-CAT-01, RF-CAT-02, RF-CAT-03).
 */
export const featuredProducts: Product[] = [
  {
    id: 'p-01',
    title: 'Boneco de Barro — Casal de Feira',
    artisan: 'Zé Caboclo',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 189,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-1/800/800',
    imageAlt: 'Par de bonecos de barro pintados representando feirantes, típicos do Alto do Moura',
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
  },
]
