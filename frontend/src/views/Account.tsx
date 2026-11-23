'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogOut, Package } from 'lucide-react'
import Link from 'next/link'
import { Navigate } from '@/components/Navigate'
import { AddressBook } from '@/components/AddressBook'
import { ArtisanOnboardingForm } from '@/components/ArtisanOnboardingForm'
import { Button, ButtonLink, Container, Input, currency } from '@/design-system'
import { useAuth } from '@/context/AuthContext'
import { LoadingBlock } from '@/components/AsyncState'
import { orderStatusLabels, useOrders } from '@/context/OrderContext'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

export function Account() {
  const { user, logout, updateName } = useAuth()
  const { orders, status: ordersStatus } = useOrders()
  const [name, setName] = useState(user?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!user) return <Navigate to="/entrar?from=/conta" />

  const myOrders = orders

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
              <ButtonLink href="/admin" variant="primary" size="sm">
                  Painel administrativo
                </ButtonLink>
            )}
            {user.role === 'artisan' && (
              <ButtonLink href="/painel" variant="primary" size="sm">
                  Painel do artesão
                </ButtonLink>
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
                <ButtonLink href="/#vitrine" variant="primary" size="md">
                    Ver vitrine
                  </ButtonLink>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {myOrders.map((order) => (
                  <li key={order.id} className="border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <Link
                        href={`/pedido/${encodeURIComponent(order.codigoPedido)}`}
                        className="text-sm font-semibold tracking-widest text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                      >
                        {order.codigoPedido}
                      </Link>
                      <span className="text-xs text-ink-soft">{dateFormat.format(new Date(order.criadoEm))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.itens.slice(0, 4).map((line) =>
                        line.fotoPrincipalUrl ? (
                          <img
                            key={line.pecaId}
                            src={line.fotoPrincipalUrl}
                            alt={line.titulo}
                            className="h-14 w-14 object-cover"
                          />
                        ) : (
                          <div
                            key={line.pecaId}
                            className="flex h-14 w-14 items-center justify-center bg-surface-muted text-xs text-ink-soft"
                          >
                            {line.quantidade}x
                          </div>
                        ),
                      )}
                      {order.itens.length > 4 && (
                        <span className="text-xs text-ink-soft">+{order.itens.length - 4}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 text-sm">
                      <span className="text-ink-soft">
                        {order.itens.reduce((total, line) => total + line.quantidade, 0)} item(ns) ·{' '}
                        {orderStatusLabels[order.status]}
                      </span>
                      <span className="font-semibold text-ink">{currency.format(order.valorTotalPedido)}</span>
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

        <div className="pt-10">
          <AddressBook />
        </div>

        <div className="pt-10">
          <ArtisanOnboardingForm />
        </div>
      </Container>
    </main>
  )
}
