<script setup lang="ts">
import type { AiResult, Settings } from '@shared/contracts'
import { defaultSettings } from '@shared/contracts'
import { getApi } from '@renderer/lib/bridge'
import { useTranslationStore } from '@renderer/stores/translation'
import { X } from 'lucide-vue-next'
import { ref, watch } from 'vue'

const store = useTranslationStore()
const api = getApi()
const draft = ref<Settings>({ ...defaultSettings })
const testingAi = ref(false)
const aiStatus = ref('')
const aiOk = ref(false)

watch(
  () => store.settingsOpen,
  async (open) => {
    if (!open) return
    draft.value = { ...defaultSettings, ...(await api.getSettings()) }
    aiStatus.value = ''
    aiOk.value = false
  }
)

async function save(): Promise<void> {
  try {
    await api.setSettings({ ...draft.value })
    aiOk.value = true
    aiStatus.value = 'Saved.'
    await store.probe()
  } catch (error) {
    aiOk.value = false
    aiStatus.value = error instanceof Error ? error.message : 'Could not save settings.'
  }
}

async function testApi(): Promise<void> {
  testingAi.value = true
  aiStatus.value = 'Checking the API key…'
  aiOk.value = false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await api.setSettings({ ...draft.value })
    const result = await Promise.race([
      api.testAi(),
      new Promise<AiResult>((resolve) => {
        timer = setTimeout(() => {
          void api.cancelAi()
          resolve({ ok: false, message: 'The API did not respond in time.' })
        }, 10_000)
      })
    ])
    aiOk.value = result.ok
    aiStatus.value = result.message
  } catch (error) {
    aiOk.value = false
    aiStatus.value = error instanceof Error ? error.message : 'The API request failed.'
  } finally {
    clearTimeout(timer)
    testingAi.value = false
  }
}
</script>

<template>
  <div v-if="store.settingsOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-6">
    <div class="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[14px] font-medium text-zinc-100">Settings</div>
          <p class="mt-1 text-[12px] leading-5 text-zinc-500">
            The API key stays on this computer and is sent only to the base URL below.
          </p>
        </div>
        <button class="close" title="Close" @click="store.settingsOpen = false">
          <X class="h-4 w-4" />
        </button>
      </div>

      <label class="mt-4 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">API key</label>
      <input v-model="draft.aiApiKey" type="password" autocomplete="off" class="field mt-1 w-full" placeholder="sk-..." />

      <label class="mt-4 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Base URL</label>
      <input v-model="draft.aiBaseUrl" class="field mt-1 w-full" placeholder="https://api.openai.com/v1" />

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Model</label>
          <input v-model="draft.aiModel" class="field mt-1 w-full" placeholder="gpt-4o-mini" />
        </div>
        <div>
          <label class="block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Target language</label>
          <input v-model="draft.aiLanguage" class="field mt-1 w-full" placeholder="Thai" />
        </div>
      </div>

      <p v-if="aiStatus" class="mt-3 text-[12px] leading-5" :class="aiOk ? 'text-emerald-300' : 'text-amber-300'">{{ aiStatus }}</p>

      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button class="ghost" :disabled="testingAi" @click="testApi()">{{ testingAi ? 'Testing…' : 'Test API' }}</button>
        <button class="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950" @click="save()">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field {
  height: 32px;
  min-width: 0;
  flex: 1;
  border-radius: 6px;
  border: 1px solid var(--color-zinc-800);
  background: var(--color-zinc-950);
  padding: 0 8px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--color-zinc-200);
  outline: none;
}

.field:focus {
  border-color: rgba(129, 140, 248, 0.5);
}

.ghost {
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-zinc-800);
  padding: 0 10px;
  font-size: 12px;
  color: var(--color-zinc-200);
}

.ghost:hover:not(:disabled) {
  background: var(--color-zinc-900);
}

.close {
  display: flex;
  height: 28px;
  width: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-zinc-400);
}

.close:hover {
  background: var(--color-zinc-800);
  color: var(--color-zinc-100);
}
</style>
