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
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('vscode-portfolio-theme') as ThemeMode
    if (savedTheme) {
      setMode(savedTheme)
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setMode(systemPrefersDark ? 'dark' : 'light')
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('vscode-portfolio-theme', mode)
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