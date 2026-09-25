import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Home } from '@/pages/Home'
import { ProductDetail } from '@/pages/ProductDetail'
import { ArtisanProfile } from '@/pages/ArtisanProfile'
import { Cart } from '@/pages/Cart'
import { Login } from '@/pages/Login'
import { Account } from '@/pages/Account'
import { Favorites } from '@/pages/Favorites'
import { AdminPanel } from '@/pages/AdminPanel'
import { ArtisanPanel } from '@/pages/ArtisanPanel'
import { NotFound } from '@/pages/NotFound'
import { Checkout } from '@/pages/Checkout'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { CartProvider } from '@/context/CartContext'
import { AuthProvider } from '@/context/AuthContext'
import { ArtisanProvider } from '@/context/ArtisanContext'
import { CatalogProvider } from '@/context/CatalogContext'
import { FavoritesProvider } from '@/context/FavoritesContext'
import { OrderProvider } from '@/context/OrderContext'
import { ProductFilterProvider } from '@/context/ProductFilterContext'

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <ArtisanProvider>
          <CartProvider>
            <OrderProvider>
              <FavoritesProvider>
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
                      <Route path="/favoritos" element={<Favorites />} />
                      <Route path="/entrar" element={<Login />} />
                      <Route path="/painel" element={<ArtisanPanel />} />
                      <Route path="/admin" element={<AdminPanel />} />
                      <Route path="/conta" element={<Account />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/pedido/:id" element={<OrderConfirmation />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Footer />
                  </BrowserRouter>
                </ProductFilterProvider>
              </FavoritesProvider>
            </OrderProvider>
          </CartProvider>
        </ArtisanProvider>
      </CatalogProvider>
    </AuthProvider>
  )
}
