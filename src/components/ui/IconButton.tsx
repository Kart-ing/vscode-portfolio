// src/components/ui/IconButton.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors',
          'text-[var(--textPrimary)] hover:bg-[var(--hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'h-6 w-6': size === 'sm',
            'h-8 w-8': size === 'md',
            'h-10 w-10': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

IconButton.displayName = 'IconButton'

export { IconButton }