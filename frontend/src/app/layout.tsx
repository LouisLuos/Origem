import type { Metadata, Viewport } from 'next'
import { DM_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Providers } from './providers'
import '@/styles/globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: { default: 'Origem | Artesanato de Pernambuco', template: '%s | Origem' },
  description:
    'Origem: marketplace da economia criativa e do artesanato tradicional de Pernambuco. Conecte-se direto com artesãos, técnicas e polos culturais.',
  icons: '/favicon.ico',
}

export const viewport: Viewport = {
  themeColor: '#B34E24',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={dmSans.variable} data-scroll-behavior="smooth">
      <body className="bg-creme text-aubergine antialiased">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-terracota focus:px-5 focus:py-3 focus:text-creme-50"
          >
            Pular para o conteúdo principal
          </a>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
