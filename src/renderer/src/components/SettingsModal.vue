<script setup lang="ts">
import type { Settings } from '@shared/contracts'
import { getApi } from '@renderer/lib/bridge'
import { useTranslationStore } from '@renderer/stores/translation'
import { ref, watch } from 'vue'

const store = useTranslationStore()
const api = getApi()
const draft = ref<Settings>({ enginePath: '', classDataPath: '' })
const probing = ref(false)

watch(
  () => store.settingsOpen,
  async (open) => {
    if (!open) return
    draft.value = await api.getSettings()
  }
)

async function browse(field: keyof Settings): Promise<void> {
  const path = await api.selectPath({
    kind: 'file',
    title: field === 'enginePath' ? 'Select unity-core-engine' : 'Select classdata.tpk',
    filters:
      field === 'enginePath'
        ? [
            { name: 'Engine', extensions: ['exe', 'dll'] },
            { name: 'All files', extensions: ['*'] }
          ]
        : [
            { name: 'Class database', extensions: ['tpk'] },
            { name: 'All files', extensions: ['*'] }
          ]
  })
  if (path) draft.value = { ...draft.value, [field]: path }
}

async function save(test: boolean): Promise<void> {
  await api.setSettings(draft.value)
  if (test) {
    probing.value = true
    await store.probe()
    probing.value = false
    store.showToast(store.engine.ok ? `Engine ${store.engine.version} ready` : store.engine.message)
    return
  }
  store.settingsOpen = false
  await store.probe()
}
</script>

<template>
  <div v-if="store.settingsOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-6" @click.self="store.settingsOpen = false">
    <div class="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
      <div class="text-[14px] font-medium text-zinc-100">Settings</div>
      <p class="mt-1 text-[12px] leading-5 text-zinc-500">
        The engine is the self-contained <span class="font-mono text-zinc-400">unity-core-engine.exe</span> published into resources/bin.
      </p>

      <label class="mt-4 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Engine path</label>
      <div class="mt-1 flex gap-2">
        <input v-model="draft.enginePath" class="field" placeholder="Default search path" />
        <button class="ghost" @click="browse('enginePath')">Browse</button>
      </div>

      <label class="mt-4 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">classdata.tpk</label>
      <div class="mt-1 flex gap-2">
        <input v-model="draft.classDataPath" class="field" placeholder="Bundled beside the engine" />
        <button class="ghost" @click="browse('classDataPath')">Browse</button>
      </div>

      <p class="mt-3 min-h-5 font-mono text-[11px] text-zinc-500">{{ store.engine.message }}</p>

      <div class="mt-4 flex justify-end gap-2">
        <button class="ghost" @click="store.settingsOpen = false">Cancel</button>
        <button class="ghost" :disabled="probing" @click="save(true)">{{ probing ? 'Testing…' : 'Test connection' }}</button>
        <button class="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950" @click="save(false)">Save</button>
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
</style>
