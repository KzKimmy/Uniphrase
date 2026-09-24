import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { EngineEvent, OpenTextOptions, SaveTextOptions, SessionData, Settings, UniphraseApi } from '@shared/contracts'

const api: UniphraseApi = {
  platform: process.platform,
  selectPath: (options) => ipcRenderer.invoke('dialog:selectPath', options),
  saveTextFile: (options: SaveTextOptions, contents: string) => ipcRenderer.invoke('dialog:saveText', options, contents),
  writeTextFile: (path: string, contents: string) => ipcRenderer.invoke('file:writeText', path, contents),
  openTextFile: (options: OpenTextOptions) => ipcRenderer.invoke('dialog:openText', options),
  extract: (input: string) => ipcRenderer.invoke('engine:extract', input),
  repack: (input, entries) => ipcRenderer.invoke('engine:repack', input, entries),
  translateAi: (items) => ipcRenderer.invoke('ai:translate', items),
  testAi: () => ipcRenderer.invoke('ai:test'),
  cancelEngine: () => ipcRenderer.invoke('engine:cancel'),
  cancelAi: () => ipcRenderer.invoke('ai:cancel'),
  onEngineEvent: (listener) => {
    const handler = (_event: IpcRendererEvent, payload: EngineEvent): void => listener(payload)
    ipcRenderer.on('engine:event', handler)
    return () => ipcRenderer.removeListener('engine:event', handler)
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Settings) =>
    ipcRenderer.invoke('settings:set', {
      enginePath: String(settings.enginePath ?? ''),
      classDataPath: String(settings.classDataPath ?? ''),
      aiBaseUrl: String(settings.aiBaseUrl ?? ''),
      aiApiKey: String(settings.aiApiKey ?? ''),
      aiModel: String(settings.aiModel ?? ''),
      aiLanguage: String(settings.aiLanguage ?? '')
    }),
  probeEngine: () => ipcRenderer.invoke('engine:probe'),
  readSession: (): Promise<SessionData | null> => ipcRenderer.invoke('session:read'),
  writeSession: (session) => ipcRenderer.invoke('session:write', session),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  setWindowBackground: (color: string) => ipcRenderer.invoke('window:setBackground', color)
}

contextBridge.exposeInMainWorld('uniphrase', api)
