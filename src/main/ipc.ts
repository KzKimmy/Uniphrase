import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EngineEntry, FileFilter, OpenTextOptions, SaveTextOptions, SelectOptions, SessionData, Settings } from '@shared/contracts'
import { cancelEngine, extractAssets, probeEngine, readJsonFile, repackAssets, writeJsonAtomic } from './engine'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'session.json')
}

function loadSettings(): Settings {
  const stored = readJsonFile<Partial<Settings>>(settingsPath(), {})
  return {
    enginePath: typeof stored.enginePath === 'string' ? stored.enginePath : '',
    classDataPath: typeof stored.classDataPath === 'string' ? stored.classDataPath : ''
  }
}

function asPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function asEntries(value: unknown): EngineEntry[] {
  if (!Array.isArray(value)) throw new Error('Translations must be an array.')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid translation entry.')
    const row = item as Record<string, unknown>
    const text = (field: string): string => {
      const current = row[field]
      if (typeof current === 'string') return current
      if (typeof current === 'number' && Number.isFinite(current)) return String(current)
      return ''
    }
    return {
      assetPath: text('assetPath'),
      pathId: text('pathId'),
      fieldPath: text('fieldPath'),
      type: text('type'),
      name: text('name'),
      original: text('original'),
      translation: text('translation')
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dialog:selectPath', async (_event, options: SelectOptions) => {
    const win = getWindow()
    if (!win) return null
    const dialogOptions: OpenDialogOptions = {
      title: options?.title || 'Select a path',
      properties: options?.kind === 'directory' ? ['openDirectory'] : ['openFile'],
      filters: toFilters(options?.filters)
    }
    const result = await dialog.showOpenDialog(win, dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:saveText', async (_event, options: SaveTextOptions, contents: unknown) => {
    const win = getWindow()
    if (!win) return null
    if (typeof contents !== 'string') throw new Error('File contents must be text.')
    const result = await dialog.showSaveDialog(win, {
      title: options?.title || 'Save file',
      defaultPath: options?.defaultPath,
      filters: toFilters(options?.filters)
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, contents, 'utf8')
    return result.filePath
  })

  ipcMain.handle('file:writeText', async (_event, path: unknown, contents: unknown) => {
    if (typeof contents !== 'string') throw new Error('File contents must be text.')
    writeFileSync(asPath(path, 'path'), contents, 'utf8')
  })

  ipcMain.handle('dialog:openText', async (_event, options: OpenTextOptions) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: options?.title || 'Open file',
      properties: ['openFile'],
      filters: toFilters(options?.filters)
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    return { path, contents: readFileSync(path, 'utf8') }
  })

  ipcMain.handle('engine:extract', async (event, input: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getWindow()
    if (!win) return { ok: false, message: 'Window is not available.' }
    try {
      return await extractAssets(win, loadSettings(), asPath(input, 'input'))
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Extract failed.' }
    }
  })

  ipcMain.handle('engine:repack', async (event, input: unknown, entries: unknown, outputDir: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getWindow()
    if (!win) return { ok: false, message: 'Window is not available.' }
    try {
      return await repackAssets(win, loadSettings(), asPath(input, 'input'), asEntries(entries), asPath(outputDir, 'output'))
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Repack failed.' }
    }
  })

  ipcMain.handle('engine:cancel', async () => {
    cancelEngine()
  })

  ipcMain.handle('settings:get', async () => loadSettings())

  ipcMain.handle('settings:set', async (_event, settings: Settings) => {
    const next: Settings = {
      enginePath: typeof settings?.enginePath === 'string' ? settings.enginePath : '',
      classDataPath: typeof settings?.classDataPath === 'string' ? settings.classDataPath : ''
    }
    writeJsonAtomic(settingsPath(), next)
    return next
  })

  ipcMain.handle('engine:probe', async () => probeEngine(loadSettings()))

  ipcMain.handle('session:read', async () => {
    const session = readJsonFile<SessionData | null>(sessionPath(), null)
    if (!session || !Array.isArray(session.entries)) return null
    return session
  })

  ipcMain.handle('session:write', async (_event, session: SessionData) => {
    if (!session || !Array.isArray(session.entries)) throw new Error('Invalid session.')
    writeJsonAtomic(sessionPath(), {
      sourcePath: typeof session.sourcePath === 'string' ? session.sourcePath : '',
      projectPath: typeof session.projectPath === 'string' ? session.projectPath : '',
      entries: asEntries(session.entries)
    })
  })

  ipcMain.handle('window:minimize', async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('window:close', async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:setBackground', async (event, color: unknown) => {
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return
    BrowserWindow.fromWebContents(event.sender)?.setBackgroundColor(color)
  })
}

function toFilters(filters: FileFilter[] | undefined): FileFilter[] | undefined {
  if (!Array.isArray(filters) || filters.length === 0) return undefined
  return filters
    .filter((filter) => filter && typeof filter.name === 'string' && Array.isArray(filter.extensions))
    .map((filter) => ({
      name: filter.name,
      extensions: filter.extensions.map((extension) => String(extension).replace(/^\./, ''))
    }))
}
