import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Home } from '@/pages/Home'
import { ProductDetail } from '@/pages/ProductDetail'
import { ArtisanProfile } from '@/pages/ArtisanProfile'
import { Cart } from '@/pages/Cart'
import { CartProvider } from '@/context/CartContext'
import { ProductFilterProvider } from '@/context/ProductFilterContext'

export default function App() {
  return (
    <CartProvider>
      <ProductFilterProvider>
        <BrowserRouter>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-terracota focus:px-5 focus:py-3 focus:text-creme-50"
          >
            Pular para o conteúdo principal
          </a>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/produtos/:id" element={<ProductDetail />} />
            <Route path="/artesaos/:id" element={<ArtisanProfile />} />
            <Route path="/carrinho" element={<Cart />} />
          </Routes>
          <Footer />
        </BrowserRouter>
      </ProductFilterProvider>
    </CartProvider>
  )
}
