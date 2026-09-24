import { ref } from 'vue'
import { getApi } from '@renderer/lib/bridge'

export type ThemeMode = 'dark' | 'light'

const storageKey = 'uniphrase-theme'
const backgrounds: Record<ThemeMode, string> = {
  dark: '#17171c',
  light: '#f4f4f6'
}

export const theme = ref<ThemeMode>('dark')

export function readTheme(): ThemeMode {
  const stored = localStorage.getItem(storageKey)
  return stored === 'light' ? 'light' : 'dark'
}

export function applyTheme(mode: ThemeMode): void {
  theme.value = mode
  document.documentElement.dataset.theme = mode
  localStorage.setItem(storageKey, mode)
  void getApi().setWindowBackground(backgrounds[mode])
}

export function toggleTheme(): void {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}
