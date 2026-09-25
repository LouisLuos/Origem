import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogOut, Package } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Button, Container, Input, currency } from '@/design-system'
import { useAuth } from '@/context/AuthContext'
import { LoadingBlock } from '@/components/AsyncState'
import { useOrders } from '@/context/OrderContext'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

export function Account() {
  const { user, logout, updateName } = useAuth()
  const { orders, status: ordersStatus } = useOrders()
  const [name, setName] = useState(user?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!user) return <Navigate to="/entrar" state={{ from: '/conta' }} replace />

  const myOrders = orders.filter((order) => order.userEmail === user.email)

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaved(false)
    setSaveError(await updateName(name))
    setSaved(true)
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
          <div>
            <p className="text-sm text-ink-soft">Minha conta</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Olá, {user.name.split(' ')[0]}</h1>
          </div>
          <div className="flex gap-3">
            {user.role === 'admin' && (
              <Link to="/admin">
                <Button variant="primary" size="sm">
                  Painel administrativo
                </Button>
              </Link>
            )}
            {user.role === 'artisan' && (
              <Link to="/painel">
                <Button variant="primary" size="sm">
                  Painel do artesão
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
          <section aria-labelledby="orders-title">
            <h2 id="orders-title" className="pb-4 text-sm font-semibold uppercase tracking-widest text-ink">
              Meus pedidos
            </h2>

            {ordersStatus === 'loading' ? (
              <LoadingBlock label="Carregando pedidos…" />
            ) : myOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-4 border border-dashed border-border py-14 text-center">
                <Package className="h-10 w-10 text-ink-soft/60" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <p className="text-base font-medium text-ink">Você ainda não fez pedidos</p>
                  <p className="text-sm text-ink-soft">Quando finalizar uma compra, ela aparece aqui.</p>
                </div>
                <Link to="/#vitrine">
                  <Button variant="primary" size="md">
                    Ver vitrine
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {myOrders.map((order) => (
                  <li key={order.id} className="border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <Link
                        to={`/pedido/${order.id}`}
                        className="text-sm font-semibold tracking-widest text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                      >
                        {order.id}
                      </Link>
                      <span className="text-xs text-ink-soft">{dateFormat.format(new Date(order.createdAt))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.lines.slice(0, 4).map((line) => (
                        <img
                          key={line.productId}
                          src={line.imageUrl}
                          alt={line.imageAlt}
                          className="h-14 w-14 object-cover"
                        />
                      ))}
                      {order.lines.length > 4 && (
                        <span className="text-xs text-ink-soft">+{order.lines.length - 4}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 text-sm">
                      <span className="text-ink-soft">
                        {order.lines.reduce((total, line) => total + line.quantity, 0)} item(ns) · Em preparo
                      </span>
                      <span className="font-semibold text-ink">{currency.format(order.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="h-fit border border-border bg-aubergine-400/10 p-6">
            <h2 className="pb-4 text-sm font-semibold uppercase tracking-widest text-ink">Meus dados</h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Input
                label="Nome"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setSaved(false)
                }}
                className="py-2.5"
              />
              <Input label="E-mail" value={user.email} readOnly className="py-2.5 opacity-70" />
              <Button type="submit" variant="primary" size="md">
                Salvar alterações
              </Button>
              {saved && saveError && (
                <p role="alert" className="text-xs text-danger">
                  {saveError}
                </p>
              )}
              {saved && !saveError && (
                <p role="status" className="text-xs text-oliva-600">
                  Dados atualizados.
                </p>
              )}
            </form>
          </aside>
        </div>
      </Container>
    </main>
  )
}
