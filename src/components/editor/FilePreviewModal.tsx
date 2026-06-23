'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Code2, Eye, FileText, X } from 'lucide-react'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/IconButton'
import { MarkdownPreview } from './MarkdownPreview'
import { MonacoEditor } from './MonacoEditor'

type ViewMode = 'preview' | 'edit'

/**
 * Fullscreen file viewer modal.
 *
 * Driven entirely off `state.activeFile` from FileSystemContext. When a file is
 * active it shows a ~90vw x 90vh centered card with a dimmed/blurred backdrop.
 * The header has a Preview/Edit segmented toggle and an X close button.
 * Closing (X, Esc, backdrop click) clears the active file.
 *
 * Edits are in-memory only via the existing UPDATE_FILE_CONTENT reducer path
 * (MonacoEditor handles dispatch itself); a refresh resets them.
 */
export function FilePreviewModal() {
  const { state, dispatch, findFile } = useFileSystem()

  const activeId = state.activeFile
  const file = activeId ? findFile(activeId) : null
  const isMarkdown = file?.language === 'markdown'

  const [mode, setMode] = useState<ViewMode>('preview')

  const cardRef = useRef<HTMLDivElement>(null)
  // Remember whatever was focused before the modal opened so we can restore it.
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Non-markdown files have no meaningful preview, so default them to the editor.
  useEffect(() => {
    if (!activeId) return
    setMode(isMarkdown ? 'preview' : 'edit')
  }, [activeId, isMarkdown])

  const close = useCallback(() => {
    if (!activeId) return
    // Reducer falls activeFile back to another open file (or null) on close.
    dispatch({ type: 'CLOSE_FILE', payload: { id: activeId } })
  }, [activeId, dispatch])

  // Esc to close + focus management. Guard Esc so it doesn't fire while the
  // user is typing inside the Monaco editor (let Monaco own that keystroke).
  useEffect(() => {
    if (!activeId) return

    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null

    // Focus the card on open so screen readers land in the dialog.
    cardRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      const inEditor = !!target?.closest('.monaco-editor')
      if (inEditor) return
      e.preventDefault()
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Restore focus to wherever it was before the modal opened.
      previouslyFocused.current?.focus?.()
    }
  }, [activeId, close])

  const segmentBtn = useCallback(
    (target: ViewMode, label: string, Icon: typeof Eye) => (
      <button
        type="button"
        onClick={() => setMode(target)}
        aria-pressed={mode === target}
        title={label}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]',
          mode === target
            ? 'bg-[var(--editor)] text-[var(--textPrimary)] shadow-sm'
            : 'text-[var(--textSecondary)] hover:text-[var(--textPrimary)] hover:bg-[var(--hover)]'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    ),
    [mode]
  )

  const fileName = file?.name ?? 'Untitled'
  const content = useMemo(() => file?.content ?? '', [file?.content])

  return (
    <AnimatePresence>
      {activeId && (
        <motion.div
          key="file-preview-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Card */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${fileName} preview`}
            tabIndex={-1}
            className={cn(
              'relative flex flex-col overflow-hidden outline-none',
              'bg-[var(--editor)] border border-[var(--border)] rounded-lg shadow-2xl'
            )}
            style={{ width: '90vw', height: '90vh', maxWidth: 1400 }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (VS Code editor tab strip vibe) */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[var(--textSecondary)] shrink-0" />
                <span className="text-sm text-[var(--textPrimary)] truncate">
                  {fileName}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Segmented Preview | Edit toggle (only meaningful for markdown) */}
                {isMarkdown && (
                  <div className="flex items-center gap-1 p-0.5 rounded-md bg-[var(--background)] border border-[var(--border)]">
                    {segmentBtn('preview', 'Preview', Eye)}
                    {segmentBtn('edit', 'Edit', Code2)}
                  </div>
                )}
                <IconButton
                  size="sm"
                  onClick={close}
                  aria-label="Close preview"
                  title="Close (Esc)"
                  className="text-[var(--textSecondary)] hover:text-[var(--textPrimary)]"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
            </div>

            {/* Body */}
            <div className="relative flex-1 min-h-0">
              {mode === 'preview' && isMarkdown ? (
                <div className="h-full overflow-auto">
                  <MarkdownPreview content={content} />
                </div>
              ) : (
                <>
                  <MonacoEditor className="h-full" />
                  {/* Local draft hint */}
                  <div className="pointer-events-none absolute bottom-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--surface)]/90 border border-[var(--border)] text-[var(--textSecondary)] shadow-sm backdrop-blur-sm">
                      <span className="text-[var(--accent)]">&#9679;</span>
                      Local draft &mdash; refresh resets
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
