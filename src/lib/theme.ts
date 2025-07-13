// src/lib/theme.ts
export const vsCodeTheme = {
  dark: {
    // Main colors
    primary: '#007ACC',
    secondary: '#0E639C',
    accent: '#007ACC',
    
    // Background colors
    background: '#1E1E1E',
    surface: '#2D2D30',
    surfaceHover: '#3E3E42',
    
    // Panel colors
    sidebar: '#2D2D30',
    editor: '#1E1E1E',
    terminal: '#1E1E1E',
    titleBar: '#3C3C3C',
    statusBar: '#007ACC',
    
    // Border colors
    border: '#3C3C3C',
    borderLight: '#464647',
    
    // Text colors
    textPrimary: '#CCCCCC',
    textSecondary: '#969696',
    textMuted: '#6A6A6A',
    textAccent: '#FFFFFF',
    
    // Syntax highlighting
    syntax: {
      keyword: '#569CD6',
      string: '#CE9178',
      comment: '#6A9955',
      number: '#B5CEA8',
      function: '#DCDCAA',
      variable: '#9CDCFE',
      type: '#4EC9B0',
      operator: '#D4D4D4',
      bracket: '#FFD700',
    },
    
    // UI States
    hover: '#2A2D2E',
    active: '#37373D',
    focus: '#007ACC',
    selection: '#264F78',
    
    // File explorer
    fileIcon: '#CCCCCC',
    folderIcon: '#DCAA3C',
    
    // Terminal colors
    terminalBlack: '#000000',
    terminalRed: '#F44747',
    terminalGreen: '#6A9955',
    terminalYellow: '#FFCC02',
    terminalBlue: '#569CD6',
    terminalMagenta: '#C586C0',
    terminalCyan: '#4EC9B0',
    terminalWhite: '#CCCCCC',
  },
  
  light: {
    // Main colors
    primary: '#005FB8',
    secondary: '#0078D4',
    accent: '#005FB8',
    
    // Background colors
    background: '#FFFFFF',
    surface: '#F3F3F3',
    surfaceHover: '#E8E8E8',
    
    // Panel colors
    sidebar: '#F3F3F3',
    editor: '#FFFFFF',
    terminal: '#FFFFFF',
    titleBar: '#DDDDDD',
    statusBar: '#005FB8',
    
    // Border colors
    border: '#E5E5E5',
    borderLight: '#CCCCCC',
    
    // Text colors
    textPrimary: '#000000',
    textSecondary: '#424242',
    textMuted: '#6C6C6C',
    textAccent: '#FFFFFF',
    
    // Syntax highlighting
    syntax: {
      keyword: '#0000FF',
      string: '#A31515',
      comment: '#008000',
      number: '#098658',
      function: '#795E26',
      variable: '#001080',
      type: '#267F99',
      operator: '#000000',
      bracket: '#0431FA',
    },
    
    // UI States
    hover: '#E8E8E8',
    active: '#E4E6F1',
    focus: '#005FB8',
    selection: '#ADD6FF',
    
    // File explorer
    fileIcon: '#424242',
    folderIcon: '#DCAA3C',
    
    // Terminal colors
    terminalBlack: '#000000',
    terminalRed: '#CD3131',
    terminalGreen: '#00BC00',
    terminalYellow: '#949800',
    terminalBlue: '#0451A5',
    terminalMagenta: '#BC05BC',
    terminalCyan: '#0598BC',
    terminalWhite: '#555555',
  }
}

export type Theme = typeof vsCodeTheme.dark
export type ThemeMode = 'dark' | 'light'