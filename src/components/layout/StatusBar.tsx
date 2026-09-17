'use client'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, GitBranch } from 'lucide-react'
import { ROLE } from '@/lib/profile'

interface StatusBarProps {
  onToggleTerminal: () => void
  isTerminalVisible: boolean
}

export function StatusBar({ onToggleTerminal, isTerminalVisible }: StatusBarProps) {
  const { mode, toggleTheme } = useTheme()

  return (
    <div className="h-7 min-w-0 bg-[var(--statusBar)] border-t border-[var(--border)] flex items-center px-2 sm:px-3 text-xs text-[var(--textAccent)] select-none">
      {/* Live role widget */}
      <span className="flex min-w-0 items-center gap-1.5 mr-2 sm:mr-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="truncate font-medium">{ROLE}</span>
      </span>

      <span className="hidden md:flex items-center gap-1 mr-4 opacity-90">
        <GitBranch className="w-3 h-3" /> main
      </span>
      <span className="mr-4 hidden sm:inline">UTF-8</span>
      <span className="mr-4 hidden sm:inline">LF</span>

      {/* Right side */}
      <button
        className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--hover)] transition-colors"
        onClick={toggleTheme}
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
      >
        {mode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{mode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

      <button
        className={cn(
          'ml-1 shrink-0 px-2 py-1 rounded hover:bg-[var(--hover)] transition-colors',
          isTerminalVisible ? 'bg-[var(--active)]' : ''
        )}
        onClick={onToggleTerminal}
      >
        {isTerminalVisible ? 'Hide Terminal' : 'Show Terminal'}
      </button>
    </div>
  )
}
