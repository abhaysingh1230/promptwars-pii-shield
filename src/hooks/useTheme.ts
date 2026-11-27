import { useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'pii-shield-theme'

/**
 * Manages the active dark/light workstation theme and syncs only the UI preference locally.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark'
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage restrictions in private browsing
    }
  }, [theme])

  return { theme, setTheme }
}
