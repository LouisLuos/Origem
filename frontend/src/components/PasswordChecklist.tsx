import { Check, Circle } from 'lucide-react'
import { cn } from '@/design-system'
import { passwordRequirements } from '@/utils/passwordRequirements'

/** Requisitos da senha marcados conforme a pessoa digita. */
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  return (
    <ul id={id} aria-label="Requisitos da senha" className="grid gap-1 text-sm sm:grid-cols-2">
      {passwordRequirements.map((requirement) => {
        const met = requirement.test(password)
        const Icon = met ? Check : Circle
        return (
          <li key={requirement.label} className={cn('flex items-center gap-2', met ? 'text-success' : 'text-ink-soft')}>
            <Icon className={cn('shrink-0', met ? 'h-4 w-4' : 'h-3 w-3')} aria-hidden="true" />
            <span>
              {requirement.label}
              <span className="sr-only">{met ? ': atendido' : ': pendente'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
