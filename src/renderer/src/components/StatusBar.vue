<script setup lang="ts">
import { assetFileName } from '@renderer/lib/entries'
import { useTranslationStore } from '@renderer/stores/translation'

const store = useTranslationStore()
</script>

<template>
  <footer class="flex h-8 shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-500">
    <span class="max-w-[280px] truncate font-mono text-zinc-400" :title="store.activeAssetLabel">
      {{ assetFileName(store.activeAssetLabel) }}
    </span>
    <span>{{ store.stats.total.toLocaleString() }} lines</span>
    <span>{{ store.stats.percent }}% translated</span>
    <span class="hidden sm:inline">{{ store.stats.done.toLocaleString() }} filled</span>
    <span class="ml-auto flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full" :class="store.engine.ok ? 'bg-emerald-400' : 'bg-amber-400'" />
      <span>{{ store.engine.ok ? `Engine ${store.engine.version}` : store.desktop ? 'Engine offline' : 'Preview' }}</span>
    </span>
    <span class="max-w-[280px] truncate text-zinc-400">
      {{ store.task?.running ? store.task.message : store.dirty ? 'Unsaved' : 'Idle' }}
    </span>
  </footer>
</template>
