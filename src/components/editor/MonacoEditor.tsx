'use client'

import { useEffect, useRef } from 'react'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { cn } from '@/lib/utils'

interface MonacoEditorProps {
  className?: string
}

export function MonacoEditor({ className }: MonacoEditorProps) {
  const { state, dispatch, findFile } = useFileSystem()
  const editorRef = useRef<HTMLDivElement>(null)
  const monacoRef = useRef<any>(null)
  const editorInstanceRef = useRef<any>(null)

  useEffect(() => {
    // Dynamically import Monaco Editor
    const loadMonaco = async () => {
      try {
        const monaco = await import('@monaco-editor/react')
        monacoRef.current = monaco
        
        if (editorRef.current && !editorInstanceRef.current) {
          // Monaco will be initialized by the Editor component
        }
      } catch (error) {
        console.error('Failed to load Monaco Editor:', error)
      }
    }

    loadMonaco()
  }, [])

  const activeFile = state.activeFile ? findFile(state.activeFile) : null

  if (!monacoRef.current) {
    return (
      <div className={cn('flex items-center justify-center bg-[var(--editor)]', className)}>
        <div className="text-[var(--textSecondary)]">Loading Monaco Editor...</div>
      </div>
    )
  }

  const { Editor } = monacoRef.current

  return (
    <div className={cn('flex flex-col h-full bg-[var(--editor)]', className)}>
      {/* Tabs */}
      <div className="flex bg-[var(--surface)] border-b border-[var(--border)]">
        {state.openFiles.map(fileId => {
          const file = findFile(fileId)
          if (!file) return null
          
          return (
            <div
              key={fileId}
              className={cn(
                'flex items-center px-4 py-2 border-r border-[var(--border)] cursor-pointer',
                'text-sm text-[var(--textPrimary)] hover:bg-[var(--hover)]',
                state.activeFile === fileId && 'bg-[var(--editor)] border-b-0'
              )}
              onClick={() => dispatch({ type: 'SET_ACTIVE_FILE', payload: { id: fileId } })}
            >
              <span className="truncate max-w-32">{file.name}</span>
              <button
                className="ml-2 w-4 h-4 hover:bg-[var(--hover)] rounded flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'CLOSE_FILE', payload: { id: fileId } })
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {activeFile ? (
          <Editor
            height="100%"
            defaultLanguage={activeFile.language || 'javascript'}
            value={activeFile.content || ''}
            onChange={(value: string | undefined) => {
              if (value !== undefined) {
                dispatch({
                  type: 'UPDATE_FILE_CONTENT',
                  payload: { id: activeFile.id, content: value }
                })
              }
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'always',
              selectOnLineNumbers: true,
              renderLineHighlight: 'all',
              theme: 'vs-dark'
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-[var(--textSecondary)] text-lg">
              No file selected
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 