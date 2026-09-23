export interface Testimonial {
  id: string
  name: string
  location: string
  quote: string
  rating: number
  avatarUrl: string
  avatarAlt: string
}

export const testimonials: Testimonial[] = [
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
