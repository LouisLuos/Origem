/**
 * Espelho em JS/TS dos tokens definidos em `src/styles/globals.css` (@theme).
 * Use isto apenas quando precisar do valor bruto em JS (ex.: gráficos, canvas,
 * inline styles vindos de dados dinâmicos). Para estilizar componentes,
 * prefira sempre as classes utilitárias do Tailwind (bg-terracota, text-oliva, etc).
 */
export const colors = {
  creme: '#EFE1CB',
  cremeMuted: '#F7F1E5',
  terracota: '#B34E24',
  terracotaDark: '#953F1C',
  oliva: '#5D6737',
  aubergine: '#3F1B18',
  surface: '#FFFDF9',
  border: '#E4D7BF',
  ink: '#2C1210',
  inkSoft: '#6B5A4F',
  success: '#4D7C4A',
  warning: '#C98A1A',
  danger: '#A3352B',
} as const

export const fonts = {
  body: '"DM Sans", "Segoe UI", sans-serif',
} as const

/** Polos culturais e técnicas usados como taxonomia inicial (ver RF-CAT-02). */
export const techniques = [
  'Cerâmica Figurativa',
  'Renda Renascença',
  'Xilogravura',
  'Marcenaria',
  'Cordel',
  'Bordado',
] as const

export const culturalHubs = [
  'Caruaru',
  'Alto do Moura',
  'Nazaré da Mata',
  'Tracunhaém',
  'Bezerros',
  'Garanhuns',
] as const
