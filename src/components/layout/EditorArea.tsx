'use client'

import { FileText } from 'lucide-react'
import { FilePreviewModal } from '@/components/editor/FilePreviewModal'

export function EditorArea() {
  return (
    <div className="relative flex-1 min-h-0 bg-[var(--editor)]">
      {/* Empty state — shown behind/instead of the modal when nothing is open */}
      <div className="flex h-full flex-col items-center justify-center gap-3 select-none">
        <FileText className="w-12 h-12 text-[var(--textMuted)]" />
        <p className="text-sm text-[var(--textSecondary)]">
          Open a file from the explorer
        </p>
        <p className="text-xs text-[var(--textMuted)]">
          Pick a file in the sidebar to preview it here
        </p>
      </div>

      {/*
        Always mounted so its internal AnimatePresence can play the exit
        (fade + scale-out) animation. It renders nothing when no file is active.
      */}
      <FilePreviewModal />
    </div>
  )
}
