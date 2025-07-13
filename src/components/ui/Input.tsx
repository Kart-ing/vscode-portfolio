// src/components/ui/Input.tsx
import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded border border-[var(--border)] bg-[var(--background)]',
          'px-3 py-2 text-sm text-[var(--textPrimary)] placeholder:text-[var(--textMuted)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--focus)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }