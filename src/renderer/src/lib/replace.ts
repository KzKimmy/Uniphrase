export interface ReplaceOptions {
  find: string
  replacement: string
  regex: boolean
  caseSensitive: boolean
  source: 'translation' | 'original'
}

export function applyReplace(input: string, options: ReplaceOptions): string {
  const find = options.find
  if (!find) return input
  if (options.regex) {
    const flags = options.caseSensitive ? 'g' : 'gi'
    return input.replace(new RegExp(find, flags), () => options.replacement)
  }
  if (options.caseSensitive) return input.split(find).join(options.replacement)
  return input.replace(new RegExp(escapeRegExp(find), 'gi'), () => options.replacement)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
