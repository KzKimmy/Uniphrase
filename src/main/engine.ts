import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { app, type BrowserWindow } from 'electron'
import type { EngineEntry, EngineEvent, EngineProbe, EngineResult, Settings } from '@shared/contracts'

interface ResolvedEngine {
  command: string
  prefix: string[]
  path: string
}

interface RunResult {
  code: number | null
  events: EngineEvent[]
  stderr: string
  error?: string
  cancelled: boolean
}

let active: ChildProcess | null = null
let cancelRequested = false

const exeRelative = [
  join('resources', 'bin', 'unity-core-engine.exe'),
  join('backend', 'UnityAssetEngine', 'bin', 'Release', 'net8.0', 'win-x64', 'unity-core-engine.exe'),
  join('backend', 'UnityAssetEngine', 'bin', 'Debug', 'net8.0', 'win-x64', 'unity-core-engine.exe'),
  join('backend', 'UnityAssetEngine', 'bin', 'Release', 'net8.0', 'unity-core-engine.exe'),
  join('bin', 'unity-core-engine.exe')
]

const dllRelative = [
  join('backend', 'UnityAssetEngine', 'bin', 'Release', 'net8.0', 'win-x64', 'unity-core-engine.dll'),
  join('backend', 'UnityAssetEngine', 'bin', 'Debug', 'net8.0', 'unity-core-engine.dll'),
  join('backend', 'UnityAssetEngine', 'bin', 'Release', 'net8.0', 'unity-core-engine.dll')
]

export function cancelEngine(): void {
  cancelRequested = true
  if (active && active.exitCode === null && !active.killed) {
    active.kill()
  }
}

export function resolveEngine(customPath?: string): ResolvedEngine | null {
  if (customPath && customPath.trim().length > 0) {
    const full = customPath.trim()
    if (!existsSync(full)) return null
    if (full.toLowerCase().endsWith('.dll')) {
      return { command: 'dotnet', prefix: [full], path: full }
    }
    return { command: full, prefix: [], path: full }
  }

  const roots = [
    process.cwd(),
    app.getAppPath(),
    join(app.getAppPath(), '..'),
    join(app.getAppPath(), '..', '..'),
    process.resourcesPath
  ].filter((root): root is string => Boolean(root))

  for (const root of roots) {
    for (const relative of exeRelative) {
      const full = join(root, relative)
      if (existsSync(full)) return { command: full, prefix: [], path: full }
    }
  }

  for (const root of roots) {
    for (const relative of dllRelative) {
      const full = join(root, relative)
      if (existsSync(full)) return { command: 'dotnet', prefix: [full], path: full }
    }
  }

  return null
}

export async function probeEngine(settings: Settings): Promise<EngineProbe> {
  const resolved = resolveEngine(settings.enginePath)
  if (!resolved) {
    return {
      ok: false,
      path: '',
      version: '',
      message: 'Engine not found. Run npm run engine:publish.',
      classDataLoaded: false
    }
  }

  const args = ['version']
  if (settings.classDataPath) args.push('--classdata', settings.classDataPath)
  const result = await runEngine(resolved, args)
  const version = result.events.find((event) => event.type === 'version')
  const message = version?.message || result.error || result.stderr || 'Engine did not respond.'
  return {
    ok: result.code === 0 && Boolean(version),
    path: resolved.path,
    version: version?.version ?? '',
    message,
    classDataLoaded: Boolean(version?.classDataLoaded)
  }
}

export async function extractAssets(win: BrowserWindow, settings: Settings, input: string): Promise<EngineResult> {
  const resolved = requireEngine(settings)
  if (!resolved.ok) return resolved.result

  const output = join(app.getPath('temp'), `uniphrase-extract-${Date.now()}.json`)
  const args = ['extract', '--input', input, '--output', output, ...classDataArgs(settings)]
  const result = await runEngine(resolved.engine, args, win)
  if (result.cancelled) return { ok: false, message: 'Extract cancelled.' }
  if (result.code !== 0) return { ok: false, message: failureMessage(result, 'Extract failed.') }

  try {
    const entries = JSON.parse(readFileSync(output, 'utf8')) as EngineEntry[]
    if (!Array.isArray(entries)) return { ok: false, message: 'Engine output was not a JSON array.' }
    const done = result.events.find((event) => event.type === 'done')
    return {
      ok: true,
      message: done?.message ?? `Extracted ${entries.length} strings.`,
      entries,
      outputPath: output
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not read the extract file.' }
  } finally {
    rmSync(output, { force: true })
  }
}

export async function repackAssets(
  win: BrowserWindow,
  settings: Settings,
  input: string,
  entries: EngineEntry[]
): Promise<EngineResult> {
  const resolved = requireEngine(settings)
  if (!resolved.ok) return resolved.result

  const translations = join(app.getPath('temp'), `uniphrase-repack-${Date.now()}.json`)
  writeFileSync(translations, JSON.stringify(entries))
  const args = ['repack', '--input', input, '--translations', translations, ...classDataArgs(settings)]
  try {
    const result = await runEngine(resolved.engine, args, win)
    if (result.cancelled) return { ok: false, message: 'Repack cancelled.' }
    if (result.code !== 0) return { ok: false, message: failureMessage(result, 'Repack failed.') }
    const done = result.events.find((event) => event.type === 'done')
    return {
      ok: true,
      message: done?.message ?? 'Repack finished.',
      applied: done?.applied ?? done?.count,
      outputPath: done?.output ?? input
    }
  } finally {
    rmSync(translations, { force: true })
  }
}

function requireEngine(settings: Settings): { ok: true; engine: ResolvedEngine } | { ok: false; result: EngineResult } {
  const engine = resolveEngine(settings.enginePath)
  if (!engine) {
    return { ok: false, result: { ok: false, message: 'Engine not found. Run npm run engine:publish.' } }
  }
  return { ok: true, engine }
}

function classDataArgs(settings: Settings): string[] {
  return settings.classDataPath ? ['--classdata', settings.classDataPath] : []
}

function failureMessage(result: RunResult, fallback: string): string {
  const error = [...result.events].reverse().find((event) => event.type === 'error')
  return error?.message || result.error || result.stderr.trim() || fallback
}

function runEngine(resolved: ResolvedEngine, args: string[], win?: BrowserWindow): Promise<RunResult> {
  if (active && active.exitCode === null) {
    return Promise.resolve({
      code: null,
      events: [],
      stderr: '',
      error: 'The engine is already running.',
      cancelled: false
    })
  }

  cancelRequested = false
  return new Promise((resolve) => {
    const events: EngineEvent[] = []
    let stderr = ''
    let settled = false
    const decoder = new StringDecoder('utf8')
    let buffer = ''

    const finish = (code: number | null, error?: string): void => {
      if (settled) return
      settled = true
      active = null
      const trailing = (buffer + decoder.end()).trim()
      if (trailing) consume(trailing)
      resolve({
        code,
        events,
        stderr: stderr.slice(-4000),
        error,
        cancelled: cancelRequested
      })
    }

    const consume = (line: string): void => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return
      try {
        const event = JSON.parse(trimmed) as EngineEvent
        events.push(event)
        if (win && !win.isDestroyed()) win.webContents.send('engine:event', event)
      } catch {
        // Non-JSON stdout is ignored so library noise cannot break the stream.
      }
    }

    let child: ChildProcess
    try {
      child = spawn(resolved.command, [...resolved.prefix, ...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      finish(null, error instanceof Error ? error.message : 'Failed to start the engine.')
      return
    }

    active = child
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += decoder.write(chunk)
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) consume(line)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 8000) stderr = stderr.slice(-8000)
    })
    child.on('error', (error) => finish(null, error.message))
    child.on('close', (code) => finish(code))
  })
}

export function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(value))
  rmSync(path, { force: true })
  renameSync(temporary, path)
}
