import { useEffect, useRef, useState, type ElementType } from 'react'
import { formatInr } from '../domain/money'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function MoneyFigure({ paise, className, as }: { paise: number; className?: string; as?: ElementType }) {
  const Tag = as ?? 'strong'
  const shownRef = useRef(paise)
  const [shown, setShown] = useState(paise)

  useEffect(() => {
    if (prefersReducedMotion()) {
      shownRef.current = paise
      setShown(paise)
      return
    }
    const origin = shownRef.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 620)
      const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress)
      const next = Math.round(origin + (paise - origin) * eased)
      shownRef.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paise])

  return <Tag className={className}>{formatInr(shown)}</Tag>
}
