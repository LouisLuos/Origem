import { Button, Container, Input } from '@/design-system'
import ctaBackground from '@/assets/cta-background.jpg'

export function Newsletter() {
  return (
    <section className="relative overflow-hidden bg-oliva-600 py-24 text-creme-50">
      <img
        src={ctaBackground}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-aubergine/60" aria-hidden="true" />

      <Container className="relative flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-medium text-creme-50 sm:text-4xl">Receba novidades da economia criativa</h2>
        <p className="max-w-xl text-oliva-50/90">
          Lançamentos e curadorias direto no seu e-mail.
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
