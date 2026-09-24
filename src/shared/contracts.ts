export interface EngineEntry {
  assetPath: string
  pathId: string
  fieldPath: string
  type: string
  name: string
  original: string
  translation: string
}

export interface TranslationEntry extends EngineEntry {
  id: string
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface SelectOptions {
  kind: 'file' | 'directory'
  title: string
  filters?: FileFilter[]
}

export interface Settings {
  enginePath: string
  classDataPath: string
}

export interface EngineProbe {
  ok: boolean
  path: string
  version: string
  message: string
  classDataLoaded: boolean
}

export interface EngineEvent {
  type: string
  progress?: number
  message?: string
  count?: number
  applied?: number
  output?: string
  version?: string
  classDataLoaded?: boolean
}

export interface EngineResult {
  ok: boolean
  message: string
  entries?: EngineEntry[]
  applied?: number
  outputPath?: string
}

export interface SessionData {
  sourcePath: string
  projectPath: string
  entries: EngineEntry[]
}

export interface SaveTextOptions {
  title: string
  defaultPath?: string
  filters?: FileFilter[]
}

export interface OpenTextOptions {
  title: string
  filters?: FileFilter[]
}

export interface UniphraseApi {
  platform: string
  selectPath(options: SelectOptions): Promise<string | null>
  saveTextFile(options: SaveTextOptions, contents: string): Promise<string | null>
  writeTextFile(path: string, contents: string): Promise<void>
  openTextFile(options: OpenTextOptions): Promise<{ path: string; contents: string } | null>
  extract(input: string): Promise<EngineResult>
  repack(input: string, entries: EngineEntry[], outputDir: string): Promise<EngineResult>
  cancelEngine(): Promise<void>
  onEngineEvent(listener: (event: EngineEvent) => void): () => void
  getSettings(): Promise<Settings>
  setSettings(settings: Settings): Promise<Settings>
  probeEngine(): Promise<EngineProbe>
  readSession(): Promise<SessionData | null>
  writeSession(session: SessionData): Promise<void>
  windowMinimize(): Promise<void>
  windowToggleMaximize(): Promise<void>
  windowClose(): Promise<void>
  setWindowBackground(color: string): Promise<void>
}
