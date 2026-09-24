import type { UniphraseApi } from '@shared/contracts'

declare global {
  interface Window {
    uniphrase?: UniphraseApi
  }
}

export {}
