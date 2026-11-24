'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, CircleCheck, X } from 'lucide-react'
import { Button, ButtonLink, Container, Input, cn } from '@/design-system'
import { useAuth } from '@/context/AuthContext'
import { isApiError } from '@/services/api'
import { passwordRecoveryService, passwordRequirements } from '@/services/passwordRecoveryService'
import { errorMessage } from '@/utils/errors'

export function ResetPassword() {
  const searchParams = useSearchParams()
  const [token] = useState(() => searchParams.get('token') ?? '')
  const { user, logout } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tokenRejected, setTokenRejected] = useState(false)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // O link do e-mail traz o token na URL; tira-o da barra de endereço e do histórico.
  useEffect(() => {
    if (window.location.search.includes('token=')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const unmet = passwordRequirements.filter((requirement) => !requirement.test(password))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (unmet.length > 0) return setError('A nova senha ainda não atende a todos os requisitos.')
    if (password !== confirmation) return setError('As senhas não conferem.')

    setError(null)
    setIsSubmitting(true)
    try {
      const message = await passwordRecoveryService.resetPassword(token, password)
      if (user) await logout()
      setDoneMessage(message)
    } catch (reason) {
      setTokenRejected(isApiError(reason) && reason.code === 'TOKEN_RECUPERACAO_INVALIDO')
      setError(errorMessage(reason, 'Não foi possível redefinir a senha.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container className="flex max-w-md flex-col gap-4">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Link inválido</h1>
          <p className="text-sm text-ink-soft">
            Este link de recuperação está incompleto ou não é válido. Solicite um novo link.
          </p>
          <ButtonLink href="/recuperar-senha" variant="primary" size="md">
            Solicitar novo link
          </ButtonLink>
        </Container>
      </main>
    )
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container className="max-w-md">
        <h1 className="pb-2 text-2xl font-semibold text-ink sm:text-3xl">Criar nova senha</h1>

        {doneMessage ? (
          <div className="flex flex-col gap-4 pt-4">
            <div role="status" className="flex items-start gap-3 border border-border bg-surface p-4">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-oliva-600" aria-hidden="true" />
              <p className="text-sm font-medium text-ink">{doneMessage}</p>
            </div>
            <ButtonLink href="/entrar" variant="primary" size="md">
              Entrar com a nova senha
            </ButtonLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pt-4">
            <Input
              label="Nova senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              aria-describedby="password-requirements"
              required
              className="py-2.5"
            />
            <ul id="password-requirements" aria-label="Requisitos da senha" className="flex flex-col gap-1 text-sm">
              {passwordRequirements.map((requirement) => {
                const met = requirement.test(password)
                const Icon = met ? Check : X
                return (
                  <li key={requirement.label} className={cn('flex items-center gap-2', met ? 'text-oliva-600' : 'text-ink-soft')}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {requirement.label}
                      <span className="sr-only">{met ? ' (atendido)' : ' (pendente)'}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <Input
              label="Confirme a nova senha"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              className="py-2.5"
            />
            <p className="text-sm text-ink-soft">
              Ao salvar, todas as sessões abertas da sua conta serão encerradas.
            </p>
            {error && (
              <div role="alert" className="flex flex-col gap-1 text-sm text-danger">
                <p>{error}</p>
                {tokenRejected && (
                  <Link href="/recuperar-senha" className="font-medium underline underline-offset-4">
                    Solicitar novo link
                  </Link>
                )}
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </Container>
    </main>
  )
}
