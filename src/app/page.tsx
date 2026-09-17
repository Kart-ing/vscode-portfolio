"use client"

import { useEffect, useState, useRef } from 'react'
import { VSCodeLayout } from '@/components/layout/VSCodeLayout'

function MatrixLoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p < 100 ? p + Math.floor(Math.random() * 8 + 3) : 100))
    }, 60)
    const timeout = setTimeout(() => {
      setFadeOut(true)
    }, 650)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0e1a2b] transition-opacity duration-200 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ fontFamily: 'monospace' }}
    >
      {/* Matrix animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MatrixRain color="#007ACC" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-2xl md:text-3xl font-bold text-[#007ACC] mb-2 drop-shadow-lg animate-pulse text-center">
          Loading...
        </div>
        <div className="text-lg md:text-xl text-[#007ACC] mb-6 drop-shadow-lg text-center">
          Welcome to Portfolio
        </div>
        <div className="w-64 h-4 bg-[#1e2a3a] rounded-full overflow-hidden border border-[#007ACC] shadow">
          <div
            className="h-full bg-[#007ACC] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function MatrixRain({ color = '#007ACC' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animationFrameId: number
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width
    canvas.height = height
    const fontSize = 14
    const columns = Math.floor(width / fontSize)
    const drops = Array(columns).fill(1)
    
    function draw() {
      if (!ctx) return
      ctx.fillStyle = 'rgba(14,26,43,0.1)'
      ctx.fillRect(0, 0, width, height)
      ctx.font = `${fontSize}px monospace`
      ctx.fillStyle = color
      ctx.globalAlpha = 0.3
      for (let i = 0; i < drops.length; i++) {
        // Use only 0's and 1's
        const text = Math.random() > 0.5 ? '0' : '1'
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)
        if (Math.random() > 0.98) {
          drops[i] = 0
        }
        drops[i]++
      }
      ctx.globalAlpha = 1
      animationFrameId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animationFrameId)
  }, [color])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

export default function Home() {
  const [showLoading, setShowLoading] = useState(true)
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('portfolio-loaded')) {
        setShowLoading(false)
        return
      }
      window.sessionStorage.setItem('portfolio-loaded', 'true')
    } catch {
      // Continue with the short first-load splash when storage is unavailable.
    }

    const timeout = setTimeout(() => setShowLoading(false), 900)
    return () => clearTimeout(timeout)
  }, [])
  return (
    <>
      {showLoading && <MatrixLoadingScreen />}
      <div className={showLoading ? 'pointer-events-none select-none' : ''}>
        <VSCodeLayout />
      </div>
    </>
  )
}
