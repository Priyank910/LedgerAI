import { useState } from 'react'

export type ThemeName = 'light' | 'dark'

export function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('ledger-ai-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#141414' : '#F6B400')
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(readTheme)
  function choose(next: ThemeName) {
    applyTheme(next)
    setTheme(next)
  }
  return { theme, choose }
}
