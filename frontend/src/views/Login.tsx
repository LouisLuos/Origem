'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Navigate } from '@/components/Navigate'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { Alert, Button, Container, Input, Tabs, tabPanelProps } from '@/design-system'
import { useAuth, type AuthFailure } from '@/context/AuthContext'
import { isValidCpfCnpj, normalizeCpfCnpj } from '@/utils/cpfCnpj'
import { isStrongPassword } from '@/utils/passwordRequirements'

type Mode = 'login' | 'register'
type Field = 'name' | 'email' | 'cpfCnpj' | 'whatsapp' | 'password' | 'confirmation'
type FieldErrors = Partial<Record<Field, string>>

const tabs = [
  { id: 'login', label: 'Já tenho conta' },
  { id: 'register', label: 'Sou novo por aqui' },
] as const

/** Ordem em que os campos aparecem: define qual recebe o foco quando há erro. */
const fieldOrder: Field[] = ['name', 'email', 'cpfCnpj', 'whatsapp', 'password', 'confirmation']

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

const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim())

export function Login() {
  const { user, login, register, initializationError } = useAuth()
  const redirectTo = safeRedirect(useSearchParams().get('from'))

  const [mode, setMode] = useState<Mode>('login')
  const [values, setValues] = useState<Record<Field, string>>({
    name: '',
    email: '',
    cpfCnpj: '',
    whatsapp: '',
    password: '',
    confirmation: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRefs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({})

  // Com a conta já criada, espera o perfil público ser salvo e mantém a tela se ele falhar.
  if (user && !isSubmitting && !failure) return <Navigate to={redirectTo} />

  const isRegister = mode === 'register'

  const setField = (field: Field, mask?: (value: string) => string) => (event: { target: { value: string } }) => {
    const value = mask ? mask(event.target.value) : event.target.value
    setValues((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (!isEmail(values.email)) errors.email = values.email.trim() ? 'Confira o formato do e-mail (ex.: maria@email.com).' : 'Informe seu e-mail.'

    if (!isRegister) {
      if (!values.password) errors.password = 'Informe sua senha.'
      return errors
    }

    const nameParts = values.name.trim().split(/\s+/).filter(Boolean)
    if (nameParts.length < 2) errors.name = values.name.trim() ? 'Informe nome e sobrenome.' : 'Informe seu nome completo.'

    const document = normalizeCpfCnpj(values.cpfCnpj)
    if (!document) errors.cpfCnpj = 'Informe seu CPF ou CNPJ.'
    else if (!isValidCpfCnpj(document)) errors.cpfCnpj = 'CPF ou CNPJ inválido. Confira os números digitados.'

    const phoneDigits = values.whatsapp.replace(/\D/g, '')
    if (!phoneDigits) errors.whatsapp = 'Informe seu WhatsApp.'
    else if (phoneDigits.length !== 10 && phoneDigits.length !== 11) errors.whatsapp = 'Informe o número com DDD (10 ou 11 dígitos).'

    if (!values.password) errors.password = 'Crie uma senha.'
    else if (!isStrongPassword(values.password)) errors.password = 'A senha ainda não atende a todos os requisitos abaixo.'

    if (!values.confirmation) errors.confirmation = 'Repita a senha.'
    else if (values.confirmation !== values.password) errors.confirmation = 'As senhas não conferem.'

    return errors
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    setFailure(null)
    const firstInvalid = fieldOrder.find((field) => errors[field])
    if (firstInvalid) {
      inputRefs.current[firstInvalid]?.focus()
      return
    }

    setIsSubmitting(true)
    const result = isRegister
      ? await register(values.name, values.email, values.cpfCnpj, values.whatsapp, values.password)
      : await login(values.email, values.password)
    setIsSubmitting(false)
    setFailure(result)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setFailure(null)
  }

  const fieldProps = (field: Field) => ({
    ref: (element: HTMLInputElement | null) => {
      inputRefs.current[field] = element
    },
    value: values[field],
    error: fieldErrors[field],
    className: 'py-2.5',
  })

  const passwordId = `${mode}-password`
  const passwordDescribedBy = [
    isRegister ? 'password-requirements' : null,
    fieldErrors.password ? `${passwordId}-message` : null,
  ].filter(Boolean).join(' ') || undefined

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container className="max-w-md">
        <h1 className="pb-6 text-2xl font-semibold text-ink sm:text-3xl">
          {isRegister ? 'Criar conta' : 'Entrar'}
        </h1>

        <Tabs items={tabs} value={mode} onChange={switchMode} label="Acesso" idPrefix="auth" className="mb-6" />

        <form {...tabPanelProps('auth', mode)} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {isRegister && (
            <Input
              {...fieldProps('name')}
              label="Nome completo"
              onChange={setField('name')}
              autoComplete="name"
              placeholder="Maria da Silva"
              required
            />
          )}
          <Input
            {...fieldProps('email')}
            label="E-mail"
            type="email"
            onChange={setField('email')}
            autoComplete="email"
            placeholder="maria@email.com"
            required
          />
          {isRegister && (
            <>
              <Input
                {...fieldProps('cpfCnpj')}
                label="CPF ou CNPJ"
                onChange={setField('cpfCnpj', maskCpfCnpj)}
                autoComplete="off"
                inputMode="text"
                placeholder="000.000.000-00"
                required
              />
              <Input
                {...fieldProps('whatsapp')}
                label="Telefone WhatsApp"
                type="tel"
                onChange={setField('whatsapp', maskWhatsapp)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="(81) 99999-9999"
                hint="Usado para avisos sobre seus pedidos."
                required
              />
            </>
          )}
          <Input
            {...fieldProps('password')}
            id={passwordId}
            label={isRegister ? 'Crie uma senha' : 'Senha'}
            type={showPassword ? 'text' : 'password'}
            onChange={setField('password')}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            aria-describedby={passwordDescribedBy}
            required
          />
          {isRegister && <PasswordChecklist id="password-requirements" password={values.password} />}
          {isRegister && (
            <Input
              {...fieldProps('confirmation')}
              label="Repita a senha"
              type={showPassword ? 'text' : 'password'}
              onChange={setField('confirmation')}
              autoComplete="new-password"
              required
            />
          )}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
              className="h-4 w-4 accent-terracota"
            />
            Mostrar senha
          </label>

          {isRegister && (
            <p className="text-sm text-ink-soft">
              Sua conta começa como comprador. Você poderá solicitar um perfil avançado após entrar.
            </p>
          )}

          {failure?.code === 'LOGIN_BLOQUEADO' ? (
            <Alert tone="warning" title="Acesso bloqueado temporariamente">
              Houve muitas tentativas de login com senha incorreta. Aguarde 15 minutos e tente novamente.
            </Alert>
          ) : failure?.code === 'CONTA_DUPLICADA' ? (
            <Alert
              tone="error"
              title="Você já tem uma conta"
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => switchMode('login')}>
                  Entrar com esta conta
                </Button>
              }
            >
              Este e-mail ou CPF/CNPJ já está cadastrado.
            </Alert>
          ) : failure?.code === 'CREDENCIAIS_INVALIDAS' ? (
            <Alert tone="error" title="E-mail ou senha incorretos">
              Confira os dados e tente novamente. Após 5 tentativas incorretas, o acesso fica bloqueado por 15 minutos.
            </Alert>
          ) : failure ? (
            <Alert tone="error">{failure.message}</Alert>
          ) : (
            !isRegister && initializationError && <Alert tone="warning">{initializationError}</Alert>
          )}

          {user && (
            <Link href={redirectTo} className="text-sm font-medium text-terracota-600 underline-offset-4 hover:underline">
              Continuar para a minha conta
            </Link>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Aguarde…' : isRegister ? 'Criar conta' : 'Entrar'}
          </Button>
          <p className="text-xs text-ink-soft">
            Seus dados são enviados com segurança para criar ou acessar sua conta.
          </p>
        </form>
      </Container>
    </main>
  )
}
