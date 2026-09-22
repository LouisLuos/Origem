import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-terracota text-creme-50 hover:bg-terracota-600 active:bg-terracota-700 shadow-soft',
  secondary:
    'bg-oliva text-creme-50 hover:bg-oliva-600 active:bg-oliva-700 shadow-soft',
  outline:
    'bg-transparent text-aubergine border border-aubergine/30 hover:border-aubergine hover:bg-aubergine/5',
  ghost: 'bg-transparent text-aubergine hover:bg-aubergine/5',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-4 py-2 gap-1.5',
  md: 'text-base px-6 py-3 gap-2',
  lg: 'text-lg px-8 py-4 gap-2.5',
}

/**
 * Botão base do Design System Origem.
 * Cantos generosos e cores terrosas reforçam a identidade artesanal;
 * o anel de foco (globals.css) garante navegação por teclado (RNF-07).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
