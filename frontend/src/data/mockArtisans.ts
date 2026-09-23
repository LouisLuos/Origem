export interface ArtisanSpotlight {
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
}

/**
 * Gera uma variante quadrada (1:1) da mesma foto (mesma seed do picsum), para uso em avatares.
 * Evita recortar o retrato original ao forçá-lo num quadro quadrado pequeno.
 */
export function getAvatarUrl(photoUrl: string, size = 400): string {
  const match = photoUrl.match(/^(https:\/\/picsum\.photos\/seed\/[^/]+\/)\d+\/\d+$/)
  if (!match) return photoUrl
  return `${match[1]}${size}/${size}`
}

/**
 * Dados de artesãos para desenvolvimento visual do front-end.
 * Substituir por chamadas a `GET /artesaos` quando a API estiver disponível.
 */
export const artisanSpotlights: ArtisanSpotlight[] = [
  {
    id: 'a-01',
    name: 'Zé Caboclo',
    hub: 'Alto do Moura, Caruaru',
    technique: 'Cerâmica Figurativa',
    bio: 'Terceira geração de ceramistas do Alto do Moura, mantém viva a tradição iniciada por Mestre Vitalino, retratando o cotidiano nordestino em barro. Aprendeu a modelar argila ainda criança, observando o pai e o avô no torno, e hoje divide o ateliê da família com dois sobrinhos que começam a aprender o ofício.',
    since: 1994,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-1/600/700',
    photoAlt: 'Ceramista trabalhando argila em torno de oleiro',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-1/1600/500',
    coverAlt: 'Ateliê de cerâmica figurativa do Alto do Moura com peças de barro secando ao sol',
  },
  {
    id: 'a-02',
    name: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    bio: 'Aprendeu a técnica com a avó aos 9 anos e hoje coordena uma cooperativa de 12 rendeiras, exportando peças para todo o Brasil. Defende que a renda renascença é uma forma de manter mulheres da Zona da Mata com renda própria sem precisar deixar suas cidades.',
    since: 2003,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-2/600/700',
    photoAlt: 'Rendeira produzindo renda renascença em bastidor de madeira',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-2/1600/500',
    coverAlt: 'Grupo de rendeiras trabalhando em bastidores de madeira em Nazaré da Mata',
  },
  {
    id: 'a-03',
    name: 'J. Borges Filho',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    bio: 'Herdeiro de uma das famílias mais tradicionais da xilogravura pernambucana, ilustra folhetos de cordel com temas do sertão contemporâneo. Suas matrizes já foram expostas em mostras de arte popular em Recife e São Paulo.',
    since: 1988,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-3/600/700',
    photoAlt: 'Artesão entalhando matriz de madeira para xilogravura',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-3/1600/500',
    coverAlt: 'Bancada de trabalho com matrizes de xilogravura entalhadas em madeira',
  },
  {
    id: 'a-04',
    name: 'Marcenaria Irmãos Souza',
    hub: 'Garanhuns',
    technique: 'Marcenaria',
    bio: 'Marcenaria de família fundada pelos irmãos Souza, especializada em móveis entalhados e peças em palha trançada. Trabalha só com madeira de reflorestamento certificado e forma novos marceneiros da região através de oficinas abertas na comunidade.',
    since: 1976,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-4/600/700',
    photoAlt: 'Marceneiro entalhando peça de madeira em oficina',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-4/1600/500',
    coverAlt: 'Oficina de marcenaria com móveis de madeira maciça em produção',
  },
  {
    id: 'a-05',
    name: 'Ateliê Barro Vivo',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    bio: 'Coletivo de ceramistas de Tracunhaém que combina técnicas tradicionais de vitrificação com desenhos contemporâneos, buscando levar a cerâmica pernambucana para dentro de casas urbanas sem perder a identidade popular.',
    since: 2011,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-5/600/700',
    photoAlt: 'Ceramista vitrificando peça de barro em ateliê coletivo',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-5/1600/500',
    coverAlt: 'Prateleiras com vasos de cerâmica vitrificada em tons terrosos',
  },
  {
    id: 'a-06',
    name: 'Cooperativa Mãos de Renda',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    bio: 'Cooperativa que reúne rendeiras de várias gerações de Nazaré da Mata, garantindo renda justa e comércio direto com quem compra. Cada peça passa por um controle de qualidade coletivo antes de sair do ateliê.',
    since: 2008,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-6/600/700',
    photoAlt: 'Rendeiras reunidas produzindo peças em renda de bilro',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-6/1600/500',
    coverAlt: 'Mesa de trabalho da cooperativa com jogos americanos em renda de bilro',
  },
  {
    id: 'a-07',
    name: 'Folheteria Bezerros',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    bio: 'Editora artesanal de cordéis que imprime em prelo tipográfico há mais de trinta anos, unindo xilogravura e literatura popular para manter viva a tradição dos folhetos nordestinos.',
    since: 1991,
    photoUrl: 'https://picsum.photos/seed/origem-artesao-7/600/700',
    photoAlt: 'Impressor operando prelo tipográfico para folhetos de cordel',
    coverUrl: 'https://picsum.photos/seed/origem-atelie-7/1600/500',
    coverAlt: 'Prelo tipográfico e pilhas de folhetos de cordel impressos',
  },
]
