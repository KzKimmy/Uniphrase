import type { EngineEntry, EngineEvent, EngineProbe } from '@shared/contracts'
import { demoEntries, stressEntries } from '@renderer/data/demo'
import { getApi, isDesktop } from '@renderer/lib/bridge'
import { assignIds, normalizeEntries, toEngineEntries } from '@renderer/lib/entries'
import { applyReplace, type ReplaceOptions } from '@renderer/lib/replace'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TranslationEntry } from '@shared/contracts'

export type QueryMode = 'all' | 'original' | 'translation'
export type StatusFilter = 'all' | 'missing' | 'translated'
export type TypeFilter = 'all' | 'TextAsset' | 'MonoBehaviour'

export interface TaskState {
  kind: 'extract' | 'repack'
  progress: number
  message: string
  running: boolean
  error: string
}

export interface AssetGroup {
  path: string
  total: number
  done: number
  percent: number
}

const jsonFilters = [{ name: 'JSON', extensions: ['json'] }]
const assetFilters = [
  { name: 'Unity assets', extensions: ['assets', 'bundle', 'unity3d', 'assetbundle', 'ab'] },
  { name: 'All files', extensions: ['*'] }
]

export const useTranslationStore = defineStore('translation', () => {
  const entries = ref<TranslationEntry[]>([])
  const rows = ref<TranslationEntry[]>([])
  const sourcePath = ref('')
  const projectPath = ref('')
  const selectedAsset = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const query = ref('')
  const queryMode = ref<QueryMode>('all')
  const useRegex = ref(false)
  const regexError = ref('')
  const statusFilter = ref<StatusFilter>('all')
  const typeFilter = ref<TypeFilter>('all')
  const assetQuery = ref('')
  const dirty = ref(false)
  const ready = ref(false)
  const revision = ref(0)
  const desktop = ref(isDesktop())
  const toastMessage = ref('')
  const settingsOpen = ref(false)
  const replaceOpen = ref(false)
  const task = ref<TaskState | null>(null)
  const engine = ref<EngineProbe>({
    ok: false,
    path: '',
    version: '',
    message: 'Checking engine…',
    classDataLoaded: false
  })
  const undoCount = ref(0)
  const redoCount = ref(0)

  const byId = new Map<string, TranslationEntry>()
  const undoStack: string[] = []
  const redoStack: string[] = []
  let editing = false
  let editBaseline: string | null = null
  let toastTimer = 0

  const assets = computed<AssetGroup[]>(() => {
    const groups = new Map<string, AssetGroup>()
    for (const entry of entries.value) {
      let group = groups.get(entry.assetPath)
      if (!group) {
        group = { path: entry.assetPath, total: 0, done: 0, percent: 0 }
        groups.set(entry.assetPath, group)
      }
      group.total += 1
      if (entry.translation.trim().length > 0) group.done += 1
    }
    return [...groups.values()]
      .map((group) => ({ ...group, percent: group.total === 0 ? 0 : Math.round((group.done / group.total) * 100) }))
      .sort((a, b) => a.path.localeCompare(b.path))
  })

  const visibleAssets = computed(() => {
    const needle = assetQuery.value.trim().toLowerCase()
    if (!needle) return assets.value
    return assets.value.filter((asset) => asset.path.toLowerCase().includes(needle))
  })

  const stats = computed(() => {
    const total = entries.value.length
    const done = entries.value.reduce((count, entry) => count + (entry.translation.trim() ? 1 : 0), 0)
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      visible: rows.value.length
    }
  })

  const activeAssetLabel = computed(() => {
    if (!selectedAsset.value) return entries.value.length ? 'All assets' : 'No asset loaded'
    return selectedAsset.value
  })

  function showToast(message: string): void {
    toastMessage.value = message
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastMessage.value = ''
    }, 2800)
  }

  function indexEntries(): void {
    byId.clear()
    for (const entry of entries.value) byId.set(entry.id, entry)
  }

  function currentMap(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const entry of entries.value) map[entry.id] = entry.translation
    return map
  }

  function syncHistoryCounts(): void {
    undoCount.value = undoStack.length
    redoCount.value = redoStack.length
  }

  function pushHistory(beforeJson: string): void {
    undoStack.push(beforeJson)
    if (undoStack.length > 40) undoStack.shift()
    redoStack.length = 0
    syncHistoryCounts()
  }

  function recomputeView(): void {
    const needle = query.value
    let expression: RegExp | null = null
    regexError.value = ''
    if (useRegex.value && needle) {
      try {
        expression = new RegExp(needle, 'i')
      } catch (error) {
        regexError.value = error instanceof Error ? error.message : 'Invalid regular expression.'
      }
    }

    const asset = selectedAsset.value
    rows.value = entries.value.filter((entry) => {
      if (asset && entry.assetPath !== asset) return false
      if (typeFilter.value !== 'all' && entry.type !== typeFilter.value) return false
      const translated = entry.translation.trim().length > 0
      if (statusFilter.value === 'missing' && translated) return false
      if (statusFilter.value === 'translated' && !translated) return false
      if (!needle) return true
      const haystack =
        queryMode.value === 'original'
          ? entry.original
          : queryMode.value === 'translation'
            ? entry.translation
            : `${entry.original}\n${entry.translation}\n${entry.name}\n${entry.pathId}\n${entry.fieldPath}`
      if (useRegex.value) return expression ? expression.test(haystack) : false
      return haystack.toLowerCase().includes(needle.toLowerCase())
    })
  }

  function setDocument(raw: EngineEntry[], meta: { sourcePath?: string; projectPath?: string; dirty?: boolean }): void {
    entries.value = assignIds(raw)
    indexEntries()
    sourcePath.value = meta.sourcePath ?? sourcePath.value
    projectPath.value = meta.projectPath ?? ''
    dirty.value = meta.dirty ?? false
    selectedAsset.value = null
    selectedId.value = entries.value[0]?.id ?? null
    undoStack.length = 0
    redoStack.length = 0
    editing = false
    editBaseline = null
    syncHistoryCounts()
    recomputeView()
    revision.value += 1
  }

  function updateTranslation(id: string, value: string): void {
    const entry = byId.get(id)
    if (!entry || entry.translation === value) return
    if (!editing) {
      editing = true
      editBaseline = JSON.stringify(currentMap())
    }
    entry.translation = value
    dirty.value = true
    revision.value += 1
  }

  function beginEdit(): void {
    if (editing) return
    editing = true
    editBaseline = JSON.stringify(currentMap())
  }

  function endEdit(): void {
    window.setTimeout(() => {
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement && active.dataset.role === 'translation') return
      commitEdit(true)
    }, 0)
  }

  function commitEdit(refreshView: boolean): void {
    if (!editing) return
    const now = JSON.stringify(currentMap())
    if (editBaseline && now !== editBaseline) pushHistory(editBaseline)
    editing = false
    editBaseline = null
    if (refreshView) recomputeView()
  }

  function applyMap(json: string): void {
    const map = JSON.parse(json) as Record<string, string>
    for (const entry of entries.value) {
      if (Object.prototype.hasOwnProperty.call(map, entry.id)) entry.translation = map[entry.id]
    }
    dirty.value = true
    revision.value += 1
    recomputeView()
  }

  function undo(): void {
    commitEdit(false)
    const previous = undoStack.pop()
    if (!previous) return
    redoStack.push(JSON.stringify(currentMap()))
    syncHistoryCounts()
    applyMap(previous)
  }

  function redo(): void {
    commitEdit(false)
    const next = redoStack.pop()
    if (!next) return
    undoStack.push(JSON.stringify(currentMap()))
    syncHistoryCounts()
    applyMap(next)
  }

  function copyOriginal(id: string): void {
    const entry = byId.get(id)
    if (!entry || entry.translation === entry.original) return
    pushHistory(JSON.stringify(currentMap()))
    entry.translation = entry.original
    dirty.value = true
    revision.value += 1
    recomputeView()
  }

  function clearTranslation(id: string): void {
    const entry = byId.get(id)
    if (!entry || entry.translation.length === 0) return
    pushHistory(JSON.stringify(currentMap()))
    entry.translation = ''
    dirty.value = true
    revision.value += 1
    recomputeView()
  }

  function targetEntries(scope: 'filtered' | 'all'): TranslationEntry[] {
    return scope === 'filtered' ? rows.value : entries.value
  }

  function batchReplace(options: ReplaceOptions, scope: 'filtered' | 'all'): number {
    commitEdit(false)
    const before = JSON.stringify(currentMap())
    let count = 0
    for (const entry of targetEntries(scope)) {
      const source = options.source === 'original' ? entry.original : entry.translation
      if (options.source === 'translation' && source.length === 0) continue
      const next = applyReplace(source, options)
      if (next === entry.translation) continue
      entry.translation = next
      count += 1
    }
    if (count > 0) {
      pushHistory(before)
      dirty.value = true
      revision.value += 1
      recomputeView()
    }
    return count
  }

  function fillEmpty(scope: 'filtered' | 'all'): number {
    commitEdit(false)
    const before = JSON.stringify(currentMap())
    let count = 0
    for (const entry of targetEntries(scope)) {
      if (entry.translation.trim().length > 0 || entry.original.length === 0) continue
      entry.translation = entry.original
      count += 1
    }
    if (count > 0) {
      pushHistory(before)
      dirty.value = true
      revision.value += 1
      recomputeView()
    }
    return count
  }

  function selectAsset(path: string | null): void {
    selectedAsset.value = path
    recomputeView()
    selectedId.value = rows.value[0]?.id ?? null
  }

  function setQuery(value: string): void {
    query.value = value
    recomputeView()
  }

  function setQueryMode(mode: QueryMode): void {
    queryMode.value = mode
    recomputeView()
  }

  function setRegex(enabled: boolean): void {
    useRegex.value = enabled
    recomputeView()
  }

  function setStatusFilter(filter: StatusFilter): void {
    statusFilter.value = filter
    recomputeView()
  }

  function setTypeFilter(filter: TypeFilter): void {
    typeFilter.value = filter
    recomputeView()
  }

  function onEngineEvent(event: EngineEvent): void {
    if (!task.value || !task.value.running) return
    if (event.type === 'progress') {
      task.value = {
        ...task.value,
        progress: typeof event.progress === 'number' ? event.progress : task.value.progress,
        message: event.message || task.value.message
      }
    } else if (event.type === 'log' || event.type === 'warning' || event.type === 'done') {
      task.value = { ...task.value, message: event.message || task.value.message }
    } else if (event.type === 'error') {
      task.value = { ...task.value, message: event.message || 'Engine error', error: event.message || 'Engine error' }
    }
  }

  function startTask(kind: TaskState['kind'], message: string): void {
    task.value = { kind, progress: 1, message, running: true, error: '' }
  }

  function failTask(message: string): void {
    task.value = {
      kind: task.value?.kind ?? 'extract',
      progress: task.value?.progress ?? 0,
      message,
      running: false,
      error: message
    }
  }

  async function finishSoon(): Promise<void> {
    if (task.value) task.value = { ...task.value, progress: 100, running: true, error: '' }
    await new Promise((resolve) => window.setTimeout(resolve, 420))
    task.value = null
  }

  function dismissTask(): void {
    task.value = null
  }

  async function probe(): Promise<void> {
    engine.value = await getApi().probeEngine()
  }

  async function bootstrap(): Promise<void> {
    desktop.value = isDesktop()
    await probe()
    const session = await getApi().readSession()
    if (session?.entries?.length) {
      setDocument(normalizeEntries(session.entries), {
        sourcePath: session.sourcePath,
        projectPath: session.projectPath,
        dirty: false
      })
      showToast('Restored the previous session')
    }
    ready.value = true
  }

  async function persistSession(): Promise<void> {
    if (!ready.value) return
    try {
      await getApi().writeSession({
        sourcePath: sourcePath.value,
        projectPath: projectPath.value,
        entries: toEngineEntries(entries.value)
      })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the session.')
    }
  }

  async function extractFrom(kind: 'file' | 'directory'): Promise<void> {
    if (task.value?.running) return
    if (dirty.value && entries.value.length > 0 && !window.confirm('Replace the current workspace?')) {
      return
    }
    const input = await getApi().selectPath({
      kind,
      title: kind === 'directory' ? 'Select a Unity game folder' : 'Select a Unity asset or bundle',
      filters: kind === 'file' ? assetFilters : undefined
    })
    if (!input) return
    startTask('extract', 'Starting extract…')
    const result = await getApi().extract(input)
    if (!result.ok || !result.entries) {
      failTask(result.message)
      return
    }
    setDocument(result.entries, { sourcePath: input, projectPath: '', dirty: true })
    await finishSoon()
    showToast(result.message)
  }

  async function repack(): Promise<void> {
    if (task.value?.running || entries.value.length === 0) return
    let source = sourcePath.value
    if (!source) {
      source =
        (await getApi().selectPath({
          kind: 'directory',
          title: 'Select the original Unity folder'
        })) ?? ''
      if (!source) return
      sourcePath.value = source
    }
    const outputDir = await getApi().selectPath({
      kind: 'directory',
      title: 'Select the patched output folder'
    })
    if (!outputDir) return
    startTask('repack', 'Starting repack…')
    const result = await getApi().repack(source, toEngineEntries(entries.value), outputDir)
    if (!result.ok) {
      failTask(result.message)
      return
    }
    await finishSoon()
    showToast(result.message)
  }

  async function cancelTask(): Promise<void> {
    await getApi().cancelEngine()
  }

  async function saveProject(saveAs = false): Promise<void> {
    const contents = JSON.stringify(toEngineEntries(entries.value), null, 2)
    if (!saveAs && projectPath.value) {
      await getApi().writeTextFile(projectPath.value, contents)
      dirty.value = false
      revision.value += 1
      showToast('Project saved')
      return
    }
    const path = await getApi().saveTextFile(
      {
        title: 'Save translation project',
        defaultPath: projectPath.value || 'translations.json',
        filters: jsonFilters
      },
      contents
    )
    if (!path) return
    projectPath.value = path
    dirty.value = false
    revision.value += 1
    showToast('Project saved')
  }

  async function openProject(): Promise<void> {
    if (dirty.value && entries.value.length > 0 && !window.confirm('Open another project and replace the current workspace?')) return
    const file = await getApi().openTextFile({ title: 'Open translation project', filters: jsonFilters })
    if (!file) return
    try {
      const parsed = normalizeEntries(JSON.parse(file.contents))
      setDocument(parsed, { sourcePath: sourcePath.value, projectPath: file.path, dirty: false })
      showToast(`Opened ${parsed.length} strings`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not read that project.')
    }
  }

  function loadDemo(): void {
    setDocument(demoEntries(), { sourcePath: '', projectPath: '', dirty: true })
    showToast('Demo workspace loaded')
  }

  function loadStress(): void {
    setDocument(stressEntries(5000), { sourcePath: '', projectPath: '', dirty: true })
    showToast('Loaded 5,000 sample lines')
  }

  return {
    entries,
    rows,
    sourcePath,
    projectPath,
    selectedAsset,
    selectedId,
    query,
    queryMode,
    useRegex,
    regexError,
    statusFilter,
    typeFilter,
    assetQuery,
    dirty,
    ready,
    revision,
    desktop,
    toastMessage,
    settingsOpen,
    replaceOpen,
    task,
    engine,
    undoCount,
    redoCount,
    assets,
    visibleAssets,
    stats,
    activeAssetLabel,
    showToast,
    recomputeView,
    updateTranslation,
    beginEdit,
    endEdit,
    undo,
    redo,
    copyOriginal,
    clearTranslation,
    batchReplace,
    fillEmpty,
    selectAsset,
    setQuery,
    setQueryMode,
    setRegex,
    setStatusFilter,
    setTypeFilter,
    onEngineEvent,
    dismissTask,
    probe,
    bootstrap,
    persistSession,
    extractFrom,
    repack,
    cancelTask,
    saveProject,
    openProject,
    loadDemo,
    loadStress
  }
})
