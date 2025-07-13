'use client'

import { cn } from '@/lib/utils'

interface StatusBarProps {
  onToggleTerminal: () => void
  isTerminalVisible: boolean
}

export function StatusBar({ onToggleTerminal, isTerminalVisible }: StatusBarProps) {
  return (
    <div className="h-7 bg-[var(--statusBar)] border-t border-[var(--border)] flex items-center px-4 text-xs text-[var(--textAccent)] select-none">
      <span className="mr-4">VS Code Portfolio</span>
      <span className="mr-4">Ln 1, Col 1</span>
      <span className="mr-4">Spaces: 2</span>
      <span className="mr-4">UTF-8</span>
      <span className="mr-4">LF</span>
      <button
        className={cn(
          'ml-auto px-2 py-1 rounded hover:bg-[var(--hover)] transition-colors',
          isTerminalVisible ? 'bg-[var(--active)]' : ''
        )}
        onClick={onToggleTerminal}
      >
        {isTerminalVisible ? 'Hide Terminal' : 'Show Terminal'}
      </button>
    </div>
  )
} 