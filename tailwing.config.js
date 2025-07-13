// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // VS Code theme colors using CSS variables
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        
        background: 'var(--background)',
        surface: 'var(--surface)',
        surfaceHover: 'var(--surfaceHover)',
        
        sidebar: 'var(--sidebar)',
        editor: 'var(--editor)',
        terminal: 'var(--terminal)',
        titleBar: 'var(--titleBar)',
        statusBar: 'var(--statusBar)',
        
        border: 'var(--border)',
        borderLight: 'var(--borderLight)',
        
        textPrimary: 'var(--textPrimary)',
        textSecondary: 'var(--textSecondary)',
        textMuted: 'var(--textMuted)',
        textAccent: 'var(--textAccent)',
        
        hover: 'var(--hover)',
        active: 'var(--active)',
        focus: 'var(--focus)',
        selection: 'var(--selection)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
      },
      spacing: {
        '0.5': '0.125rem',
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '3.5': '0.875rem',
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      screens: {
        'xs': '475px',
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--textSecondary)',
            '[class~="lead"]': {
              color: 'var(--textSecondary)',
            },
            a: {
              color: 'var(--accent)',
              '&:hover': {
                color: 'var(--accentHover)',
              },
            },
            strong: {
              color: 'var(--textPrimary)',
            },
            'ol[type="A"]': {
              '--list-counter-style': 'upper-alpha',
            },
            'ol[type="a"]': {
              '--list-counter-style': 'lower-alpha',
            },
            'ol[type="A" s]': {
              '--list-counter-style': 'upper-alpha',
            },
            'ol[type="a" s]': {
              '--list-counter-style': 'lower-alpha',
            },
            'ol[type="I"]': {
              '--list-counter-style': 'upper-roman',
            },
            'ol[type="i"]': {
              '--list-counter-style': 'lower-roman',
            },
            'ol[type="I" s]': {
              '--list-counter-style': 'upper-roman',
            },
            'ol[type="i" s]': {
              '--list-counter-style': 'lower-roman',
            },
            'ol[type="1"]': {
              '--list-counter-style': 'decimal',
            },
            'ol > li': {
              position: 'relative',
            },
            'ol > li::marker': {
              fontWeight: '400',
              color: 'var(--textSecondary)',
            },
            'ul > li': {
              position: 'relative',
            },
            'ul > li::marker': {
              color: 'var(--textSecondary)',
            },
            hr: {
              borderColor: 'var(--border)',
              borderTopWidth: 1,
            },
            blockquote: {
              fontWeight: '500',
              fontStyle: 'italic',
              color: 'var(--textSecondary)',
              borderLeftWidth: '0.25rem',
              borderLeftColor: 'var(--accent)',
              quotes: '"\\201C""\\201D""\\2018""\\2019"',
            },
            h1: {
              color: 'var(--textPrimary)',
              fontWeight: '800',
            },
            h2: {
              color: 'var(--textPrimary)',
              fontWeight: '700',
            },
            h3: {
              color: 'var(--textPrimary)',
              fontWeight: '600',
            },
            h4: {
              color: 'var(--textPrimary)',
              fontWeight: '600',
            },
            'figure figcaption': {
              color: 'var(--textSecondary)',
            },
            code: {
              color: 'var(--textPrimary)',
              fontWeight: '600',
              '&::before': {
                content: '"`"',
              },
              '&::after': {
                content: '"`"',
              },
            },
            'code::before': {
              content: 'none',
            },
            'code::after': {
              content: 'none',
            },
            'a code': {
              color: 'var(--accent)',
            },
            pre: {
              color: 'var(--textPrimary)',
              backgroundColor: 'var(--surface)',
              overflowX: 'auto',
              fontWeight: '400',
            },
            'pre code': {
              backgroundColor: 'transparent',
              borderWidth: '0',
              borderRadius: '0',
              padding: '0',
              fontWeight: 'inherit',
              color: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              '&::before': {
                content: 'none',
              },
              '&::after': {
                content: 'none',
              },
            },
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              marginTop: '2em',
              marginBottom: '2em',
            },
            thead: {
              color: 'var(--textPrimary)',
              fontWeight: '600',
              borderBottomWidth: '1px',
              borderBottomColor: 'var(--border)',
            },
            'thead th': {
              verticalAlign: 'bottom',
              paddingRight: '0.5714286em',
              paddingBottom: '0.5714286em',
              paddingLeft: '0.5714286em',
            },
            'tbody tr': {
              borderBottomWidth: '1px',
              borderBottomColor: 'var(--border)',
            },
            'tbody tr:last-child': {
              borderBottomWidth: '0',
            },
            'tbody td': {
              verticalAlign: 'baseline',
            },
            tfoot: {
              borderTopWidth: '1px',
              borderTopColor: 'var(--border)',
            },
            'tfoot td': {
              verticalAlign: 'top',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
  darkMode: 'class',
}