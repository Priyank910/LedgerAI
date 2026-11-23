import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './styles.css'
import './ui/dashboard.css'

const savedTheme = localStorage.getItem('ledger-ai-theme')
if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.dataset.theme = savedTheme

const root = document.getElementById('root')
if (!root) throw new Error('root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
