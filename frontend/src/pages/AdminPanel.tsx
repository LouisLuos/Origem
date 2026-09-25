import { useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, EyeOff, LayoutDashboard, Package, ShoppingBag, Trash2, Users } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Container, cn, currency } from '@/design-system'
import { useAuth } from '@/context/AuthContext'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { useCatalog } from '@/context/CatalogContext'
import { useOrders } from '@/context/OrderContext'
import { useResource } from '@/hooks/useResource'
import { authService } from '@/services/authService'
import type { User } from '@/services/authService'

type SectionId = 'overview' | 'users' | 'orders' | 'catalog'

const sections: { id: SectionId; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { id: 'catalog', label: 'Catálogo', icon: Package },
]

const roleLabels: Record<NonNullable<User['role']>, string> = {
  buyer: 'Comprador',
  artisan: 'Artesão',
  admin: 'Administrador',
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="w-full min-w-xl text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-widest text-ink-soft">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 text-ink">{children}</tbody>
      </table>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-border py-10 text-center text-sm text-ink-soft">{children}</p>
}

export function AdminPanel() {
  const { user } = useAuth()
  const { orders, status: ordersStatus, error: ordersError, reload: reloadOrders } = useOrders()
  const { items, status: catalogStatus, error: catalogError, reload: reloadCatalog, updateItem, removeItem } = useCatalog()
  const { data: users, status: usersStatus, error: usersError, reload: reloadUsers } = useResource(authService.listUsers, [] as User[])
  const [actionError, setActionError] = useState<string | null>(null)
  const [section, setSection] = useState<SectionId>('overview')

  if (!user) return <Navigate to="/entrar" state={{ from: '/admin' }} replace />
  if (user.role !== 'admin') return <Navigate to="/conta" replace />

  const statuses = [usersStatus, ordersStatus, catalogStatus]
  if (statuses.includes('loading')) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <LoadingBlock label="Carregando painel…" />
        </Container>
      </main>
    )
  }
  if (statuses.includes('error')) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <ErrorBlock
            message={usersError ?? ordersError ?? catalogError}
            onRetry={() => {
              reloadUsers()
              reloadOrders()
              reloadCatalog()
            }}
          />
        </Container>
      </main>
    )
  }

  /** Executa uma operação do catálogo e mostra o erro, se houver. */
  const run = async (operation: () => Promise<void>) => {
    setActionError(null)
    try {
      await operation()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.')
    }
  }

  const revenue = orders.reduce((total, order) => total + order.total, 0)
  const soldOutCount = items.filter((item) => item.stock === 0).length

  const metrics = [
    { label: 'Usuários', value: String(users.length) },
    { label: 'Artesãos', value: String(users.filter((candidate) => candidate.role === 'artisan').length) },
    { label: 'Pedidos', value: String(orders.length) },
    { label: 'Receita simulada', value: currency.format(revenue) },
    { label: 'Peças no catálogo', value: String(items.length) },
    { label: 'Peças esgotadas', value: String(soldOutCount) },
  ]

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <div className="pb-8">
          <p className="text-sm text-ink-soft">Administração</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Painel administrativo</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
          <nav aria-label="Seções do painel" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 cursor-pointer items-center gap-2.5 border px-4 py-2.5 text-sm font-medium transition-colors',
                  section === id
                    ? 'border-terracota bg-terracota text-creme-50'
                    : 'border-border text-ink-soft hover:border-ink-soft/50 hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <section aria-label={sections.find((item) => item.id === section)?.label} className="min-w-0">
            {section === 'overview' && (
              <div className="flex flex-col gap-8">
                <dl className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {metrics.map(({ label, value }) => (
                    <div key={label} className="border border-border bg-surface p-4">
                      <dt className="text-xs uppercase tracking-widest text-ink-soft">{label}</dt>
                      <dd className="pt-1 text-2xl font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <h2 className="pb-3 text-sm font-semibold uppercase tracking-widest text-ink">Pedidos recentes</h2>
                  {orders.length === 0 ? (
                    <Empty>Nenhum pedido feito ainda.</Empty>
                  ) : (
                    <Table caption="Pedidos recentes" headers={['Pedido', 'Cliente', 'Data', 'Total']}>
                      {orders.slice(0, 5).map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 font-semibold tracking-wider">{order.id}</td>
                          <td className="px-4 py-3">{order.customer.name}</td>
                          <td className="px-4 py-3 text-ink-soft">{dateFormat.format(new Date(order.createdAt))}</td>
                          <td className="px-4 py-3 font-semibold">{currency.format(order.total)}</td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </div>
              </div>
            )}

            {section === 'users' && (
              <Table caption="Usuários cadastrados" headers={['Nome', 'E-mail', 'Perfil']}>
                {users.map((candidate) => (
                  <tr key={candidate.email}>
                    <td className="px-4 py-3 font-medium">{candidate.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{candidate.email}</td>
                    <td className="px-4 py-3">{roleLabels[candidate.role ?? 'buyer']}</td>
                  </tr>
                ))}
              </Table>
            )}

            {section === 'orders' &&
              (orders.length === 0 ? (
                <Empty>Nenhum pedido feito ainda.</Empty>
              ) : (
                <Table caption="Todos os pedidos" headers={['Pedido', 'Cliente', 'Itens', 'Pagamento', 'Data', 'Total']}>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-semibold tracking-wider">{order.id}</td>
                      <td className="px-4 py-3">
                        {order.customer.name}
                        <span className="block text-xs text-ink-soft">{order.customer.email}</span>
                      </td>
                      <td className="px-4 py-3">{order.lines.reduce((total, line) => total + line.quantity, 0)}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {order.paymentMethod === 'pix' ? 'Pix' : order.paymentMethod === 'card' ? 'Cartão' : 'Boleto'}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{dateFormat.format(new Date(order.createdAt))}</td>
                      <td className="px-4 py-3 font-semibold">{currency.format(order.total)}</td>
                    </tr>
                  ))}
                </Table>
              ))}

            {section === 'catalog' &&
              (items.length === 0 ? (
                <Empty>Nenhum artesão cadastrou peças ainda.</Empty>
              ) : (
                <Table caption="Catálogo de todos os artesãos" headers={['Peça', 'Artesão', 'Preço', 'Estoque', 'Status', 'Ações']}>
                  {items.map((item) => (
                    <tr key={item.id} className={cn(!item.active && 'opacity-60')}>
                      <td className="px-4 py-3 font-medium">{item.title}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {item.artisan}
                      </td>
                      <td className="px-4 py-3">{currency.format(item.price)}</td>
                      <td className={cn('px-4 py-3', item.stock === 0 && 'text-danger')}>{item.stock}</td>
                      <td className="px-4 py-3">{item.active ? 'Ativa' : 'Pausada'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => run(() => updateItem(item.id, { active: !item.active }))}
                            aria-label={item.active ? `Pausar ${item.title}` : `Reativar ${item.title}`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                          >
                            {item.active ? (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remover “${item.title}” do catálogo?`)) run(() => removeItem(item.id))
                            }}
                            aria-label={`Remover ${item.title}`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              ))}

            {actionError && (
              <p role="alert" className="pt-4 text-sm text-danger">
                {actionError}
              </p>
            )}

            <p className="pt-6 text-xs text-ink-soft">
              Simulação: os dados vêm do armazenamento local deste navegador. Com backend, esta área listará todos os usuários,
              pedidos e peças da plataforma.
            </p>
          </section>
        </div>
      </Container>
    </main>
  )
}
