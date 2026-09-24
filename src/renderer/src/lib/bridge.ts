import type {
  EngineEvent,
  EngineProbe,
  EngineResult,
  OpenTextOptions,
  SaveTextOptions,
  SelectOptions,
  SessionData,
  Settings,
  UniphraseApi
} from '@shared/contracts'

const sessionKey = 'uniphrase-session'
const settingsKey = 'uniphrase-settings'

function browserApi(): UniphraseApi {
  return {
    platform: 'browser',
    selectPath: async (_options: SelectOptions) => null,
    saveTextFile: async (_options: SaveTextOptions, contents: string) => {
      const blob = new Blob([contents], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'uniphrase-translations.json'
      link.click()
      URL.revokeObjectURL(url)
      return 'uniphrase-translations.json'
    },
    writeTextFile: async () => undefined,
    openTextFile: (options: OpenTextOptions) =>
      new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = options.filters?.flatMap((filter) => filter.extensions.map((ext) => `.${ext}`)).join(',') || '.json'
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) {
            resolve(null)
            return
          }
          void file.text().then((contents) => resolve({ path: file.name, contents }))
        }
        input.click()
      }),
    extract: async (): Promise<EngineResult> => ({
      ok: false,
      message: 'Extraction runs in the Electron app, where the Unity engine can be started.'
    }),
    repack: async (): Promise<EngineResult> => ({
      ok: false,
      message: 'Repack runs in the Electron app.'
    }),
    cancelEngine: async () => undefined,
    onEngineEvent: (_listener: (event: EngineEvent) => void) => () => undefined,
    getSettings: async () => readJson<Settings>(settingsKey, { enginePath: '', classDataPath: '' }),
    setSettings: async (settings) => {
      localStorage.setItem(settingsKey, JSON.stringify(settings))
      return settings
    },
    probeEngine: async (): Promise<EngineProbe> => ({
      ok: false,
      path: '',
      version: '',
      message: 'Preview mode. Open Uniphrase from Electron to connect the engine.',
      classDataLoaded: false
    }),
    readSession: async () => readJson<SessionData | null>(sessionKey, null),
    writeSession: async (session) => {
      localStorage.setItem(sessionKey, JSON.stringify(session))
    },
    windowMinimize: async () => undefined,
    windowToggleMaximize: async () => undefined,
    windowClose: async () => window.close(),
    setWindowBackground: async () => undefined
  }
}

export function getApi(): UniphraseApi {
  return window.uniphrase ?? browserApi()
}

export function isDesktop(): boolean {
  return Boolean(window.uniphrase)
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
