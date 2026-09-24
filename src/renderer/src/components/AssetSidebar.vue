<script setup lang="ts">
import { RefreshCw, Search } from 'lucide-vue-next'
import { assetFileName, assetHint } from '@renderer/lib/entries'
import { useTranslationStore } from '@renderer/stores/translation'

const store = useTranslationStore()
</script>

<template>
  <aside class="flex h-full w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
    <div class="flex items-center justify-between px-3 pt-3">
      <div class="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Assets</div>
      <div class="flex items-center gap-1.5">
        <button
          class="refresh"
          title="Refresh assets"
          :disabled="!store.sourcePath || store.task?.running"
          @click="store.refreshAssets()"
        >
          <RefreshCw class="h-3.5 w-3.5" />
        </button>
        <div class="font-mono text-[10px] text-zinc-600">{{ store.assets.length }}</div>
      </div>
    </div>

    <div class="px-3 py-2">
      <label class="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2">
        <Search class="h-3.5 w-3.5 text-zinc-500" />
        <input
          :value="store.assetQuery"
          class="h-7 w-full bg-transparent text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
          placeholder="Filter assets"
          @input="store.assetQuery = ($event.target as HTMLInputElement).value"
        />
      </label>
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-2 pb-3">
      <button
        class="asset-row"
        :class="store.selectedAsset === null ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'"
        @click="store.selectAsset(null)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-[13px]">All strings</span>
          <span class="font-mono text-[10px] text-zinc-500">{{ store.stats.total }}</span>
        </div>
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div class="h-full bg-zinc-300" :style="{ width: `${store.stats.percent}%` }" />
        </div>
      </button>

      <button
        v-for="asset in store.visibleAssets"
        :key="asset.path"
        class="asset-row"
        :class="store.selectedAsset === asset.path ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'"
        @click="store.selectAsset(asset.path)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-[13px]" :title="asset.path">{{ assetFileName(asset.path) }}</span>
          <span class="shrink-0 font-mono text-[10px] text-zinc-500">{{ asset.done }}/{{ asset.total }}</span>
        </div>
        <div class="mt-1 truncate font-mono text-[10px] text-zinc-600" :title="assetHint(asset.path)">
          {{ assetHint(asset.path) }}
        </div>
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div class="h-full bg-zinc-300" :style="{ width: `${asset.percent}%` }" />
        </div>
      </button>

      <div v-if="store.assets.length === 0" class="px-2 py-6 text-[12px] leading-5 text-zinc-600">
        Extract a Unity file to see assets here.
      </div>
    </div>
  </aside>
</template>

<style scoped>
.asset-row {
  display: block;
  width: 100%;
  border-radius: 8px;
  padding: 8px 8px 10px;
  text-align: left;
}

.refresh {
  display: flex;
  height: 22px;
  width: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-zinc-500);
}

.refresh:hover:not(:disabled) {
  background: var(--color-zinc-800);
  color: var(--color-zinc-100);
}

.refresh:disabled {
  opacity: 0.35;
}
</style>
