export interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  content?: string
  children?: FileItem[]
}

export interface Project {
  id: string
  name: string
  description: string
  technologies: string[]
  fileStructure: FileItem[]
  mainFile: string
  commands: string[]
}