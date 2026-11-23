'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Navigate } from '@/components/Navigate'
import { Button, Container, Input, cn } from '@/design-system'
import { useAuth } from '@/context/AuthContext'

type Mode = 'login' | 'register'

/** `from` vem da URL: só aceita caminho interno, para o login não redirecionar para outro site. */
function safeRedirect(from: string | null) {
  return from && /^\/(?![/\\])/.test(from) ? from : '/'
}

function maskCpfCnpj(value: string) {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14)
  if (raw.length <= 11 && !/[A-Z]/.test(raw)) {
    return raw
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return raw
    .replace(/^(.{2})(.)/, '$1.$2')
    .replace(/^(.{2})\.(.{3})(.)/, '$1.$2.$3')
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, '$1.$2.$3/$4')
    .replace(/(.{4})(.)$/, '$1-$2')
}

function maskWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  const local = digits.length === 11
    ? `${digits.slice(2, 7)}-${digits.slice(7)}`
    : `${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${local}`
}

export function Login() {
  const { user, login, register, initializationError } = useAuth()
  const redirectTo = safeRedirect(useSearchParams().get('from'))

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Com a conta já criada, espera o perfil público ser salvo e mantém a tela se ele falhar.
  if (user && !isSubmitting && !error) return <Navigate to={redirectTo} />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'register' && !name.trim()) return setError('Informe seu nome.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('E-mail inválido.')
    if (mode === 'register') {
      const document = cpfCnpj.replace(/[^0-9A-Z]/gi, '')
      const phoneDigits = whatsapp.replace(/\D/g, '')
      if (document.length !== 11 && document.length !== 14) return setError('Informe um CPF ou CNPJ válido.')
      if (phoneDigits.length !== 10 && phoneDigits.length !== 11) return setError('Informe um WhatsApp com DDD.')
      if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return setError('A senha deve ter ao menos 8 caracteres, uma letra maiúscula, um número e um símbolo.')
      }
    } else if (password.length === 0) {
      return setError('Informe sua senha.')
    }

    setError(null)
    setIsSubmitting(true)
    let result: string | null
    if (mode === 'login') {
      result = await login(email, password)
    } else {
      result = await register(name, email, cpfCnpj, whatsapp, password)
    }
    setIsSubmitting(false)
    setError(result)
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
              required
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
            required
            className="py-2.5"
          />
          {mode === 'register' && (
            <>
              <Input
                label="CPF ou CNPJ"
                value={cpfCnpj}
                onChange={(event) => setCpfCnpj(maskCpfCnpj(event.target.value))}
                autoComplete="off"
                inputMode="text"
                placeholder="000.000.000-00"
                required
                className="py-2.5"
              />
              <Input
                label="Telefone WhatsApp"
                type="tel"
                value={whatsapp}
                onChange={(event) => setWhatsapp(maskWhatsapp(event.target.value))}
                autoComplete="tel"
                inputMode="tel"
                placeholder="(81) 99999-9999"
                required
                className="py-2.5"
              />
            </>
          )}
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'register' ? 'Mín. 8 caracteres, maiúscula, número e símbolo' : 'Sua senha'}
            required
            className="py-2.5"
          />

          {mode === 'login' && (
            <Link
              href="/recuperar-senha"
              className="-mt-2 self-end text-sm font-medium text-terracota-600 underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
          )}

          {mode === 'register' && (
            <p className="text-sm text-ink-soft">
              Sua conta começa como comprador. Você poderá solicitar um perfil avançado após entrar.
            </p>
          )}

          {(error || (mode === 'login' && initializationError)) && (
            <p role="alert" className="text-sm text-danger">
              {error ?? initializationError}
            </p>
          )}

          {user && (
            <Link href={redirectTo} className="text-sm font-medium text-terracota-600 underline-offset-4 hover:underline">
              Continuar para a minha conta
            </Link>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
          <p className="text-xs text-ink-soft">
            Seus dados são enviados com segurança para criar ou acessar sua conta.
          </p>
        </form>
      </Container>
    </main>
  )
}
