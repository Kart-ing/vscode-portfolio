'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/IconButton'
import { Files, Search, GitBranch, Bug } from 'lucide-react'
import { FileExplorer } from '@/components/file-explorer/FileExplorer'

interface SidebarProps {
  width: number
  isCollapsed: boolean
  onToggle: () => void
  onResize: (width: number) => void
}

export function Sidebar({ width, isCollapsed, onToggle, onResize }: SidebarProps) {
  const [activeView, setActiveView] = useState<'explorer' | 'search' | 'git' | 'debug'>('explorer')

  const handleResize = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX)
      onResize(Math.max(200, Math.min(400, newWidth)))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleGitClick = () => {
    window.open('https://github.com/kartikeypandey', '_blank')
  }

  const handleDebugClick = () => {
    alert('Real devs debug in production! 🚀\n\nBut seriously, this is just a portfolio demo. In a real app, you\'d have proper debugging tools here.')
  }

  return (
    <div 
      className="flex bg-[var(--sidebar)] border-r border-[var(--border)] vscode-sidebar"
      style={{ width: `${width}px` }}
    >
      {/* Activity Bar */}
      <div className="flex flex-col items-center py-2 border-r border-[var(--border)] w-12">
        <IconButton
          size="sm"
          className={cn(
            "w-10 h-10 mb-2",
            activeView === 'explorer' && "bg-[var(--active)]"
          )}
          onClick={() => setActiveView('explorer')}
        >
          <Files className="w-5 h-5" />
        </IconButton>
        <IconButton
          size="sm"
          className={cn(
            "w-10 h-10 mb-2",
            activeView === 'search' && "bg-[var(--active)]"
          )}
          onClick={() => setActiveView('search')}
        >
          <Search className="w-5 h-5" />
        </IconButton>
        <IconButton
          size="sm"
          className={cn(
            "w-10 h-10 mb-2",
            activeView === 'git' && "bg-[var(--active)]"
          )}
          onClick={() => setActiveView('git')}
        >
          <GitBranch className="w-5 h-5" />
        </IconButton>
        <IconButton
          size="sm"
          className={cn(
            "w-10 h-10",
            activeView === 'debug' && "bg-[var(--active)]"
          )}
          onClick={() => setActiveView('debug')}
        >
          <Bug className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center px-4 py-2 border-b border-[var(--border)]">
          <span className="text-sm font-medium text-[var(--textPrimary)] uppercase tracking-wide">
            {activeView}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeView === 'explorer' && <FileExplorer />}
          
          {activeView === 'search' && (
            <div className="space-y-2">
              <div className="text-sm text-[var(--textSecondary)]">SEARCH</div>
              <div className="text-xs text-[var(--textMuted)]">Search in files</div>
            </div>
          )}
          
          {activeView === 'git' && (
            <div className="p-4 space-y-4">
              <div className="text-sm text-[var(--textSecondary)]">SOURCE CONTROL</div>
              <div className="text-xs text-[var(--textMuted)] mb-4">Connect to GitHub</div>
              <button
                onClick={handleGitClick}
                className="w-full px-3 py-2 bg-[var(--primary)] text-white rounded text-sm hover:bg-[var(--secondary)] transition-colors"
              >
                View GitHub Profile
              </button>
              <div className="text-xs text-[var(--textMuted)] mt-2">
                Click to open my GitHub profile in a new tab
              </div>
            </div>
          )}
          
          {activeView === 'debug' && (
            <div className="p-4 space-y-4">
              <div className="text-sm text-[var(--textSecondary)]">RUN AND DEBUG</div>
              <div className="text-xs text-[var(--textMuted)] mb-4">Debugging tools</div>
              <button
                onClick={handleDebugClick}
                className="w-full px-3 py-2 bg-[var(--primary)] text-white rounded text-sm hover:bg-[var(--secondary)] transition-colors"
              >
                Start Debugging
              </button>
              <div className="text-xs text-[var(--textMuted)] mt-2">
                Click to see a developer joke 😄
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 resize-handle"
        onMouseDown={handleResize}
      />
    </div>
  )
} 