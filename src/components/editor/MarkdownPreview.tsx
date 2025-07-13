'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div className={cn(
      'prose prose-invert max-w-none p-6 overflow-auto h-full',
      'prose-headings:text-[var(--textPrimary)]',
      'prose-p:text-[var(--textSecondary)]',
      'prose-strong:text-[var(--textPrimary)]',
      'prose-em:text-[var(--textSecondary)]',
      'prose-code:text-[var(--textPrimary)]',
      'prose-pre:bg-[var(--surface)]',
      'prose-pre:border:border-[var(--border)]',
      'prose-blockquote:border-l-[var(--accent)]',
      'prose-blockquote:text-[var(--textSecondary)]',
      'prose-hr:border-[var(--border)]',
      'prose-a:text-[var(--accent)]',
      'prose-a:hover:text-[var(--accentHover)]',
      'prose-ul:text-[var(--textSecondary)]',
      'prose-ol:text-[var(--textSecondary)]',
      'prose-li:text-[var(--textSecondary)]',
      'prose-table:border-[var(--border)]',
      'prose-th:border-[var(--border)]',
      'prose-td:border-[var(--border)]',
      'prose-img:rounded',
      className
    )}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for code blocks
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
              <pre className="bg-[var(--surface)] border border-[var(--border)] rounded p-4 overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-[var(--surface)] px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            )
          },
          // Custom styling for links
          a({ children, href, ...props }) {
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accentHover)] underline"
                {...props}
              >
                {children}
              </a>
            )
          },
          // Custom styling for headings
          h1: ({ children, ...props }) => (
            <h1 className="text-3xl font-bold text-[var(--textPrimary)] border-b border-[var(--border)] pb-2 mb-4" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-2xl font-semibold text-[var(--textPrimary)] border-b border-[var(--border)] pb-1 mb-3" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-xl font-medium text-[var(--textPrimary)] mb-2" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="text-lg font-medium text-[var(--textPrimary)] mb-2" {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="text-base font-medium text-[var(--textPrimary)] mb-1" {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="text-sm font-medium text-[var(--textPrimary)] mb-1" {...props}>
              {children}
            </h6>
          ),
          // Custom styling for lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside text-[var(--textSecondary)] space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside text-[var(--textSecondary)] space-y-1" {...props}>
              {children}
            </ol>
          ),
          // Custom styling for blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-[var(--accent)] pl-4 italic text-[var(--textSecondary)] bg-[var(--surface)] p-4 rounded" {...props}>
              {children}
            </blockquote>
          ),
          // Custom styling for tables
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-[var(--border)]" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-[var(--border)] px-4 py-2 bg-[var(--surface)] text-[var(--textPrimary)] font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-[var(--border)] px-4 py-2 text-[var(--textSecondary)]" {...props}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 