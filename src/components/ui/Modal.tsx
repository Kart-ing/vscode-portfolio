'use client'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Download, X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onDownloadResume: () => void
}

export function Modal({ isOpen, onClose, onDownloadResume }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--textPrimary)]">
            Leaving so soon? 😢
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--textSecondary)] hover:text-[var(--textPrimary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-[var(--textSecondary)] mb-6">
          Hope you enjoyed exploring Kartikey's Portfolio! Before you go, would you like to download his resume?
        </p>
        
        <div className="flex gap-3">
          <Button
            onClick={onDownloadResume}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Resume
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  )
} 