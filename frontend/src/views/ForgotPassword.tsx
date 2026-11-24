'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button, Container, Input } from '@/design-system'
import { passwordRecoveryService } from '@/services/passwordRecoveryService'
import { errorMessage } from '@/utils/errors'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Informe um e-mail válido.')

    setError(null)
    setIsSubmitting(true)
    try {
      setSentMessage(await passwordRecoveryService.requestReset(email))
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível solicitar a recuperação de senha.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container className="max-w-md">
        <h1 className="pb-2 text-2xl font-semibold text-ink sm:text-3xl">Recuperar senha</h1>

        {sentMessage ? (
          <div className="flex flex-col gap-4 pt-4">
            <div role="status" className="flex items-start gap-3 border border-border bg-surface p-4">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-oliva-600" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium text-ink">{sentMessage}</p>
                <p className="text-ink-soft">
                  O link vale por 30 minutos. Se não encontrar o e-mail, confira a caixa de spam.
                </p>
              </div>
            </div>
            <Link href="/entrar" className="text-sm font-medium text-terracota-600 underline-offset-4 hover:underline">
              Voltar para entrar
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pt-4">
            <p className="text-sm text-ink-soft">
              Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
            </p>
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
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}
            </Button>
            <Link href="/entrar" className="text-sm font-medium text-terracota-600 underline-offset-4 hover:underline">
              Lembrei a senha
            </Link>
          </form>
        )}
      </Container>
    </main>
  )
}
