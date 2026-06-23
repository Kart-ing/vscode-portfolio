// src/contexts/ThemeContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { vsCodeTheme, Theme, ThemeMode } from '@/lib/theme'

interface ThemeContextType {
  theme: Theme
  mode: ThemeMode
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Browser-only: guard against any SSR/edge environment where storage APIs
    // aren't real (this also avoids a pre-existing dev-mode SSR crash).
    if (typeof window === 'undefined') return
    try {
      const savedTheme = window.localStorage?.getItem('vscode-portfolio-theme') as ThemeMode | null
      if (savedTheme) {
        setMode(savedTheme)
      } else {
        const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        setMode(systemPrefersDark ? 'dark' : 'light')
      }
    } catch {
      // Storage may be blocked (private mode, etc.) — fall back to default.
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage?.setItem('vscode-portfolio-theme', mode)
        } catch {
          /* ignore storage write failures */
        }
      }
      // Update CSS custom properties
      const root = document.documentElement
      const theme = vsCodeTheme[mode]
      
      // Set CSS variables
      Object.entries(theme).forEach(([key, value]) => {
        if (typeof value === 'string') {
          root.style.setProperty(`--${key}`, value)
        } else if (typeof value === 'object') {
          Object.entries(value).forEach(([subKey, subValue]) => {
            root.style.setProperty(`--${key}-${subKey}`, subValue)
          })
        }
      })
    }
  }, [mode, mounted])

  const toggleTheme = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark')
  }

  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ theme: vsCodeTheme[mode], mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}