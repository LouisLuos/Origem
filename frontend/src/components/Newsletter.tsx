import { Button, Container, Input } from '@/design-system'

export function Newsletter() {
  return (
    <section className="bg-oliva-600 py-14 text-creme-50">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-medium text-creme-50 sm:text-4xl">Receba novidades da economia criativa</h2>
        <p className="max-w-xl text-oliva-50/90">
          Lançamentos de peças, histórias de artesãos e curadorias por técnica direto no seu e-mail.
        </p>
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1">
            <Input
              type="email"
              name="email"
              label="Seu e-mail"
              hideLabel
              placeholder="seuemail@exemplo.com"
              required
              className="bg-creme-50 text-ink"
            />
          </div>
          <Button type="submit" variant="primary" size="md" className="shrink-0">
            Inscrever-se
          </Button>
        </form>
      </Container>
    </section>
  )
}
