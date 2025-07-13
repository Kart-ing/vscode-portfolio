
// src/components/ui/Button.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variantClasses = {
      'bg-[var(--primary)] text-[var(--textAccent)] hover:bg-[var(--secondary)]': variant === 'primary',
      'bg-[var(--surface)] text-[var(--textPrimary)] hover:bg-[var(--surfaceHover)]': variant === 'secondary',
      'text-[var(--textPrimary)] hover:bg-[var(--hover)]': variant === 'ghost',
      'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
    }

    const sizeClasses = {
      'h-8 px-3 text-sm': size === 'sm',
      'h-10 px-4 text-sm': size === 'md',
      'h-12 px-6 text-base': size === 'lg',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantClasses,
          sizeClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }