'use client'

import { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { FileNode, FileSystemState, FileAction } from '@/types/fileSystem'

// Define the structure with external file paths
const fileStructure: FileNode[] = [
  {
    id: 'root',
    name: 'Portfolio',
    type: 'folder',
    path: '/',
    isOpen: true,
    children: [
      {
        id: 'readme',
        name: 'README.md',
        type: 'file',
        path: '/README.md',
        externalPath: '/content/README.md', // Path to your actual MD file
        content: '', // Will be loaded from external file
        language: 'markdown'
      },
      {
        id: 'about',
        name: 'about.md',
        type: 'file',
        path: '/about.md',
        externalPath: '/content/about.md',
        content: '',
        language: 'markdown'
      },
      {
        id: 'experience',
        name: 'experience.md',
        type: 'file',
        path: '/experience.md',
        externalPath: '/content/experience.md',
        content: '',
        language: 'markdown'
      },
      {
        id: 'awards',
        name: 'awards.md',
        type: 'file',
        path: '/awards.md',
        externalPath: '/content/awards.md',
        content: '',
        language: 'markdown'
      },
      {
        id: 'contact',
        name: 'contact.md',
        type: 'file',
        path: '/contact.md',
        externalPath: '/content/contact.md',
        content: '',
        language: 'markdown'
      },
      {
        id: 'projects',
        name: 'projects',
        type: 'folder',
        path: '/projects',
        isOpen: true,
        children: [
          {
            id: 'reality-rush',
            name: 'reality-rush.md',
            type: 'file',
            path: '/projects/reality-rush.md',
            externalPath: '/content/projects/reality-rush.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'eyesnap',
            name: 'eyesnap.md',
            type: 'file',
            path: '/projects/eyesnap.md',
            externalPath: '/content/projects/eyesnap.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'project-elementals',
            name: 'project-elementals.md',
            type: 'file',
            path: '/projects/project-elementals.md',
            externalPath: '/content/projects/project-elementals.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'snom',
            name: 'snom.md',
            type: 'file',
            path: '/projects/snom.md',
            externalPath: '/content/projects/snom.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'vr-breadboard',
            name: 'vr-breadboard.md',
            type: 'file',
            path: '/projects/vr-breadboard.md',
            externalPath: '/content/projects/vr-breadboard.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'surgical-tracking',
            name: 'surgical-tracking.md',
            type: 'file',
            path: '/projects/surgical-tracking.md',
            externalPath: '/content/projects/surgical-tracking.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'moth-challenge',
            name: 'moth-challenge.md',
            type: 'file',
            path: '/projects/moth-challenge.md',
            externalPath: '/content/projects/moth-challenge.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'devspot',
            name: 'devspot.md',
            type: 'file',
            path: '/projects/devspot.md',
            externalPath: '/content/projects/devspot.md',
            content: '',
            language: 'markdown'
          },
          {
            id: 'asl-banking',
            name: 'asl-banking.md',
            type: 'file',
            path: '/projects/asl-banking.md',
            externalPath: '/content/projects/asl-banking.md',
            content: '',
            language: 'markdown'
          }
        ]
      }
    ]
  }
]

const initialState: FileSystemState = {
  files: fileStructure,
  activeFile: 'readme',
  openFiles: ['readme'],
  isLoading: false,
  loadedFiles: [] // Changed from Set to array for serializable state
}

// File content loader utility - renamed to avoid collision
async function fetchFileContent(externalPath: string): Promise<string> {
  try {
    const response = await fetch(externalPath)
    if (!response.ok) {
      throw new Error(`Failed to load ${externalPath}: ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    console.error(`Error loading file ${externalPath}:`, error)
    return `# Error Loading Content\n\nFailed to load content from: ${externalPath}\n\nPlease check if the file exists and is accessible.`
  }
}

// Preload all file contents - using plain object instead of Map
async function preloadAllFiles(files: FileNode[]): Promise<Record<string, string>> {
  const contentMap: Record<string, string> = {}
  
  const loadFile = async (file: FileNode) => {
    if (file.type === 'file' && file.externalPath) {
      const content = await fetchFileContent(file.externalPath)
      contentMap[file.id] = content
    }
    
    if (file.children) {
      await Promise.all(file.children.map(loadFile))
    }
  }
  
  await Promise.all(files.map(loadFile))
  return contentMap
}

function fileSystemReducer(state: FileSystemState, action: FileAction): FileSystemState {
  switch (action.type) {
    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload.isLoading
      }
    }

    case 'SET_FILE_CONTENT': {
      const { fileId, content } = action.payload
      const updateContentInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === fileId) {
            return { ...node, content }
          }
          if (node.children) {
            return {
              ...node,
              children: updateContentInTree(node.children)
            }
          }
          return node
        })
      }
      
      return {
        ...state,
        files: updateContentInTree(state.files),
        loadedFiles: [...(state.loadedFiles || []), fileId] // Handle undefined case
      }
    }

    case 'BULK_SET_CONTENT': {
      const { contentMap } = action.payload
      const updateAllContent = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.type === 'file' && contentMap[node.id]) {
            return { ...node, content: contentMap[node.id] || '' }
          }
          if (node.children) {
            return {
              ...node,
              children: updateAllContent(node.children)
            }
          }
          return node
        })
      }

      return {
        ...state,
        files: updateAllContent(state.files),
        loadedFiles: Object.keys(contentMap) // Changed from Set to array
      }
    }

    case 'ADD_FILE': {
      const { parentId, file } = action.payload
      const addFileToNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            return {
              ...node,
              children: [...(node.children || []), file]
            }
          }
          if (node.children) {
            return {
              ...node,
              children: addFileToNode(node.children)
            }
          }
          return node
        })
      }
      return {
        ...state,
        files: addFileToNode(state.files)
      }
    }

    case 'ADD_FOLDER': {
      const { parentId, folder } = action.payload
      const addFolderToNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            return {
              ...node,
              children: [...(node.children || []), folder]
            }
          }
          if (node.children) {
            return {
              ...node,
              children: addFolderToNode(node.children)
            }
          }
          return node
        })
      }
      return {
        ...state,
        files: addFolderToNode(state.files)
      }
    }

    case 'DELETE_NODE': {
      const { id } = action.payload
      const deleteNodeFromTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.filter(node => {
          if (node.id === id) return false
          if (node.children) {
            node.children = deleteNodeFromTree(node.children)
          }
          return true
        })
      }
      return {
        ...state,
        files: deleteNodeFromTree(state.files),
        openFiles: state.openFiles.filter(fileId => fileId !== id),
        activeFile: state.activeFile === id ? null : state.activeFile
      }
    }

    case 'RENAME_NODE': {
      const { id, newName } = action.payload
      const renameNodeInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, name: newName }
          }
          if (node.children) {
            return {
              ...node,
              children: renameNodeInTree(node.children)
            }
          }
          return node
        })
      }
      return {
        ...state,
        files: renameNodeInTree(state.files)
      }
    }

    case 'TOGGLE_FOLDER': {
      const { id } = action.payload
      const toggleFolderInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, isOpen: !node.isOpen }
          }
          if (node.children) {
            return {
              ...node,
              children: toggleFolderInTree(node.children)
            }
          }
          return node
        })
      }
      return {
        ...state,
        files: toggleFolderInTree(state.files)
      }
    }

    case 'SET_ACTIVE_FILE': {
      return {
        ...state,
        activeFile: action.payload.id
      }
    }

    case 'OPEN_FILE': {
      const { id } = action.payload
      if (!state.openFiles.includes(id)) {
        return {
          ...state,
          openFiles: [...state.openFiles, id],
          activeFile: id
        }
      }
      return {
        ...state,
        activeFile: id
      }
    }

    case 'CLOSE_FILE': {
      const { id } = action.payload
      const newOpenFiles = state.openFiles.filter(fileId => fileId !== id)
      return {
        ...state,
        openFiles: newOpenFiles,
        activeFile: state.activeFile === id 
          ? (newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null)
          : state.activeFile
      }
    }

    case 'UPDATE_FILE_CONTENT': {
      const { id, content } = action.payload
      const updateContentInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
            return { ...node, content }
          }
          if (node.children) {
            return {
              ...node,
              children: updateContentInTree(node.children)
            }
          }
          return node
        })
      }
      return {
        ...state,
        files: updateContentInTree(state.files)
      }
    }

    default:
      return state
  }
}

interface FileSystemContextType {
  state: FileSystemState
  dispatch: React.Dispatch<FileAction>
  findFile: (id: string) => FileNode | null
  loadFileContent: (fileId: string) => Promise<void>
  reloadFile: (fileId: string) => Promise<void>
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined)

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState)

  // Load all files on mount
  useEffect(() => {
    const loadAllFiles = async () => {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } })
      
      try {
        const contentMap = await preloadAllFiles(state.files)
        dispatch({ type: 'BULK_SET_CONTENT', payload: { contentMap } })
      } catch (error) {
        console.error('Error preloading files:', error)
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } })
      }
    }

    loadAllFiles()
  }, []) // Only run once on mount

  const findFile = (id: string): FileNode | null => {
    const searchInTree = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        if (node.children) {
          const found = searchInTree(node.children)
          if (found) return found
        }
      }
      return null
    }
    return searchInTree(state.files)
  }

  const loadFileContent = async (fileId: string): Promise<void> => {
    const file = findFile(fileId)
    if (!file || !file.externalPath || (state.loadedFiles || []).includes(fileId)) {
      return
    }

    try {
      const content = await fetchFileContent(file.externalPath) // Using renamed utility function
      dispatch({ 
        type: 'SET_FILE_CONTENT', 
        payload: { fileId, content } 
      })
    } catch (error) {
      console.error(`Error loading file ${fileId}:`, error)
    }
  }

  const reloadFile = async (fileId: string): Promise<void> => {
    const file = findFile(fileId)
    if (!file || !file.externalPath) {
      return
    }

    try {
      const content = await fetchFileContent(file.externalPath) // Using renamed utility function
      dispatch({ 
        type: 'SET_FILE_CONTENT', 
        payload: { fileId, content } 
      })
    } catch (error) {
      console.error(`Error reloading file ${fileId}:`, error)
    }
  }

  return (
    <FileSystemContext.Provider value={{ 
      state, 
      dispatch, 
      findFile, 
      loadFileContent, 
      reloadFile 
    }}>
      {children}
    </FileSystemContext.Provider>
  )
}

export function useFileSystem() {
  const context = useContext(FileSystemContext)
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider')
  }
  return context
}