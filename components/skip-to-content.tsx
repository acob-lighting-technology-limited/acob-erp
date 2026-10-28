/** First focusable element in every app shell: lets keyboard users jump past the sidebar and navbar. */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground sr-only z-[100] rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to main content
    </a>
  )
}
