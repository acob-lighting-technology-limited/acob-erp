"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("text-muted-foreground text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-foreground mb-2 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-foreground mb-2 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-foreground mb-1 text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="text-foreground mb-1 text-sm font-medium">{children}</h4>,
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{children}</code>,
          pre: ({ children }) => <pre className="bg-muted mb-2 overflow-x-auto rounded-md p-3 text-xs">{children}</pre>,
          table: ({ children }) => <table className="mb-2 w-full border-collapse text-xs">{children}</table>,
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-border border">{children}</tr>,
          th: ({ children }) => <th className="border-border border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-border border px-2 py-1">{children}</td>,
          hr: () => <hr className="border-border my-3" />,
          blockquote: ({ children }) => (
            <blockquote className="border-border mb-2 border-l-2 pl-3 italic">{children}</blockquote>
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  )
}
