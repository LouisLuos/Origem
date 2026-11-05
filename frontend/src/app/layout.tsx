import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Origem | Artesanato de Pernambuco',
  description:
    'Origem: marketplace da economia criativa e do artesanato tradicional de Pernambuco. Conecte-se direto com artesãos, técnicas e polos culturais.',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#B34E24',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
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

