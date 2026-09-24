import { setDefaultResultOrder } from 'node:dns'
import { Agent as HttpAgent, request as httpRequest, type IncomingMessage } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'
import type { AiResult, AiTextItem, AiTranslation, Settings } from '@shared/contracts'

setDefaultResultOrder('ipv4first')

let activeRequest: { destroy: () => void } | null = null

export function cancelAi(): void {
  activeRequest?.destroy()
  activeRequest = null
}

export async function testAi(settings: Settings): Promise<AiResult> {
  const ready = validateSettings(settings)
  if (!ready.ok) return ready
  try {
    const models = await listModels(ready.settings)
    const wanted = ready.settings.aiModel.toLowerCase()
    const found = models.some((id) => {
      const name = id.toLowerCase()
      return name === wanted || name.endsWith(`/${wanted}`)
    })
    if (models.length > 0 && !found) {
      return { ok: false, message: `The key was accepted, but "${ready.settings.aiModel}" is not in the model list.` }
    }
    return { ok: true, message: found ? `${ready.settings.aiModel} is available.` : 'API key accepted.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The API request failed.' }
  }
}

export async function translateAi(settings: Settings, items: AiTextItem[]): Promise<AiResult> {
  const ready = validateSettings(settings)
  if (!ready.ok) return ready
  if (items.length === 0) return { ok: true, message: 'Nothing to translate.', items: [] }

  try {
    const matched = await translateChunk(ready.settings, items)
    if (matched.length === 0) return { ok: false, message: 'The model returned no translations.' }
    return { ok: true, message: `Translated ${matched.length} strings.`, items: matched }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The API request failed.' }
  }
}

async function translateChunk(settings: Settings, items: AiTextItem[]): Promise<AiTranslation[]> {
  try {
    return await requestTranslations(settings, items)
  } catch (error) {
    if (items.length < 2 || !canSplit(error)) throw error
    const mid = Math.ceil(items.length / 2)
    const left = await translateChunk(settings, items.slice(0, mid)).catch(() => [] as AiTranslation[])
    const right = await translateChunk(settings, items.slice(mid)).catch(() => [] as AiTranslation[])
    if (left.length + right.length === 0) throw error
    return [...left, ...right]
  }
}

async function requestTranslations(settings: Settings, items: AiTextItem[]): Promise<AiTranslation[]> {
  const payload = items.map((item, index) => ({ id: String(index + 1), text: item.text }))
  const language = settings.aiLanguage.trim() || 'Thai'
  const instruction = [
    `Translate each video game string into ${language}.`,
    'Reply with JSON only, shaped as {"items":[{"id":"1","translation":"..."}]}.',
    'Copy each id exactly. Preserve line breaks, Unity rich-text tags, and placeholders such as {0}, {name}, %s, %d, and \\n.',
    'Do not add notes or translate control codes.'
  ].join(' ')
  const chars = payload.reduce((sum, item) => sum + item.text.length + 24, 0)
  const content = await complete(settings, `${instruction}\n\n${JSON.stringify(payload)}`, Math.min(8192, Math.max(1024, Math.ceil(chars * 1.5))))
  const translated = parseModelJson(content)
  const matched = translated.flatMap((item) => {
    const index = Number(item.id) - 1
    const source = items[index]
    if (!source || !Number.isInteger(index) || item.translation.length === 0) return []
    return [{ id: source.id, translation: item.translation }]
  })
  if (matched.length === 0) throw new Error('The model returned no translations.')
  return matched
}

function apiErrorMessage(status: number, body: unknown): string {
  const record = Array.isArray(body) ? body.find((item) => item && typeof item === 'object') : body
  const error =
    record && typeof record === 'object' && 'error' in record
      ? (record as { error?: { message?: string; status?: string } }).error
      : undefined
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  if (status === 429 || error?.status === 'RESOURCE_EXHAUSTED') {
    return message && !/^the api returned/i.test(message) ? message : 'The API rate limit was reached (429).'
  }
  return message || `The API returned ${status}.`
}

function canSplit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /json|empty response|cut off|no translations/i.test(message)
}

function validateSettings(settings: Settings): { ok: true; settings: Settings } | { ok: false; message: string } {
  const aiApiKey = settings.aiApiKey.trim()
  const aiModel = settings.aiModel.trim()
  const aiBaseUrl = settings.aiBaseUrl.trim().replace(/\/+$/, '')
  if (!aiApiKey) return { ok: false, message: 'Add an API key in Settings.' }
  if (!aiModel) return { ok: false, message: 'Add a model name in Settings.' }
  let url: URL
  try {
    url = new URL(aiBaseUrl)
  } catch {
    return { ok: false, message: 'The API base URL is not valid.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: 'The API base URL must start with https:// or http://.' }
  }
  return {
    ok: true,
    settings: { ...settings, aiApiKey, aiModel, aiBaseUrl }
  }
}

async function listModels(settings: Settings): Promise<string[]> {
  const response = await requestJson(settings, '/models', 'GET', undefined, 8_000)
  const body = response.body as { data?: { id?: string }[] } | null
  return (body?.data ?? []).flatMap((model) => (typeof model.id === 'string' && model.id.length > 0 ? [model.id] : []))
}

function isGemini(settings: Settings): boolean {
  return settings.aiBaseUrl.includes('generativelanguage.googleapis.com') || settings.aiModel.toLowerCase().includes('gemini')
}

async function complete(settings: Settings, prompt: string, maxTokens: number): Promise<string> {
  const body: Record<string, unknown> = {
    model: settings.aiModel,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  }
  if (isGemini(settings)) body.reasoning_effort = 'none'
  try {
    return await readCompletion(settings, body)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!/response_format|json_object/i.test(message)) throw error
    delete body.response_format
    return readCompletion(settings, body)
  }
}

async function readCompletion(settings: Settings, body: Record<string, unknown>): Promise<string> {
  const response = await requestJson(settings, '/chat/completions', 'POST', body, 90_000)
  const payload = response.body as {
    choices?: { finish_reason?: string; message?: { content?: unknown } }[]
  } | null
  const choice = payload?.choices?.[0]
  const content = readContent(choice?.message?.content)
  if (choice?.finish_reason === 'length') throw new Error('The translation was cut off.')
  if (!content.trim()) throw new Error('The model returned an empty response.')
  return content
}

function readContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text
      }
      return ''
    })
    .join('')
}

function requestJson(
  settings: Settings,
  path: string,
  method: 'GET' | 'POST',
  payload: unknown,
  timeoutMs: number
): Promise<{ status: number; body: unknown }> {
  activeRequest?.destroy()
  const url = new URL(`${settings.aiBaseUrl}${path}`)
  const data = payload === undefined ? undefined : Buffer.from(JSON.stringify(payload))
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest

  const secure = url.protocol === 'https:'
  const agent = secure
    ? new HttpsAgent({ keepAlive: false, timeout: timeoutMs, family: 4 })
    : new HttpAgent({ keepAlive: false, timeout: timeoutMs, family: 4 })

  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error, result?: { status: number; body: unknown }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      agent.destroy()
      if (activeRequest === req) activeRequest = null
      if (error) reject(error)
      else resolve(result ?? { status: 0, body: null })
    }

    const req = send(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        agent,
        headers: {
          authorization: `Bearer ${settings.aiApiKey}`,
          accept: 'application/json',
          connection: 'close',
          ...(url.hostname.endsWith('googleapis.com') ? { 'x-goog-api-key': settings.aiApiKey } : {}),
          ...(data
            ? { 'content-type': 'application/json', 'content-length': String(data.length) }
            : {})
        },
        timeout: timeoutMs
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let body: unknown = null
          try {
            body = text ? JSON.parse(text) : null
          } catch {
            body = null
          }
          const status = res.statusCode ?? 0
          if (status < 200 || status >= 300) {
            finish(new Error(apiErrorMessage(status, body)))
            return
          }
          finish(undefined, { status, body })
        })
        res.on('error', (error) => finish(error))
      }
    )

    timer = setTimeout(() => {
      req.destroy()
      finish(new Error('The API did not respond in time.'))
    }, timeoutMs)

    activeRequest = req
    req.on('timeout', () => {
      req.destroy()
      finish(new Error('The API did not respond in time.'))
    })
    req.on('error', (error) => {
      const closed = /aborted|destroyed|timeout/i.test(error.message)
      finish(closed ? new Error('The API did not respond in time.') : error)
    })
    if (data) req.write(data)
    req.end()
  })
}

export function parseModelJson(content: string): AiTranslation[] {
  const fenced = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = Math.min(...['{', '['].map((mark) => {
    const index = fenced.indexOf(mark)
    return index < 0 ? Number.POSITIVE_INFINITY : index
  }))
  const endObject = fenced.lastIndexOf('}')
  const endArray = fenced.lastIndexOf(']')
  const end = Math.max(endObject, endArray)
  const json = Number.isFinite(start) && end > start ? fenced.slice(start, end + 1) : fenced
  const parsed = parseLooseJson(json)
  const list = translationList(parsed)
  return list.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : typeof row.id === 'number' && Number.isFinite(row.id) ? String(row.id) : ''
    const translation = ['translation', 'text', 'translated'].map((key) => row[key]).find((value) => typeof value === 'string')
    return id && typeof translation === 'string' ? [{ id, translation }] : []
  })
}

function parseLooseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    try {
      return JSON.parse(json.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      throw new Error('The model did not return JSON.')
    }
  }
}

function translationList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== 'object') return []
  const record = parsed as Record<string, unknown>
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.translations)) return record.translations
  return Object.entries(record).flatMap(([id, value]) => (typeof value === 'string' ? [{ id, translation: value }] : []))
}
