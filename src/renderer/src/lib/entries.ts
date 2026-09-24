import type { EngineEntry, TranslationEntry } from '@shared/contracts'

export function normalizeEntries(raw: unknown): EngineEntry[] {
  if (!Array.isArray(raw)) throw new Error('Translation file must be a JSON array.')
  return raw.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Each translation entry must be an object.')
    const row = item as Record<string, unknown>
    return {
      assetPath: asString(row.assetPath),
      pathId: asString(row.pathId),
      fieldPath: asString(row.fieldPath),
      type: asString(row.type) || 'TextAsset',
      name: asString(row.name),
      original: asString(row.original),
      translation: asString(row.translation)
    }
  })
}

export function assignIds(entries: EngineEntry[]): TranslationEntry[] {
  const seen = new Map<string, number>()
  return entries.map((entry) => {
    const base = `${entry.assetPath}\u001f${entry.pathId}\u001f${entry.fieldPath}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return { ...entry, id: count === 0 ? base : `${base}\u001f${count}` }
  })
}

export function toEngineEntries(entries: TranslationEntry[]): EngineEntry[] {
  return entries.map(({ assetPath, pathId, fieldPath, type, name, original, translation }) => ({
    assetPath,
    pathId,
    fieldPath,
    type,
    name,
    original,
    translation
  }))
}

export function assetFileName(assetPath: string): string {
  const internal = assetPath.split('::').pop() ?? assetPath
  const parts = internal.split(/[/\\]/)
  return parts[parts.length - 1] || internal
}

export function assetHint(assetPath: string): string {
  if (assetPath.includes('::')) return assetPath.split('::')[0]
  const parts = assetPath.split(/[/\\]/)
  return parts.length > 1 ? parts.slice(0, -1).join('/') : assetPath
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}
