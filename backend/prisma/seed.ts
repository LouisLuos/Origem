import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, UserRole } from '@prisma/client'

export interface SeedArtisanRecord {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  since: number
  photoUrl: string
  photoAlt: string
  coverUrl: string
  coverAlt: string
  email: string
  phone?: string
  workshopAddress?: string
  publicContactConsent: boolean
}

export interface SeedProductRecord {
  id: string
  title: string
  artisanId: string | null
  artisanName: string
  hub: string
  technique: string
  price: number
  compareAtPrice?: number
  imageUrl: string
  imageAlt: string
  description: string
  details: string[]
  ownerEmail: string
  stock: number
  active: boolean
}

export interface SeedReviewRecord {
  id: string
  name: string
  location: string
  quote: string
  rating: number
  avatarUrl: string
  avatarAlt: string
}

export const SEED_ARTISANS: SeedArtisanRecord[] = [
  {
    id: 'a-01',
    name: 'Zé Caboclo',
    hub: 'Alto do Moura, Caruaru',
    technique: 'Cerâmica Figurativa',
    bio: 'Terceira geração de ceramistas do Alto do Moura, mantém viva a tradição iniciada por Mestre Vitalino, retratando o cotidiano nordestino em barro.',
    since: 1994,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-1/600/700',
    photoAlt: 'Ceramista trabalhando argila em torno de oleiro',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-1/1600/500',
    coverAlt: 'Ateliê de cerâmica figurativa do Alto do Moura',
    email: 'artesao@origem.com',
    workshopAddress: 'Rua Mestre Vitalino, Alto do Moura, Caruaru - PE',
    publicContactConsent: false,
  },
  {
    id: 'a-02',
    name: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    bio: 'Aprendeu a técnica com a avó aos 9 anos e hoje coordena uma cooperativa de rendeiras, mantendo viva a tradição da Zona da Mata.',
    since: 2003,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-2/600/700',
    photoAlt: 'Rendeira produzindo renda renascença em bastidor de madeira',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-2/1600/500',
    coverAlt: 'Grupo de rendeiras trabalhando em bastidores de madeira',
    email: 'dona-analu@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-03',
    name: 'J. Borges Filho',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    bio: 'Herdeiro de uma das famílias mais tradicionais da xilogravura pernambucana, ilustra folhetos de cordel com temas do sertão contemporâneo.',
    since: 1988,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-3/600/700',
    photoAlt: 'Artesão entalhando matriz de madeira para xilogravura',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-3/1600/500',
    coverAlt: 'Bancada de trabalho com matrizes de xilogravura',
    email: 'j-borges@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-04',
    name: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    bio: 'Marcenaria de família especializada em móveis entalhados e peças em palha trançada, usando madeira de reflorestamento certificado.',
    since: 1976,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-4/600/700',
    photoAlt: 'Marceneiro entalhando peça de madeira em oficina',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-4/1600/500',
    coverAlt: 'Oficina de marcenaria com móveis de madeira maciça',
    email: 'irmaos-souza@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-05',
    name: 'Ateliê Barro Vivo',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    bio: 'Coletivo de ceramistas de Tracunhaém que combina técnicas tradicionais de vitrificação com desenhos contemporâneos.',
    since: 2011,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-5/600/700',
    photoAlt: 'Ceramista vitrificando peça de barro em ateliê coletivo',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-5/1600/500',
    coverAlt: 'Prateleiras com vasos de cerâmica vitrificada',
    email: 'barro-vivo@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-06',
    name: 'Cooperativa Mãos de Renda',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    bio: 'Cooperativa que reúne rendeiras de várias gerações, garantindo renda justa e comércio direto com quem compra.',
    since: 2008,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-6/600/700',
    photoAlt: 'Rendeiras reunidas produzindo peças em renda',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-6/1600/500',
    coverAlt: 'Mesa de trabalho da cooperativa com peças em renda',
    email: 'maos-de-renda@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-07',
    name: 'Folheteria Bezerros',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    bio: 'Editora artesanal de cordéis que imprime em prelo tipográfico há mais de trinta anos, unindo xilogravura e literatura popular.',
    since: 1991,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-7/600/700',
    photoAlt: 'Impressor operando prelo tipográfico para folhetos de cordel',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-7/1600/500',
    coverAlt: 'Prelo tipográfico e pilhas de folhetos de cordel',
    email: 'folheteria-bezerros@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-08',
    name: 'Oficina Carrancas do São Francisco',
    hub: 'Petrolina',
    technique: 'Escultura',
    bio: 'Oficina ribeirinha dedicada à escultura de carrancas em madeira e barro, preservando a iconografia protetora das embarcações do Rio São Francisco.',
    since: 1985,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-8/600/700',
    photoAlt: 'Escultor finalizando pintura de carranca tradicional em Petrolina',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-8/1600/500',
    coverAlt: 'Ateliê às margens do Rio São Francisco com esculturas de carrancas',
    email: 'carrancas-petrolina@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-09',
    name: 'Associação Renda de Pesqueira',
    hub: 'Pesqueira',
    technique: 'Renda Renascença',
    bio: 'Grupo tradicional de artesãs do Agreste pernambucano reconhecido nacionalmente pela delicadeza dos pontos de renda renascença.',
    since: 1999,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-9/600/700',
    photoAlt: 'Mãos de artesã tecendo pontos delicados de renda renascença em Pesqueira',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-9/1600/500',
    coverAlt: 'Exposição de toalhas e peças de renda renascença em Pesqueira',
    email: 'renda-pesqueira@artesaos.origem.com',
    publicContactConsent: false,
  },
  {
    id: 'a-10',
    name: 'Ateliê Ladeira da Sé',
    hub: 'Olinda',
    technique: 'Tapeçaria',
    bio: 'Coletivo artístico do Sítio Histórico de Olinda que produz tapeçarias manuais inspiradas nas cores do frevo, maracatu e casario colonial.',
    since: 2006,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-10/600/700',
    photoAlt: 'Artesã trabalhando em tear vertical colorido no centro histórico de Olinda',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-10/1600/500',
    coverAlt: 'Ateliê com tapeçarias vibrantes penduradas em parede caiada de Olinda',
    email: 'ladeira-olinda@artesaos.origem.com',
    publicContactConsent: false,
  },
]

export const SEED_PRODUCTS: SeedProductRecord[] = [
  // Contratos originais da Fake API (IDs api-101 a api-103 preservados integralmente)
  {
    id: 'api-101',
    title: 'Trio de Forrozeiros em Barro',
    artisanId: 'a-01',
    artisanName: 'Associação Alto do Moura',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 120.0,
    imageUrl: 'https://picsum.photos/seed/api-101/800/800',
    imageAlt: 'Trio de forrozeiros modelados em barro',
    description: 'Peça artesanal modelada e pintada à mão no Alto do Moura.',
    details: ['Argila queimada em forno artesanal', 'Peça decorativa'],
    ownerEmail: 'alto-do-moura@artesaos.origem.com',
    stock: 8,
    active: true,
  },
  {
    id: 'api-102',
    title: 'Vaso Rústico',
    artisanId: 'a-01',
    artisanName: 'Associação Alto do Moura',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 85.0,
    imageUrl: 'https://picsum.photos/seed/api-102/800/800',
    imageAlt: 'Vaso rústico de cerâmica',
    description: 'Vaso de cerâmica com acabamento rústico artesanal.',
    details: ['Cerâmica artesanal', 'Peça decorativa'],
    ownerEmail: 'alto-do-moura@artesaos.origem.com',
    stock: 5,
    active: true,
  },
  {
    id: 'api-103',
    title: 'Leão Cacheado',
    artisanId: 'a-05',
    artisanName: 'Mestre Nuca (Oficina)',
    hub: 'Tracunhaém',
    technique: 'Escultura',
    price: 350.0,
    imageUrl: 'https://picsum.photos/seed/api-103/800/800',
    imageAlt: 'Escultura artesanal de leão em barro',
    description: 'Escultura de barro inspirada na tradição de Tracunhaém.',
    details: ['Modelagem manual', 'Peça única'],
    ownerEmail: 'mestre-nuca@artesaos.origem.com',
    stock: 3,
    active: true,
  },
  // Acervo expandido da vitrine Origem (p-01 a p-12)
  {
    id: 'p-01',
    title: 'Boneco de Barro — Casal de Feira',
    artisanId: 'a-01',
    artisanName: 'Zé Caboclo',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 189.0,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-1/800/800',
    imageAlt: 'Par de bonecos de barro pintados representando feirantes, típicos do Alto do Moura',
    description: 'Casal de feirantes esculpido em barro massapê e colorido com pigmentos naturais.',
    details: ['Altura aproximada: 24 cm', 'Assinado pelo mestre artesão'],
    ownerEmail: 'artesao@origem.com',
    stock: 6,
    active: true,
  },
  {
    id: 'p-02',
    title: 'Toalha de Renda Renascença',
    artisanId: 'a-02',
    artisanName: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    price: 245.0,
    compareAtPrice: 320.0,
    imageUrl: 'https://picsum.photos/seed/origem-renda-1/800/800',
    imageAlt: 'Toalha branca de renda renascença com padrões geométricos entrelaçados',
    description: 'Toalha de bandeja tecida com linha 100% algodão mercerizado e lacê tradicional.',
    details: ['100% algodão mercerizado', 'Tempo de produção: 18 dias'],
    ownerEmail: 'dona-analu@artesaos.origem.com',
    stock: 4,
    active: true,
  },
  {
    id: 'p-03',
    title: 'Xilogravura "Cordel do Boi Voador"',
    artisanId: 'a-03',
    artisanName: 'J. Borges Filho',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    price: 95.0,
    imageUrl: 'https://picsum.photos/seed/origem-xilo-1/800/800',
    imageAlt: 'Gravura em preto e branco no estilo xilogravura de cordel, com boi estilizado',
    description: 'Impressão manual a partir de matriz entalhada em madeira umburana sobre papel pólen.',
    details: ['Formato A3 (29,7 x 42 cm)', 'Tiragem numerada e assinada'],
    ownerEmail: 'j-borges@artesaos.origem.com',
    stock: 12,
    active: true,
  },
  {
    id: 'p-04',
    title: 'Baú de Madeira Entalhada',
    artisanId: 'a-04',
    artisanName: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    price: 620.0,
    imageUrl: 'https://picsum.photos/seed/origem-madeira-1/800/800',
    imageAlt: 'Baú de madeira maciça com entalhes artesanais na tampa',
    description: 'Baú utilitário e decorativo entalhado à mão em madeira de manejo sustentável.',
    details: ['Madeira certificada', 'Acabamento em cera de carnaúba'],
    ownerEmail: 'irmaos-souza@artesaos.origem.com',
    stock: 2,
    active: true,
  },
  {
    id: 'p-05',
    title: 'Vaso de Cerâmica Vitrificada Terracota',
    artisanId: 'a-05',
    artisanName: 'Ateliê Barro Vivo',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    price: 168.0,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-2/800/800',
    imageAlt: 'Vaso de cerâmica vitrificada em tom terracota com acabamento fosco',
    description: 'Vaso torneado manualmente em argila vermelha de Tracunhaém com queima de alta temperatura.',
    details: ['Impermeabilizado internamente', 'Altura: 28 cm'],
    ownerEmail: 'barro-vivo@artesaos.origem.com',
    stock: 7,
    active: true,
  },
  {
    id: 'p-06',
    title: 'Jogo Americano em Renda de Bilro',
    artisanId: 'a-06',
    artisanName: 'Cooperativa Mãos de Renda',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    price: 78.0,
    imageUrl: 'https://picsum.photos/seed/origem-renda-2/800/800',
    imageAlt: 'Jogo americano artesanal feito em renda de bilro sobre mesa de madeira',
    description: 'Peça avulsa de jogo americano confeccionada coletivamente por rendeiras da Zona da Mata.',
    details: ['Fio cru natural', 'Lavagem delicada à mão'],
    ownerEmail: 'maos-de-renda@artesaos.origem.com',
    stock: 15,
    active: true,
  },
  {
    id: 'p-07',
    title: 'Cordel Ilustrado "A Origem do Barro"',
    artisanId: 'a-07',
    artisanName: 'Folheteria Bezerros',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    price: 42.0,
    imageUrl: 'https://picsum.photos/seed/origem-xilo-2/800/800',
    imageAlt: 'Capa de livro de cordel ilustrada com xilogravura tradicional',
    description: 'Livreto em sextilhas rimadas impresso em prelo tipográfico com capa em xilogravura.',
    details: ['32 páginas em papel kraft e pólen', 'Edição especial colecionável'],
    ownerEmail: 'folheteria-bezerros@artesaos.origem.com',
    stock: 20,
    active: true,
  },
  {
    id: 'p-08',
    title: 'Cadeira de Palha Trançada',
    artisanId: 'a-04',
    artisanName: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    price: 340.0,
    compareAtPrice: 410.0,
    imageUrl: 'https://picsum.photos/seed/origem-madeira-2/800/800',
    imageAlt: 'Cadeira artesanal de madeira com assento de palha trançada',
    description: 'Cadeira de alpendre com encaixes tradicionais sem pregos aparentes e palhinha natural.',
    details: ['Suporta até 130 kg', 'Palha de carnaúba trançada à mão'],
    ownerEmail: 'irmaos-souza@artesaos.origem.com',
    stock: 3,
    active: true,
  },
  {
    id: 'p-09',
    title: 'Panela de Barro para Cozido',
    artisanId: 'a-01',
    artisanName: 'Zé Caboclo',
    hub: 'Alto do Moura',
    technique: 'Cerâmica Figurativa',
    price: 112.0,
    imageUrl: 'https://picsum.photos/seed/origem-ceramica-3/800/800',
    imageAlt: 'Panela de barro tradicional usada para cozidos nordestinos',
    description: 'Panela curada artesanalmente para preparo lento em fogão a gás ou a lenha.',
    details: ['Capacidade: 3,5 litros', 'Acompanha tampa de barro'],
    ownerEmail: 'artesao@origem.com',
    stock: 9,
    active: true,
  },
  {
    id: 'p-10',
    title: 'Carranca Protetora de Parede em Cedro',
    artisanId: 'a-08',
    artisanName: 'Oficina Carrancas do São Francisco',
    hub: 'Petrolina',
    technique: 'Escultura',
    price: 290.0,
    imageUrl: 'https://picsum.photos/seed/origem-carranca-1/800/800',
    imageAlt: 'Carranca esculpida em madeira de cedro com traços expressivos típicos de Petrolina',
    description: 'Escultura tradicional do Vale do São Francisco talhada em peça inteiriça.',
    details: ['Altura: 35 cm', 'Suporte traseiro embutido para parede'],
    ownerEmail: 'carrancas-petrolina@artesaos.origem.com',
    stock: 4,
    active: true,
  },
  {
    id: 'p-11',
    title: 'Caminho de Mesa Renascença Imperial',
    artisanId: 'a-09',
    artisanName: 'Associação Renda de Pesqueira',
    hub: 'Pesqueira',
    technique: 'Renda Renascença',
    price: 380.0,
    imageUrl: 'https://picsum.photos/seed/origem-pesqueira-1/800/800',
    imageAlt: 'Caminho de mesa longo em renda renascença branca produzido em Pesqueira',
    description: 'Peça autoral com mais de doze pontos clássicos da renda renascença pernambucana.',
    details: ['Comprimento: 1,40 m', 'Certificado de procedência de Pesqueira'],
    ownerEmail: 'renda-pesqueira@artesaos.origem.com',
    stock: 2,
    active: true,
  },
  {
    id: 'p-12',
    title: 'Tapeçaria "Sol de Olinda" em Algodão Cru',
    artisanId: 'a-10',
    artisanName: 'Ateliê Ladeira da Sé',
    hub: 'Olinda',
    technique: 'Tapeçaria',
    price: 275.0,
    imageUrl: 'https://picsum.photos/seed/origem-olinda-1/800/800',
    imageAlt: 'Tapeçaria de parede em algodão cru com formas geométricas em terracota e oliva',
    description: 'Painel têxtil tecido em tear manual com fios tingidos artesanalmente.',
    details: ['Dimensões: 60 x 90 cm', 'Acompanha haste em madeira de lei'],
    ownerEmail: 'ladeira-olinda@artesaos.origem.com',
    stock: 5,
    active: true,
  },
]

export const SEED_REVIEWS: SeedReviewRecord[] = [
  {
    id: 't-01',
    name: 'Camila Torres',
    location: 'Recife, PE',
    quote:
      'Cada peça chegou embalada com cuidado e veio com a história do artesão. Comprar na Origem é sentir o afeto de Pernambuco em casa.',
    rating: 5,
    avatarUrl: 'https://i.pravatar.cc/150?img=32',
    avatarAlt: 'Foto de perfil de Camila Torres',
  },
  {
    id: 't-02',
    name: 'Rafael Lins',
    location: 'São Paulo, SP',
    quote:
      'A qualidade da cerâmica do Alto do Moura superou minhas expectativas. Entrega rápida e atendimento super atencioso.',
    rating: 5,
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    avatarAlt: 'Foto de perfil de Rafael Lins',
  },
  {
    id: 't-03',
    name: 'Beatriz Nascimento',
    location: 'Olinda, PE',
    quote:
      'Já é a terceira vez que compro e sempre me surpreendo com a curadoria. Dá pra sentir a tradição em cada detalhe das peças.',
    rating: 5,
    avatarUrl: 'https://i.pravatar.cc/150?img=47',
    avatarAlt: 'Foto de perfil de Beatriz Nascimento',
  },
]

export async function buildSeedUsers(demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'origem123') {
  const passwordHash = await bcrypt.hash(demoPassword, 10)
  return [
    {
      name: 'Zé Caboclo',
      email: 'artesao@origem.com',
      passwordHash,
      role: UserRole.ARTISAN,
    },
    {
      name: 'Administração Origem',
      email: 'admin@origem.com',
      passwordHash,
      role: UserRole.ADMIN,
    },
    {
      name: 'Camila Torres',
      email: 'comprador@origem.com',
      passwordHash,
      role: UserRole.BUYER,
    },
  ]
}

export async function runSeed(prismaClient: PrismaClient): Promise<void> {
  console.log('🏺 [SEED] Iniciando carga cultural idempotente do Marketplace Origem...')

  const users = await buildSeedUsers()
  for (const user of users) {
    await prismaClient.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
      },
      create: user,
    })
  }
  console.log(`✅ [SEED] ${users.length} contas iniciais sincronizadas (senhas com hash bcrypt).`)

  for (const artisan of SEED_ARTISANS) {
    await prismaClient.artisan.upsert({
      where: { id: artisan.id },
      update: {
        name: artisan.name,
        hub: artisan.hub,
        technique: artisan.technique,
        bio: artisan.bio,
        since: artisan.since,
        photoUrl: artisan.photoUrl,
        photoAlt: artisan.photoAlt,
        coverUrl: artisan.coverUrl,
        coverAlt: artisan.coverAlt,
        email: artisan.email,
        phone: artisan.phone ?? null,
        workshopAddress: artisan.workshopAddress ?? null,
        publicContactConsent: artisan.publicContactConsent,
      },
      create: {
        id: artisan.id,
        name: artisan.name,
        hub: artisan.hub,
        technique: artisan.technique,
        bio: artisan.bio,
        since: artisan.since,
        photoUrl: artisan.photoUrl,
        photoAlt: artisan.photoAlt,
        coverUrl: artisan.coverUrl,
        coverAlt: artisan.coverAlt,
        email: artisan.email,
        phone: artisan.phone ?? null,
        workshopAddress: artisan.workshopAddress ?? null,
        publicContactConsent: artisan.publicContactConsent,
      },
    })
  }
  console.log(`✅ [SEED] ${SEED_ARTISANS.length} mestres e coletivos artesanais sincronizados.`)

  for (const product of SEED_PRODUCTS) {
    await prismaClient.product.upsert({
      where: { id: product.id },
      update: {
        title: product.title,
        artisanId: product.artisanId,
        artisanName: product.artisanName,
        hub: product.hub,
        technique: product.technique,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        description: product.description,
        details: product.details,
        ownerEmail: product.ownerEmail,
        stock: product.stock,
        active: product.active,
      },
      create: {
        id: product.id,
        title: product.title,
        artisanId: product.artisanId,
        artisanName: product.artisanName,
        hub: product.hub,
        technique: product.technique,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        description: product.description,
        details: product.details,
        ownerEmail: product.ownerEmail,
        stock: product.stock,
        active: product.active,
      },
    })
  }
  console.log(`✅ [SEED] ${SEED_PRODUCTS.length} peças artesanais sincronizadas no acervo.`)

  for (const review of SEED_REVIEWS) {
    await prismaClient.review.upsert({
      where: { id: review.id },
      update: {
        name: review.name,
        location: review.location,
        quote: review.quote,
        rating: review.rating,
        avatarUrl: review.avatarUrl,
        avatarAlt: review.avatarAlt,
      },
      create: review,
    })
  }
  console.log(`✅ [SEED] ${SEED_REVIEWS.length} avaliações de compradores sincronizadas.`)
  console.log('🎉 [SEED] Carga concluída com sucesso!')
}

if (require.main === module) {
  const client = new PrismaClient()
  runSeed(client)
    .catch((err) => {
      console.error('❌ [SEED] Erro ao executar seed do banco de dados:', err)
      process.exitCode = 1
    })
    .finally(async () => {
      await client.$disconnect()
    })
}

