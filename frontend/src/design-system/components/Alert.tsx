import type { ReactNode } from 'react'
import { AlertTriangle, CircleCheck, Info, XCircle } from 'lucide-react'
import { cn } from '../cn'

type Tone = 'error' | 'success' | 'warning' | 'info'

const toneStyles: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  error: { box: 'border-danger/40 bg-danger/5', icon: 'text-danger', Icon: XCircle },
  success: { box: 'border-success/40 bg-success/5', icon: 'text-success', Icon: CircleCheck },
  warning: { box: 'border-warning/50 bg-warning/10', icon: 'text-aubergine', Icon: AlertTriangle },
  info: { box: 'border-border bg-surface', icon: 'text-oliva-600', Icon: Info },
}

export interface AlertProps {
  tone?: Tone
  title?: string
  children?: ReactNode
  /** Ações (ex.: "Tentar novamente"), exibidas abaixo do texto. */
  action?: ReactNode
  className?: string
}

/**
 * Aviso em caixa. `error` é anunciado na hora por leitor de tela (`role="alert"`);
 * os demais tons, de forma educada (`role="status"`). Para erro curto sob um campo,
 * use a prop `error` do `Input`, `Select` ou `Textarea`.
 */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const { box, icon, Icon } = toneStyles[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 border p-4 text-sm', box, className)}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
        {action && <div className="flex flex-wrap gap-2 pt-2">{action}</div>}
      </div>
    </div>
  )
}
