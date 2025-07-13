// @/types/fileSystem.ts

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  content?: string
  language?: string
  isOpen?: boolean
  children?: FileNode[]
  externalPath?: string // New: Path to external MD file
}

export interface FileSystemState {
  files: FileNode[]
  activeFile: string | null
  openFiles: string[]
  isLoading?: boolean // New: Loading state
  loadedFiles?: string[] // Changed from Set to array for serializable state
}

export type FileAction =
  | { type: 'ADD_FILE'; payload: { parentId: string; file: FileNode } }
  | { type: 'ADD_FOLDER'; payload: { parentId: string; folder: FileNode } }
  | { type: 'DELETE_NODE'; payload: { id: string } }
  | { type: 'RENAME_NODE'; payload: { id: string; newName: string } }
  | { type: 'TOGGLE_FOLDER'; payload: { id: string } }
  | { type: 'SET_ACTIVE_FILE'; payload: { id: string } }
  | { type: 'OPEN_FILE'; payload: { id: string } }
  | { type: 'CLOSE_FILE'; payload: { id: string } }
  | { type: 'UPDATE_FILE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } } // New
  | { type: 'SET_FILE_CONTENT'; payload: { fileId: string; content: string } } // New
  | { type: 'BULK_SET_CONTENT'; payload: { contentMap: Record<string, string> } } // Changed from Map to Record