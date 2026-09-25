import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Container, Input, cn } from '@/design-system'
import { useAuth } from '@/context/AuthContext'

type Mode = 'login' | 'register'

export function Login() {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/conta'

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isArtisan, setIsArtisan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={redirectTo} replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'register' && !name.trim()) return setError('Informe seu nome.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('E-mail inválido.')
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.')

    setError(null)
    setIsSubmitting(true)
    const result =
      mode === 'login' ? await login(email, password) : await register(name, email, password, isArtisan ? 'artisan' : 'buyer')
    setIsSubmitting(false)
    if (result) return setError(result)
    navigate(redirectTo, { replace: true })
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container className="max-w-md">
        <h1 className="pb-6 text-2xl font-semibold text-ink sm:text-3xl">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>

        <div role="tablist" aria-label="Acesso" className="mb-6 grid grid-cols-2 border border-border">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => switchMode(tab)}
              className={cn(
                'cursor-pointer py-2.5 text-sm font-medium transition-colors',
                mode === tab ? 'bg-terracota text-creme-50' : 'text-ink-soft hover:text-ink',
              )}
            >
              {tab === 'login' ? 'Já tenho conta' : 'Sou novo por aqui'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Nome completo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Maria da Silva"
              className="py-2.5"
            />
          )}
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="maria@email.com"
            className="py-2.5"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Mínimo de 6 caracteres"
            className="py-2.5"
          />

          {mode === 'register' && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={isArtisan}
                onChange={(event) => setIsArtisan(event.target.checked)}
                className="h-4 w-4 accent-terracota"
              />
              Sou artesão(ã) e quero vender minhas peças
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
          <p className="text-xs text-ink-soft">
            Simulação: a conta fica salva apenas neste navegador, sem servidor. Para testar o painel do artesão, entre com artesao@origem.com / origem123; para o painel administrativo, admin@origem.com / origem123.
          </p>
        </form>
      </Container>
    </main>
  )
}
