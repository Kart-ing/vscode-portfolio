'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Modal } from '@/components/ui/Modal'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { 
  Minus, 
  Square, 
  X, 
  Settings,
  Search,
  GitBranch,
  Puzzle,
  ChevronDown,
  FileText,
  FolderOpen,
  Save,
  Copy,
  Clipboard,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Terminal as TerminalIcon,
  HelpCircle,
  ExternalLink,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'

interface TitleBarProps {
  onToggleSidebar?: () => void
  onToggleTerminal?: () => void
  isSidebarVisible?: boolean
  isTerminalVisible?: boolean
}

export function TitleBar({ 
  onToggleSidebar, 
  onToggleTerminal, 
  isSidebarVisible = true, 
  isTerminalVisible = true 
}: TitleBarProps) {
  const { state, dispatch, findFile } = useFileSystem()
  const [showExitModal, setShowExitModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const handleMinimize = () => {
    console.log('Minimize clicked')
  }

  const handleMaximize = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleClose = () => {
    setShowExitModal(true)
  }

  const handleDownloadResume = () => {
    // Create a simple text-based resume since we don't have a PDF
    const resumeContent = `Kartikey Pandey - Resume

EDUCATION
B.Tech in Computer Science and Engineering
Vellore Institute of Technology, Vellore
2020 - 2024

SKILLS
• Programming Languages: Python, JavaScript, TypeScript, Java, C++
• Web Technologies: React, Next.js, Node.js, HTML, CSS, Tailwind CSS
• Databases: MongoDB, PostgreSQL, MySQL
• Tools & Platforms: Git, Docker, AWS, VS Code
• Frameworks: Django, Express.js, FastAPI

EXPERIENCE
Software Engineer Intern - Multiple companies
• Developed full-stack web applications
• Worked with modern frameworks and technologies
• Collaborated in agile development teams

PROJECTS
• Reality Rush - VR Game Development
• EyeSnap - Computer Vision Application
• Project Elementals - Game Development
• And many more innovative projects

CONTACT
Email: kartikey.pandey@example.com
GitHub: github.com/kartikeypandey
LinkedIn: linkedin.com/in/kartikeypandey`

    const blob = new Blob([resumeContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Kartikey_Pandey_Resume.txt'
    link.click()
    URL.revokeObjectURL(url)
    setShowExitModal(false)
  }

  const toggleMenu = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName)
  }

  const closeAllMenus = () => {
    setActiveMenu(null)
  }

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenu && !menuRefs.current[activeMenu]?.contains(event.target as Node)) {
        closeAllMenus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeMenu])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const isCtrl = event.ctrlKey || event.metaKey
      const isShift = event.shiftKey

      if (isCtrl) {
        switch (event.key) {
          case 'n':
            event.preventDefault()
            handleNewFile()
            break
          case 'o':
            event.preventDefault()
            alert('Open folder functionality would be implemented')
            break
          case 's':
            event.preventDefault()
            if (isShift) {
              handleSaveAs()
            } else {
              handleSave()
            }
            break
          case 'z':
            event.preventDefault()
            if (isShift) {
              handleRedo()
            } else {
              handleUndo()
            }
            break
          case 'y':
            event.preventDefault()
            handleRedo()
            break
          case 'x':
            event.preventDefault()
            handleCut()
            break
          case 'c':
            event.preventDefault()
            handleCopy()
            break
          case 'v':
            event.preventDefault()
            handlePaste()
            break
          case 'b':
            event.preventDefault()
            handleToggleSidebar()
            break
          case '`':
            event.preventDefault()
            handleToggleTerminal()
            break
          case '=':
          case '+':
            event.preventDefault()
            handleZoomIn()
            break
          case '-':
            event.preventDefault()
            handleZoomOut()
            break
        }
      }

      // Escape key to close menus
      if (event.key === 'Escape') {
        closeAllMenus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // File menu actions
  const handleNewFile = () => {
    const fileName = `new-file-${Date.now()}.js`
    const newFile = {
      id: `file-${Date.now()}`,
      name: fileName,
      type: 'file' as const,
      path: `/${fileName}`,
      content: `// New file created at ${new Date().toLocaleString()}
console.log('Hello from new file!');

// You can write JavaScript code here
function example() {
  return "This is a new JavaScript file!";
}

module.exports = { example };`,
      language: 'javascript'
    }
    dispatch({ type: 'ADD_FILE', payload: { parentId: 'root', file: newFile } })
    dispatch({ type: 'OPEN_FILE', payload: { id: newFile.id } })
  }

  const handleSave = () => {
    const activeFile = state.activeFile ? findFile(state.activeFile) : null
    if (activeFile) {
      // In a real app, this would save to the file system
      console.log(`Saving file: ${activeFile.name}`)
      alert(`File "${activeFile.name}" saved successfully!`)
    } else {
      alert('No active file to save')
    }
  }

  const handleSaveAs = () => {
    const activeFile = state.activeFile ? findFile(state.activeFile) : null
    if (activeFile) {
      const newName = prompt('Enter new file name:', activeFile.name)
      if (newName && newName.trim()) {
        dispatch({ type: 'RENAME_NODE', payload: { id: activeFile.id, newName: newName.trim() } })
      }
    } else {
      alert('No active file to save as')
    }
  }

  // Edit menu actions
  const handleUndo = () => {
    // In a real app, this would integrate with Monaco Editor's undo
    console.log('Undo action')
    alert('Undo functionality would be integrated with the editor')
  }

  const handleRedo = () => {
    console.log('Redo action')
    alert('Redo functionality would be integrated with the editor')
  }

  const handleCut = () => {
    navigator.clipboard.writeText('').then(() => {
      console.log('Cut action')
      alert('Cut functionality would be integrated with the editor')
    })
  }

  const handleCopy = () => {
    const activeFile = state.activeFile ? findFile(state.activeFile) : null
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content || '').then(() => {
        console.log('Copied file content to clipboard')
        alert('File content copied to clipboard!')
      })
    } else {
      alert('No active file to copy')
    }
  }

  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => {
      console.log('Paste action:', text)
      alert('Paste functionality would be integrated with the editor')
    }).catch(() => {
      alert('No text in clipboard to paste')
    })
  }

  // View menu actions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200))
    document.documentElement.style.fontSize = `${16 * (zoomLevel + 10) / 100}px`
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50))
    document.documentElement.style.fontSize = `${16 * (zoomLevel - 10) / 100}px`
  }

  const handleToggleSidebar = () => {
    onToggleSidebar?.()
  }

  const handleToggleTerminal = () => {
    onToggleTerminal?.()
  }

  // Terminal menu actions
  const handleNewTerminal = () => {
    console.log('New terminal requested')
    alert('New terminal would be created')
  }

  const handleClearTerminal = () => {
    console.log('Clear terminal requested')
    alert('Terminal would be cleared')
  }

  const handleRunPython = () => {
    console.log('Run Python script')
    alert('Python script execution would be integrated with the terminal')
  }

  const handleRunNode = () => {
    console.log('Run Node script')
    alert('Node.js script execution would be integrated with the terminal')
  }

  const menuItems = {
    file: [
      { label: 'New File', icon: FileText, action: handleNewFile, shortcut: 'Ctrl+N' },
      { label: 'Open Folder', icon: FolderOpen, action: () => alert('Open folder functionality would be implemented'), shortcut: 'Ctrl+O' },
      { label: 'Save', icon: Save, action: handleSave, shortcut: 'Ctrl+S' },
      { label: 'Save As...', icon: Save, action: handleSaveAs, shortcut: 'Ctrl+Shift+S' },
      { separator: true },
      { label: 'Download Resume', icon: Download, action: handleDownloadResume },
      { separator: true },
      { label: 'Exit', icon: X, action: handleClose }
    ],
    edit: [
      { label: 'Undo', icon: Undo, action: handleUndo, shortcut: 'Ctrl+Z' },
      { label: 'Redo', icon: Redo, action: handleRedo, shortcut: 'Ctrl+Y' },
      { separator: true },
      { label: 'Cut', icon: Copy, action: handleCut, shortcut: 'Ctrl+X' },
      { label: 'Copy', icon: Copy, action: handleCopy, shortcut: 'Ctrl+C' },
      { label: 'Paste', icon: Clipboard, action: handlePaste, shortcut: 'Ctrl+V' }
    ],
    view: [
      { label: 'Zoom In', icon: ZoomIn, action: handleZoomIn, shortcut: 'Ctrl+=' },
      { label: 'Zoom Out', icon: ZoomOut, action: handleZoomOut, shortcut: 'Ctrl+-' },
      { separator: true },
      { label: `Toggle Sidebar`, icon: isSidebarVisible ? EyeOff : Eye, action: handleToggleSidebar, shortcut: 'Ctrl+B' },
      { label: `Toggle Terminal`, icon: isTerminalVisible ? EyeOff : Eye, action: handleToggleTerminal, shortcut: 'Ctrl+`' }
    ],
    terminal: [
      { label: 'New Terminal', icon: TerminalIcon, action: handleNewTerminal, shortcut: 'Ctrl+Shift+`' },
      { label: 'Clear Terminal', icon: TerminalIcon, action: handleClearTerminal },
      { separator: true },
      { label: 'Run Python Script', icon: TerminalIcon, action: handleRunPython },
      { label: 'Run Node Script', icon: TerminalIcon, action: handleRunNode }
    ],
    help: [
      { label: 'Documentation', icon: HelpCircle, action: () => window.open('https://github.com/kartikeypandey', '_blank') },
      { label: 'GitHub Profile', icon: ExternalLink, action: () => window.open('https://github.com/kartikeypandey', '_blank') },
      { separator: true },
      { label: 'About Portfolio', icon: HelpCircle, action: () => alert('This is Kartikey Pandey\'s interactive portfolio built with Next.js, TypeScript, and Monaco Editor!\n\nFeatures:\n• VS Code-like interface\n• File system with markdown preview\n• Interactive terminal\n• Real-time editing\n• Responsive design\n\nKeyboard Shortcuts:\n• Ctrl+N: New File\n• Ctrl+S: Save\n• Ctrl+B: Toggle Sidebar\n• Ctrl+`: Toggle Terminal\n• Ctrl+=: Zoom In\n• Ctrl+-: Zoom Out') }
    ]
  }

  const renderMenuItem = (item: any, index: number) => {
    if (item.separator) {
      return <div key={index} className="h-px bg-[var(--border)] my-1" />
    }

    const Icon = item.icon
    return (
      <button
        key={index}
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[var(--hover)] text-left"
        onClick={() => {
          item.action()
          closeAllMenus()
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span>{item.label}</span>
        </div>
        {item.shortcut && (
          <span className="text-xs text-[var(--textMuted)]">{item.shortcut}</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between h-10 bg-[var(--titleBar)] border-b border-[var(--border)] select-none">
      {/* Left side - App branding and menu */}
      <div className="flex items-center h-full">
        <div className="flex items-center px-4 h-full">
          <span className="text-sm font-medium text-[var(--textPrimary)]">
            Kartikey Pandey - Portfolio
          </span>
        </div>
        
        {/* Menu items */}
        <div className="flex items-center h-full">
          {Object.entries(menuItems).map(([menuName, items]) => (
            <div key={menuName} className="relative" ref={(el) => { menuRefs.current[menuName] = el }}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-full px-3 rounded-none hover:bg-[var(--hover)] capitalize"
                onClick={() => toggleMenu(menuName)}
              >
                {menuName}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              
              {activeMenu === menuName && (
                <div className="absolute top-full left-0 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg z-50 min-w-48 py-1">
                  {items.map(renderMenuItem)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center - Current file/project info */}
      <div className="flex items-center h-full">
        <div className="flex items-center gap-2 px-4">
          <GitBranch className="w-4 h-4 text-[var(--textSecondary)]" />
          <span className="text-xs text-[var(--textSecondary)]">main</span>
          <Search className="w-4 h-4 text-[var(--textSecondary)]" />
          <Puzzle className="w-4 h-4 text-[var(--textSecondary)]" />
        </div>
      </div>

      {/* Right side - Window controls */}
      <div className="flex items-center h-full">
        <IconButton
          size="sm"
          className="h-full w-12 rounded-none hover:bg-[var(--hover)]"
          onClick={() => window.open('https://github.com/kartikeypandey', '_blank')}
        >
          <Settings className="w-4 h-4" />
        </IconButton>
        
        {/* Window controls */}
        <div className="flex items-center h-full">
          <IconButton
            size="sm"
            className="h-full w-12 rounded-none hover:bg-[var(--hover)]"
            onClick={handleMinimize}
          >
            <Minus className="w-4 h-4" />
          </IconButton>
          <IconButton
            size="sm"
            className="h-full w-12 rounded-none hover:bg-[var(--hover)]"
            onClick={handleMaximize}
          >
            <Square className="w-4 h-4" />
          </IconButton>
          <IconButton
            size="sm"
            className="h-full w-12 rounded-none hover:bg-red-600 hover:text-white"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>
      </div>
      
      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onDownloadResume={handleDownloadResume}
      />
    </div>
  )
} 