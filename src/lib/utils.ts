// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Typography utility
export const typography = {
  heading: {
    h1: 'text-2xl font-bold text-[var(--textPrimary)]',
    h2: 'text-xl font-semibold text-[var(--textPrimary)]',
    h3: 'text-lg font-medium text-[var(--textPrimary)]',
    h4: 'text-base font-medium text-[var(--textPrimary)]',
  },
  body: {
    large: 'text-base text-[var(--textPrimary)]',
    medium: 'text-sm text-[var(--textPrimary)]',
    small: 'text-xs text-[var(--textSecondary)]',
  },
  code: {
    inline: 'font-mono text-sm bg-[var(--surface)] px-1 py-0.5 rounded',
    block: 'font-mono text-sm bg-[var(--surface)] p-4 rounded border border-[var(--border)]',
  }
}

// Spacing utility
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
}