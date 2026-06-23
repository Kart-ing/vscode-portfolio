"use client";

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/IconButton'
import { X, Trash2 } from 'lucide-react'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { loadPyodideOnce, runPython, getPyStatus } from '@/lib/pyodide'

interface TerminalProps {
  height: number
  onClose: () => void
}

interface Command {
  name: string
  description: string
  usage: string
  execute: (args: string[]) => string
}

interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'prompt'
  content: string
  timestamp: Date
}

export function SimulatedTerminal({ height, onClose }: TerminalProps) {
  const { state, dispatch, findFile } = useFileSystem()
  const [currentDirectory, setCurrentDirectory] = useState('/')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentInput, setCurrentInput] = useState('')
  const [pythonRepl, setPythonRepl] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome-1',
      type: 'output',
      content: 'Welcome to Kartikey\'s Portfolio Terminal!',
      timestamp: new Date()
    },
    {
      id: 'welcome-2',
      type: 'output',
      content: 'Type "help" for commands. Try: whoami · projects · open recompress · python fib.py',
      timestamp: new Date()
    },
    {
      id: 'welcome-3',
      type: 'output',
      content: '',
      timestamp: new Date()
    }
  ])
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Helper function to find file by path
  const findFileByPath = (path: string) => {
    if (path === '/') {
      return { type: 'directory', children: state.files }
    }
    
    const pathParts = path.split('/').filter(Boolean)
    let current = state.files
    
    for (const part of pathParts) {
      const found = current.find(node => node.name === part)
      if (!found) {
        return null
      }
      if (found.type === 'file') {
        return found
      }
      if (found.type === 'folder' && found.children) {
        current = found.children
      } else {
        return null
      }
    }
    
    return { type: 'directory', children: current }
  }

  const commands: Record<string, Command> = {
    ls: {
      name: 'ls',
      description: 'List directory contents',
      usage: 'ls [OPTION]... [FILE]...',
      execute: (args) => {
        const path = args[0] || currentDirectory
        const dir = findFileByPath(path)
        
        if (!dir) {
          return `ls: cannot access '${path}': No such file or directory`
        }
        
        if (dir.type === 'file') {
          return path
        }
        
        const items = dir.children || []
        if (items.length === 0) return ''
        
        return items.map(item => {
          const icon = item.type === 'folder' ? '📁' : '📄'
          return `${icon} ${item.name}`
        }).join('  ')
      }
    },

    cd: {
      name: 'cd',
      description: 'Change directory',
      usage: 'cd [DIRECTORY]',
      execute: (args) => {
        const target = args[0] || '/'
        
        if (target === '..') {
          const parent = currentDirectory.split('/').slice(0, -1).join('/') || '/'
          setCurrentDirectory(parent)
          return ''
        }
        
        if (target === '~' || target === '/') {
          setCurrentDirectory('/')
          return ''
        }
        
        const targetPath = target.startsWith('/') ? target : `${currentDirectory}/${target}`.replace('//', '/')
        const dir = findFileByPath(targetPath)
        
        if (dir && 'children' in dir) {
          setCurrentDirectory(targetPath)
          return ''
        }
        
        return `cd: ${target}: No such file or directory`
      }
    },

    pwd: {
      name: 'pwd',
      description: 'Print working directory',
      usage: 'pwd',
      execute: () => currentDirectory
    },

    cat: {
      name: 'cat',
      description: 'Concatenate and display files',
      usage: 'cat [FILE]...',
      execute: (args) => {
        if (args.length === 0) return 'cat: missing file operand'
        
        const filePath = args[0]
        const fullPath = filePath.startsWith('/') ? filePath : `${currentDirectory}/${filePath}`.replace('//', '/')
        const pathParts = fullPath.split('/').filter(Boolean)
        
        if (pathParts.length === 0) return 'cat: invalid path'
        
        const fileName = pathParts[pathParts.length - 1]
        const dirPath = pathParts.slice(0, -1)
        
        let current = state.files
        for (const part of dirPath) {
          const found = current.find(node => node.name === part && node.type === 'folder')
          if (!found || !found.children) {
            return `cat: ${filePath}: No such file or directory`
          }
          current = found.children
        }
        
        const file = current.find(node => node.name === fileName && node.type === 'file')
        if (!file) {
          return `cat: ${filePath}: No such file or directory`
        }
        
        return file.content || ''
      }
    },

    mkdir: {
      name: 'mkdir',
      description: 'Make directories',
      usage: 'mkdir [OPTION]... DIRECTORY...',
      execute: (args) => {
        if (args.length === 0) return 'mkdir: missing operand'
        
        const dirName = args[0]
        const newFolder = {
          id: `folder-${Date.now()}`,
          name: dirName,
          type: 'folder' as const,
          path: `/${dirName}`,
          isOpen: false,
          children: []
        }
        
        // Find the current directory in the file system
        if (currentDirectory === '/') {
          dispatch({ type: 'ADD_FOLDER', payload: { parentId: 'root', folder: newFolder } })
        } else {
          const pathParts = currentDirectory.split('/').filter(Boolean)
          let current = state.files
          let parentId = 'root'
          
          for (const part of pathParts) {
            const found = current.find(node => node.name === part && node.type === 'folder')
            if (!found) {
              return `mkdir: ${currentDirectory}: No such directory`
            }
            parentId = found.id
            current = found.children || []
          }
          
          dispatch({ type: 'ADD_FOLDER', payload: { parentId, folder: newFolder } })
        }
        
        return ''
      }
    },

    touch: {
      name: 'touch',
      description: 'Create empty files',
      usage: 'touch [FILE]...',
      execute: (args) => {
        if (args.length === 0) return 'touch: missing file operand'
        
        const fileName = args[0]
        const newFile = {
          id: `file-${Date.now()}`,
          name: fileName,
          type: 'file' as const,
          path: `/${fileName}`,
          content: '',
          language: fileName.endsWith('.js') ? 'javascript' : 
                   fileName.endsWith('.ts') ? 'typescript' : 
                   fileName.endsWith('.py') ? 'python' : 
                   fileName.endsWith('.md') ? 'markdown' : 'text'
        }
        
        // Find the current directory in the file system
        if (currentDirectory === '/') {
          dispatch({ type: 'ADD_FILE', payload: { parentId: 'root', file: newFile } })
        } else {
          const pathParts = currentDirectory.split('/').filter(Boolean)
          let current = state.files
          let parentId = 'root'
          
          for (const part of pathParts) {
            const found = current.find(node => node.name === part && node.type === 'folder')
            if (!found) {
              return `touch: ${currentDirectory}: No such directory`
            }
            parentId = found.id
            current = found.children || []
          }
          
          dispatch({ type: 'ADD_FILE', payload: { parentId, file: newFile } })
        }
        
        return ''
      }
    },

    rm: {
      name: 'rm',
      description: 'Remove files or directories',
      usage: 'rm [OPTION]... FILE...',
      execute: (args) => {
        if (args.length === 0) return 'rm: missing operand'
        
        const fileName = args[0]
        const fullPath = fileName.startsWith('/') ? fileName : `${currentDirectory}/${fileName}`.replace('//', '/')
        const pathParts = fullPath.split('/').filter(Boolean)
        
        if (pathParts.length === 0) return 'rm: invalid path'
        
        const targetName = pathParts[pathParts.length - 1]
        const dirPath = pathParts.slice(0, -1)
        
        let current = state.files
        let parentId = 'root'
        
        for (const part of dirPath) {
          const found = current.find(node => node.name === part && node.type === 'folder')
          if (!found || !found.children) {
            return `rm: ${fileName}: No such file or directory`
          }
          parentId = found.id
          current = found.children
        }
        
        const target = current.find(node => node.name === targetName)
        if (!target) {
          return `rm: ${fileName}: No such file or directory`
        }
        
        dispatch({ type: 'DELETE_NODE', payload: { id: target.id } })
        return ''
      }
    },

    echo: {
      name: 'echo',
      description: 'Display a line of text',
      usage: 'echo [STRING]...',
      execute: (args) => args.join(' ')
    },

    clear: {
      name: 'clear',
      description: 'Clear the terminal screen',
      usage: 'clear',
      execute: () => {
        setLines([])
        return ''
      }
    },

    whoami: {
      name: 'whoami',
      description: 'Print effective user ID',
      usage: 'whoami',
      execute: () => 'Kartikey Pandey — Founding Engineer @ Raya Health (HF0 W26). 10x hackathon winner · ex-NASA · ex-Intel.'
    },

    date: {
      name: 'date',
      description: 'Print or set the system date and time',
      usage: 'date',
      execute: () => new Date().toString()
    },

    help: {
      name: 'help',
      description: 'Show available commands',
      usage: 'help',
      execute: () => {
        const commandList = Object.values(commands)
          .map(cmd => `${cmd.name.padEnd(15)} - ${cmd.description}`)
          .join('\n')
        return `Available commands:\n\n${commandList}\n\nType 'help <command>' for more information.`
      }
    },

    neofetch: {
      name: 'neofetch',
      description: 'System information tool',
      usage: 'neofetch',
      execute: () => {
        return `                    kartikey@portfolio
                    ---------------
Name: Kartikey Pandey
Role: Founding Engineer @ Raya Health (HF0 W26)
Past: NASA Lunar Autonomy Challenge · Intel · Snap Spectacles
Awards: 10x hackathon winner · 1 patent
Edu: B.S. Computer Science, Penn State (2022–2026)
Stack: TypeScript · Python · React/Next.js · PyTorch · TensorFlow
Uptime: ${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m
Shell: Portfolio Terminal (try: resume, projects, open recompress)

███▄▄▄▄      ██▄███▄    ▄█     ▄█▄
██  ▀██▄    █  █▀ ▀█    ███    ████
██▄   ▀██▄  █▀ █  █ █    ███    ████
▀███▄█▄ ▀█▀ █  █  █ █    ███    ████
 ▀ ▀█████▄ █  █  █ █    ███    ████
 ▀██▀▀▀██▀ █  █  █ █    ███    ████
 ▀██▄ ▀▀▄  █  █  █ █    ███    ████
  ▀██▄▄▄▀  █  █  █ █    ███    ████
   ▀ ▀████ █  █  █ █    ███    ████
      ▀▀▀  ▀  ▀  ▀ ▀    ▀▀▀    ▀▀▀`
      }
    },

    node: {
      name: 'node',
      description: 'Node.js runtime',
      usage: 'node [script]',
      execute: (args) => {
        if (args.length === 0) {
          return `Welcome to Node.js v20.x.
Type ".help" for more information.
> `
        }
        return 'Node.js script execution would happen here in a real environment.'
      }
    },

    resume: {
      name: 'resume',
      description: 'Open my résumé (PDF)',
      usage: 'resume',
      execute: () => {
        if (typeof window !== 'undefined') window.open('/resume.pdf', '_blank')
        return 'Opening résumé… (also at /resume.json for structured data)'
      }
    },

    experience: {
      name: 'experience',
      description: 'Summarize work experience',
      usage: 'experience',
      execute: () => {
        return [
          'Founding Engineer       Raya Health (HF0 W26)         2026',
          'Founder & President     Penn State Hackathon Team     2024–2025  (#185 → #74)',
          'ML Engineer             NASA Lunar Autonomy / JHU APL 2024–2025',
          'SWE Intern              ColdStart                     2025',
          'President / Tech Lead    Google DSC @ Penn State       2023–2025  (200+ members)',
          'Engineer                Intel Corporation             2020–2021  (−33% deploy time)',
          'AR/AI Dev               Snap Spectacles Accelerator   ($25k+ funding)',
          '',
          "Tip: 'cat experience.md' for the full version.",
        ].join('\n')
      }
    },

    projects: {
      name: 'projects',
      description: 'List projects',
      usage: 'projects',
      execute: () => {
        const projectsFolder = state.files[0]?.children?.find(n => n.id === 'projects')
        const names = (projectsFolder?.children || []).map(p => `  • ${p.name.replace('.md','')}`)
        return [
          'Projects (open with: open <name>, e.g. `open recompress`)',
          '',
          ...names,
          '',
          '⭐ recompress  — published research, 8.1× token reduction (Zenodo DOI)',
          '⭐ multiverse  — speculative execution for AI agents',
          '   mutable     — self-designing forms, live at trymutable.online',
        ].join('\n')
      }
    },

    open: {
      name: 'open',
      description: 'Open a file in the viewer',
      usage: 'open <file>',
      execute: (args) => {
        if (args.length === 0) return 'open: missing file operand (try: open recompress)'
        const query = args[0].replace(/\.md$/, '').toLowerCase()
        // Search the whole tree for a file whose id or name matches.
        const search = (nodes: typeof state.files): string | null => {
          for (const node of nodes) {
            if (node.type === 'file') {
              const idMatch = node.id.toLowerCase() === query
              const nameMatch = node.name.replace(/\.md$/, '').toLowerCase() === query
              if (idMatch || nameMatch) return node.id
            }
            if (node.children) {
              const found = search(node.children)
              if (found) return found
            }
          }
          return null
        }
        const id = search(state.files)
        if (!id) return `open: '${args[0]}' not found. Try 'projects' or 'ls'.`
        dispatch({ type: 'OPEN_FILE', payload: { id } })
        return `Opening ${args[0]}…`
      }
    },

    socials: {
      name: 'socials',
      description: 'Show links',
      usage: 'socials',
      execute: () => {
        return [
          'GitHub:    https://github.com/Kart-ing',
          'LinkedIn:  https://linkedin.com/in/kartikeypandey2004',
          'Email:     kartikeypandey.official@gmail.com',
          'ReCompress (paper): https://doi.org/10.5281/zenodo.20786357',
          'Mutable (live):     https://trymutable.online',
        ].join('\n')
      }
    },

    sudo: {
      name: 'sudo',
      description: 'Execute as superuser',
      usage: 'sudo <command>',
      execute: (args) => {
        const cmd = args.join(' ') || 'su'
        return `[sudo] password for kartikey: \nNice try. ${cmd ? `'${cmd}' ` : ''}denied — but I admire the ambition. 😏`
      }
    }
  }

  const addLine = (type: TerminalLine['type'], content: string) => {
    const newLine: TerminalLine = {
      id: `line-${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date()
    }
    setLines(prev => [...prev, newLine])
  }

  const refocus = () => {
    setCurrentInput('')
    setCursorPosition(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Resolve `python <file>` source: first the in-memory VFS, then bundled /scripts/.
  const resolvePythonSource = async (fileArg: string): Promise<string | null> => {
    const fullPath = fileArg.startsWith('/')
      ? fileArg
      : `${currentDirectory}/${fileArg}`.replace('//', '/')
    const node = findFileByPath(fullPath)
    if (node && 'content' in node && node.type === 'file' && typeof node.content === 'string' && node.content) {
      return node.content
    }
    const base = fileArg.split('/').pop() ?? fileArg
    if (['hello.py', 'fib.py', 'about.py'].includes(base)) {
      try {
        const r = await fetch(`/scripts/${base}`)
        if (r.ok) return await r.text()
      } catch {
        /* fall through */
      }
    }
    return null
  }

  const bootPythonIfNeeded = async (): Promise<boolean> => {
    if (getPyStatus() === 'ready') return true
    addLine('output', '🐍 booting Python (WASM)… first run downloads ~10MB, then it\'s instant.')
    try {
      await loadPyodideOnce((msg) => addLine('output', `   ${msg}`))
      return true
    } catch (e) {
      addLine('error', `Failed to start Python: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  const handlePython = async (args: string[]) => {
    // No args → enter the REPL.
    if (args.length === 0) {
      if (!(await bootPythonIfNeeded())) return
      const ver = await runPython('import sys; print(sys.version.split()[0])')
      addLine('output', `Python ${ver.output.trim()} (Pyodide/WASM) in the browser`)
      addLine('output', 'Type "exit()" to return to the shell.')
      setPythonRepl(true)
      return
    }
    // Run a .py file.
    const code = await resolvePythonSource(args[0])
    if (code == null) {
      addLine('error', `python: can't open file '${args[0]}': No such file or directory`)
      addLine('output', 'Try the demos: python hello.py · python fib.py · python about.py')
      return
    }
    if (!(await bootPythonIfNeeded())) return
    const res = await runPython(code, {
      onStdout: (s) => addLine('output', s.replace(/\n$/, '')),
      onStderr: (s) => addLine('error', s.replace(/\n$/, '')),
    })
    if (!res.ok && res.error) addLine('error', res.error)
  }

  const executeCommand = async (commandLine: string) => {
    // ---- REPL MODE: each line goes to Python until exit() ----
    if (pythonRepl) {
      addLine('input', `>>> ${commandLine}`)
      const trimmed = commandLine.trim()
      if (trimmed === 'exit()' || trimmed === 'quit()' || trimmed === 'exit') {
        setPythonRepl(false)
        addLine('output', 'Back to the shell.')
        refocus()
        return
      }
      if (trimmed === '') { refocus(); return }
      setCommandHistory(prev => [...prev, commandLine])
      setHistoryIndex(-1)
      setIsBusy(true)
      const res = await runPython(commandLine, {
        onStdout: (s) => addLine('output', s.replace(/\n$/, '')),
        onStderr: (s) => addLine('error', s.replace(/\n$/, '')),
      })
      if (!res.ok && res.error) addLine('error', res.error)
      setIsBusy(false)
      refocus()
      return
    }

    if (!commandLine.trim()) return

    setCommandHistory(prev => [...prev, commandLine])
    setHistoryIndex(-1)
    addLine('input', commandLine)

    const [commandName, ...args] = commandLine.trim().split(' ')

    // ---- PYTHON: intercept before the synchronous command map ----
    if (commandName === 'python' || commandName === 'python3') {
      setIsBusy(true)
      await handlePython(args)
      setIsBusy(false)
      refocus()
      return
    }

    const command = commands[commandName]
    if (command) {
      const result = command.execute(args)
      if (result !== '') {
        addLine('output', result)
      }
    } else {
      addLine('error', `${commandName}: command not found`)
      addLine('output', 'Try \'help\' for available commands.')
    }

    refocus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void executeCommand(currentInput)
      // Focus is handled in executeCommand now
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : historyIndex + 1
        setHistoryIndex(newIndex)
        const historyCommand = commandHistory[commandHistory.length - 1 - newIndex]
        setCurrentInput(historyCommand)
        setCursorPosition(historyCommand.length)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        const historyCommand = commandHistory[commandHistory.length - 1 - newIndex]
        setCurrentInput(historyCommand)
        setCursorPosition(historyCommand.length)
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCurrentInput('')
        setCursorPosition(0)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setCursorPosition(prev => Math.max(0, prev - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setCursorPosition(prev => Math.min(currentInput.length, prev + 1))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (cursorPosition > 0) {
        const newInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition)
        setCurrentInput(newInput)
        setCursorPosition(prev => prev - 1)
      }
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (cursorPosition < currentInput.length) {
        const newInput = currentInput.slice(0, cursorPosition) + currentInput.slice(cursorPosition + 1)
        setCurrentInput(newInput)
      }
    } else if (e.key.length === 1) {
      e.preventDefault()
      const newInput = currentInput.slice(0, cursorPosition) + e.key + currentInput.slice(cursorPosition)
      setCurrentInput(newInput)
      setCursorPosition(prev => prev + 1)
    }
  }

  const clearTerminal = () => {
    setLines([])
  }

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  // Focus input when terminal is opened
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const renderLine = (line: TerminalLine) => {
    switch (line.type) {
      case 'input': {
        // REPL-echoed lines already carry their own ">>> " prompt — don't add the shell prompt.
        const isReplEcho = line.content.startsWith('>>> ')
        if (isReplEcho) {
          return (
            <div key={line.id} className="flex items-start">
              <span className="text-yellow-400 mr-2">&gt;&gt;&gt;</span>
              <span className="text-white">{line.content.slice(4)}</span>
            </div>
          )
        }
        return (
          <div key={line.id} className="flex items-start">
            <span className="text-green-400 mr-2">portfolio-user@portfolio:</span>
            <span className="text-blue-400 mr-2">{currentDirectory === '/' ? '~' : currentDirectory}$</span>
            <span className="text-white">{line.content}</span>
          </div>
        )
      }
      case 'output':
        return (
          <div key={line.id} className="text-white whitespace-pre-wrap">
            {line.content}
          </div>
        )
      case 'error':
        return (
          <div key={line.id} className="text-red-400">
            {line.content}
          </div>
        )
      default:
        return (
          <div key={line.id} className="text-white">
            {line.content}
          </div>
        )
    }
  }

  return (
    <div className="bg-[var(--terminal)] border-t border-[var(--border)] flex flex-col" style={{ height }}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--textSecondary)]">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            className="w-6 h-6"
            onClick={clearTerminal}
            title="Clear"
          >
            <Trash2 className="w-3 h-3" />
          </IconButton>
          <IconButton
            size="sm"
            className="w-6 h-6"
            onClick={onClose}
            title="Close Terminal"
          >
            <X className="w-3 h-3" />
          </IconButton>
        </div>
      </div>

      {/* Terminal content */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-4 overflow-auto font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Output lines */}
        {lines.map(renderLine)}
        
        {/* Current input line */}
        <div className="flex items-start">
          {pythonRepl ? (
            <span className="text-yellow-400 mr-2">&gt;&gt;&gt;</span>
          ) : (
            <>
              <span className="text-green-400 mr-2">portfolio-user@portfolio:</span>
              <span className="text-blue-400 mr-2">{currentDirectory === '/' ? '~' : currentDirectory}$</span>
            </>
          )}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => {
                setCurrentInput(e.target.value)
                setCursorPosition(e.target.value.length)
              }}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-white outline-none border-none w-full"
              style={{ caretColor: 'transparent' }}
            />
            {/* Custom cursor */}
            <div 
              className="absolute top-0 w-0.5 h-5 bg-white animate-pulse"
              style={{ 
                left: `${cursorPosition * 0.6}rem`,
                display: cursorPosition <= currentInput.length ? 'block' : 'none'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 