<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import AssetSidebar from '@renderer/components/AssetSidebar.vue'
import HeaderNav from '@renderer/components/HeaderNav.vue'
import ProgressBarModal from '@renderer/components/ProgressBarModal.vue'
import ReplaceModal from '@renderer/components/ReplaceModal.vue'
import SettingsModal from '@renderer/components/SettingsModal.vue'
import StatusBar from '@renderer/components/StatusBar.vue'
import TranslationTable from '@renderer/components/TranslationTable.vue'
import { getApi } from '@renderer/lib/bridge'
import { useTranslationStore } from '@renderer/stores/translation'

const store = useTranslationStore()
let persistTimer = 0
let removeEngineListener = (): void => undefined

function onKey(event: KeyboardEvent): void {
  const meta = event.ctrlKey || event.metaKey
  if (!meta) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    if (store.entries.length > 0) void store.saveProject(event.shiftKey)
    return
  }
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (key === 'y') {
    event.preventDefault()
    store.redo()
    return
  }
  if (key === 'f') {
    event.preventDefault()
    document.getElementById('translation-search')?.focus()
  }
}

onMounted(async () => {
  removeEngineListener = getApi().onEngineEvent((event) => store.onEngineEvent(event))
  window.addEventListener('keydown', onKey)
  await store.bootstrap()
})

onBeforeUnmount(() => {
  removeEngineListener()
  window.removeEventListener('keydown', onKey)
  window.clearTimeout(persistTimer)
})

watch(
  () => store.revision,
  () => {
    if (!store.ready) return
    window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      void store.persistSession()
    }, 700)
  }
)
</script>

<template>
  <div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
    <HeaderNav />
    <div class="flex min-h-0 flex-1">
      <AssetSidebar />
      <TranslationTable />
    </div>
    <StatusBar />
    <ProgressBarModal />
    <SettingsModal />
    <ReplaceModal />
    <div
      v-if="store.toastMessage"
      class="pointer-events-none fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12px] text-zinc-100 shadow-xl"
    >
      {{ store.toastMessage }}
    </div>
  </div>
</template>
