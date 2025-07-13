'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { EditorArea } from './EditorArea'
import { SimulatedTerminal } from '@/components/terminal/SimulatedTerminal'
import { StatusBar } from './StatusBar'
import { FileSystemProvider } from '@/contexts/FileSystemContext'

interface VSCodeLayoutProps {
  className?: string
}

export function VSCodeLayout({ className }: VSCodeLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [terminalHeight, setTerminalHeight] = useState(300)
  const [isTerminalVisible, setIsTerminalVisible] = useState(true)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)

  const handleToggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible)
  }

  const handleToggleTerminal = () => {
    setIsTerminalVisible(!isTerminalVisible)
  }

  return (
    <FileSystemProvider>
      <div className={cn(
        'flex flex-col h-screen bg-[var(--background)] text-[var(--textPrimary)]',
        className
      )}>
        {/* Title Bar */}
        <TitleBar 
          onToggleSidebar={handleToggleSidebar}
          onToggleTerminal={handleToggleTerminal}
          isSidebarVisible={isSidebarVisible}
          isTerminalVisible={isTerminalVisible}
        />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {isSidebarVisible && (
            <Sidebar 
              width={sidebarWidth}
              isCollapsed={false}
              onToggle={() => {}}
              onResize={setSidebarWidth}
            />
          )}
          
          {/* Editor and Terminal Area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Editor Area - takes remaining space */}
            <div className="flex-1 overflow-hidden">
              <EditorArea />
            </div>
            
            {/* Terminal - fixed height when visible */}
            {isTerminalVisible && (
              <div 
                className="border-t border-[var(--border)]"
                style={{ height: `${terminalHeight}px` }}
              >
                <SimulatedTerminal 
                  height={terminalHeight}
                  onClose={() => setIsTerminalVisible(false)}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Status Bar */}
        <StatusBar 
          onToggleTerminal={handleToggleTerminal}
          isTerminalVisible={isTerminalVisible}
        />
      </div>
    </FileSystemProvider>
  )
} 