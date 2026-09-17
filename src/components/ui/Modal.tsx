'use client'

import { Button } from './Button'
import { ExternalLink, X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onViewLinkedIn: () => void
}

export function Modal({ isOpen, onClose, onViewLinkedIn }: ModalProps) {
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
          Hope you enjoyed exploring Kartikey's portfolio. You can continue on LinkedIn.
        </p>

        <div className="flex gap-3">
          <Button
            onClick={onViewLinkedIn}
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View LinkedIn
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
