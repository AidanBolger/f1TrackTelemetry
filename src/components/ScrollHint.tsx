import React from 'react'

export default function ScrollHint({ className }: { className?: string }) {
  const [clicked, setClicked] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)

  const handleClick = () => {
    try {
      const top = Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight || 0)
      window.scrollTo({ top, behavior: 'smooth' })
    } catch (e) {
      try { window.scrollTo(0, document.body.scrollHeight) } catch (e) {}
    }

    // Temporarily mark clicked so hover/focus styles are suppressed
    setClicked(true)
    // remove focus so :focus styles don't persist
    try { (ref.current as any)?.blur() } catch (e) {}
    // Clear clicked state after animation / scroll starts
    setTimeout(() => setClicked(false), 700)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      title="Scroll to bottom"
      className={`${className ? `scroll-hint ${className}` : 'scroll-hint'}${clicked ? ' clicked' : ''}`}
      onClick={handleClick}
      onKeyDown={onKey}
      aria-label="Scroll to bottom"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M12 16.5c-.27 0-.52-.11-.71-.29l-6-6a1.003 1.003 0 011.42-1.42L12 13.09l5.29-5.3a1.003 1.003 0 011.42 1.42l-6 6c-.19.18-.44.29-.71.29z" fill="currentColor"/>
      </svg>
    </div>
  )
}
