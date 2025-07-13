// src/components/ui/Panel.tsx
import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  resizable?: boolean
  direction?: 'horizontal' | 'vertical'
}

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, resizable = false, direction = 'vertical', ...props }, ref) => {
    return (
      <div
        className={cn(
          'bg-[var(--surface)] border-[var(--border)]',
          {
            'border-r': resizable && direction === 'horizontal',
            'border-b': resizable && direction === 'vertical',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Panel.displayName = 'Panel'

export { Panel }