export interface ArtisanSpotlight {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  photoUrl: string
  photoAlt: string
}

export const artisanSpotlights: ArtisanSpotlight[] = [
  {
    id: 'a-01',
    name: 'Zé Caboclo',
    hub: 'Alto do Moura, Caruaru',
    technique: 'Cerâmica Figurativa',
    bio: 'Terceira geração de ceramistas do Alto do Moura, mantém viva a tradição iniciada por Mestre Vitalino, retratando o cotidiano nordestino em barro.',
    photoUrl: 'https://picsum.photos/seed/origem-artesao-1/600/700',
    photoAlt: 'Ceramista trabalhando argila em torno de oleiro',
  },
  {
    id: 'a-02',
    name: 'Dona Analu',
    hub: 'Nazaré da Mata',
    technique: 'Renda Renascença',
    bio: 'Aprendeu a técnica com a avó aos 9 anos e hoje coordena uma cooperativa de 12 rendeiras, exportando peças para todo o Brasil.',
    photoUrl: 'https://picsum.photos/seed/origem-artesao-2/600/700',
    photoAlt: 'Rendeira produzindo renda renascença em bastidor de madeira',
  },
  {
    id: 'a-03',
    name: 'J. Borges Filho',
    hub: 'Bezerros',
    technique: 'Xilogravura',
    bio: 'Herdeiro de uma das famílias mais tradicionais da xilogravura pernambucana, ilustra folhetos de cordel com temas do sertão contemporâneo.',
    photoUrl: 'https://picsum.photos/seed/origem-artesao-3/600/700',
    photoAlt: 'Artesão entalhando matriz de madeira para xilogravura',
  },
]
