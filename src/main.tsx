import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

try {
  const savedTheme = localStorage.getItem('pii-shield-theme')
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }
} catch {
  // Ignore storage restrictions
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
