'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useFileSystem } from '@/contexts/FileSystemContext'
import { FileNode } from '@/types/fileSystem'
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  MoreHorizontal
} from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'

interface FileExplorerProps {
  className?: string
}

export function FileExplorer({ className }: FileExplorerProps) {
  const { state, dispatch, findFile } = useFileSystem()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: string
  } | null>(null)
  const [renamingNode, setRenamingNode] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const handleFileClick = (file: FileNode) => {
    if (file.type === 'file') {
      dispatch({ type: 'OPEN_FILE', payload: { id: file.id } })
    } else {
      dispatch({ type: 'TOGGLE_FOLDER', payload: { id: file.id } })
    }
  }

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId })
  }

  const addNewFile = (parentId: string) => {
    const fileName = `new-file-${Date.now()}.js`
    const newFile: FileNode = {
      id: `file-${Date.now()}`,
      name: fileName,
      type: 'file',
      path: `/new-file-${Date.now()}.js`,
      content: `// New file created at ${new Date().toLocaleString()}
console.log('Hello from new file!');

// You can write JavaScript code here
function example() {
  return "This is a new JavaScript file!";
}

module.exports = { example };`,
      language: 'javascript'
    }
    dispatch({ type: 'ADD_FILE', payload: { parentId, file: newFile } })
    setContextMenu(null)
  }

  const addNewFolder = (parentId: string) => {
    const folderName = `new-folder-${Date.now()}`
    const newFolder: FileNode = {
      id: `folder-${Date.now()}`,
      name: folderName,
      type: 'folder',
      path: `/new-folder-${Date.now()}`,
      isOpen: false,
      children: []
    }
    dispatch({ type: 'ADD_FOLDER', payload: { parentId, folder: newFolder } })
    setContextMenu(null)
  }

  const deleteNode = (nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', payload: { id: nodeId } })
    setContextMenu(null)
  }

  const startRename = (nodeId: string, currentName: string) => {
    setRenamingNode(nodeId)
    setNewName(currentName)
    setContextMenu(null)
  }

  const handleRename = () => {
    if (renamingNode && newName.trim()) {
      dispatch({ type: 'RENAME_NODE', payload: { id: renamingNode, newName: newName.trim() } })
      setRenamingNode(null)
      setNewName('')
    }
  }

  const cancelRename = () => {
    setRenamingNode(null)
    setNewName('')
  }

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="group">
        <div
          className={cn(
            'flex items-center px-2 py-1 hover:bg-[var(--hover)] cursor-pointer select-none min-w-0',
            'text-sm',
            state.activeFile === node.id && 'bg-[var(--selection)]'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
        >
          {/* Icons */}
          <div className="flex items-center flex-shrink-0">
            {node.type === 'folder' ? (
              <>
                {node.isOpen ? (
                  <ChevronDown className="w-4 h-4 text-[var(--textSecondary)] mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--textSecondary)] mr-1" />
                )}
                {node.isOpen ? (
                  <FolderOpen className="w-4 h-4 text-[var(--folderIcon)] mr-2" />
                ) : (
                  <Folder className="w-4 h-4 text-[var(--folderIcon)] mr-2" />
                )}
              </>
            ) : (
              <File className="w-4 h-4 text-[var(--fileIcon)] mr-2" />
            )}
          </div>

          {/* File name - with proper truncation */}
          <div className="flex-1 min-w-0">
            {renamingNode === node.id ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename()
                  } else if (e.key === 'Escape') {
                    cancelRename()
                  }
                }}
                onBlur={handleRename}
                className="w-full bg-[var(--editor)] text-[var(--textPrimary)] border border-[var(--focus)] rounded px-1 text-sm"
                autoFocus
              />
            ) : (
              <span className="block truncate text-[var(--textPrimary)]">{node.name}</span>
            )}
          </div>

          {/* Three dots menu - only visible on hover */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              size="sm"
              className="w-6 h-6"
              onClick={(e) => {
                e.stopPropagation()
                handleContextMenu(e, node.id)
              }}
            >
              <MoreHorizontal className="w-3 h-3" />
            </IconButton>
          </div>
        </div>
        
        {/* Children */}
        {node.type === 'folder' && node.isOpen && node.children && (
          <div>
            {renderFileTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* File Tree */}
      <div className="flex-1 overflow-auto">
        {renderFileTree(state.files)}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--hover)] flex items-center gap-2"
            onClick={() => addNewFile(contextMenu.nodeId)}
          >
            <Plus className="w-3 h-3" />
            New File
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--hover)] flex items-center gap-2"
            onClick={() => addNewFolder(contextMenu.nodeId)}
          >
            <Folder className="w-3 h-3" />
            New Folder
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--hover)] flex items-center gap-2"
            onClick={() => startRename(contextMenu.nodeId, findFile(contextMenu.nodeId)?.name || '')}
          >
            <span>Rename</span>
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--hover)] text-red-500"
            onClick={() => deleteNode(contextMenu.nodeId)}
          >
            Delete
          </button>
        </div>
      )}

      {/* Overlay to close context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  )
} 