'use client'

import { useState, useRef, useEffect } from 'react'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { cn } from '@/lib/utils'
import { MonacoEditor } from './MonacoEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { IconButton } from '@/components/ui/IconButton'
import { Eye, EyeOff, Split } from 'lucide-react'

interface SplitEditorProps {
  className?: string
}

export function SplitEditor({ className }: SplitEditorProps) {
  const { state, findFile } = useFileSystem()
  const [showPreview, setShowPreview] = useState(true)
  const [splitPosition, setSplitPosition] = useState(50) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeFile = state.activeFile ? findFile(state.activeFile) : null
  const isMarkdownFile = activeFile?.language === 'markdown'

  // Handle splitter drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100
      
      // Limit split position between 20% and 80%
      const clampedPosition = Math.max(20, Math.min(80, newPosition))
      setSplitPosition(clampedPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // If not a markdown file, show only the editor
  if (!isMarkdownFile) {
    return <MonacoEditor className={className} />
  }

  return (
    <div 
      ref={containerRef}
      className={cn('flex h-full relative', className)}
    >
      {/* Editor Panel */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ width: showPreview ? `${splitPosition}%` : '100%' }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
          <span className="text-sm text-[var(--textSecondary)]">
            {activeFile?.name} (Editor)
          </span>
          <div className="flex items-center gap-2">
            <IconButton
              onClick={() => setShowPreview(!showPreview)}
              className="w-6 h-6"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </IconButton>
          </div>
        </div>
        <div className="h-[calc(100%-40px)]">
          <MonacoEditor />
        </div>
      </div>

      {/* Splitter */}
      {showPreview && (
        <div
          className="w-1 bg-[var(--border)] cursor-col-resize hover:bg-[var(--accent)] transition-colors relative"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <Split className="w-3 h-3 text-[var(--textSecondary)]" />
          </div>
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <div 
          className="flex-1 overflow-hidden"
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-sm text-[var(--textSecondary)]">
              {activeFile?.name} (Preview)
            </span>
            <div className="flex items-center gap-2">
              <IconButton
                onClick={() => setShowPreview(false)}
                className="w-6 h-6"
                title="Hide Preview"
              >
                <EyeOff className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
          <div className="h-[calc(100%-40px)]">
            <MarkdownPreview content={activeFile?.content || ''} />
          </div>
        </div>
      )}
    </div>
  )
} 