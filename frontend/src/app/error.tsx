'use client'

import { ErrorBlock } from '@/components/AsyncState'
import { Container } from '@/design-system'

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <ErrorBlock message="Algo deu errado ao abrir esta página." onRetry={retry} />
      </Container>
    </main>
  )
}
