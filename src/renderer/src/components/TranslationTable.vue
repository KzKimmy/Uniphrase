<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Copy, Search, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import { useTranslationStore, type QueryMode, type StatusFilter, type TypeFilter } from '@renderer/stores/translation'

const store = useTranslationStore()
const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer(
  computed(() => {
    const element = parentRef.value
    return {
      count: store.rows.length,
      getScrollElement: () => element,
      estimateSize: () => 120,
      overscan: 10
    }
  })
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

const modes: { id: QueryMode; label: string }[] = [
  { id: 'all', label: 'All fields' },
  { id: 'original', label: 'Original' },
  { id: 'translation', label: 'Translation' }
]

const statuses: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Any status' },
  { id: 'missing', label: 'Missing' },
  { id: 'translated', label: 'Translated' }
]

const types: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'TextAsset', label: 'TextAsset' },
  { id: 'MonoBehaviour', label: 'MonoBehaviour' }
]

function statusClass(original: string, translation: string): string {
  if (!translation.trim()) return 'bg-zinc-700'
  if (translation === original) return 'bg-amber-400'
  return 'bg-emerald-400'
}

async function focusRow(index: number): Promise<void> {
  if (index < 0 || index >= store.rows.length) return
  store.selectedId = store.rows[index].id
  virtualizer.value.scrollToIndex(index, { align: 'auto' })
  await nextTick()
  parentRef.value?.querySelector<HTMLTextAreaElement>(`textarea[data-row="${index}"]`)?.focus()
}
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col bg-zinc-950">
    <div class="flex flex-col gap-2 border-b border-zinc-800 px-3 py-2">
      <div class="flex items-center gap-2">
        <label class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-2">
          <Search class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <input
            id="translation-search"
            :value="store.query"
            class="h-8 w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Search original, translation, name, or path ID"
            @input="store.setQuery(($event.target as HTMLInputElement).value)"
          />
        </label>
        <button
          class="chip"
          :class="store.useRegex ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400'"
          @click="store.setRegex(!store.useRegex)"
        >
          .*
        </button>
        <div class="shrink-0 font-mono text-[11px] text-zinc-500">{{ store.stats.visible }} / {{ store.stats.total }}</div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="mode in modes"
          :key="mode.id"
          class="chip"
          :class="store.queryMode === mode.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'"
          @click="store.setQueryMode(mode.id)"
        >
          {{ mode.label }}
        </button>
        <div class="mx-1 h-4 w-px bg-zinc-800" />
        <button
          v-for="status in statuses"
          :key="status.id"
          class="chip"
          :class="store.statusFilter === status.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'"
          @click="store.setStatusFilter(status.id)"
        >
          {{ status.label }}
        </button>
        <div class="mx-1 h-4 w-px bg-zinc-800" />
        <button
          v-for="type in types"
          :key="type.id"
          class="chip"
          :class="store.typeFilter === type.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'"
          @click="store.setTypeFilter(type.id)"
        >
          {{ type.label }}
        </button>
      </div>
    </div>
    <p v-if="store.regexError" class="border-b border-zinc-800 px-3 py-1.5 text-[12px] text-amber-300">{{ store.regexError }}</p>

    <div class="grid h-9 shrink-0 grid-cols-[28px_minmax(128px,180px)_minmax(0,1fr)_minmax(0,1.1fr)_56px] items-center gap-3 border-b border-zinc-800 px-3 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
      <span />
      <span>Key</span>
      <span>Original</span>
      <span>Translation</span>
      <span />
    </div>

    <div v-if="store.rows.length === 0" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div class="text-[15px] font-medium text-zinc-200">
        {{ store.entries.length === 0 ? 'No strings loaded' : 'No strings match this filter' }}
      </div>
      <p class="max-w-md text-[13px] leading-5 text-zinc-500">
        {{
          store.entries.length === 0
            ? 'Extract a Unity .assets or .bundle file, open a translation JSON project, or load the demo workspace.'
            : 'Clear the search or switch filters to see the rest of the workspace.'
        }}
      </p>
      <div v-if="store.entries.length === 0" class="mt-2 flex gap-2">
        <button class="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950" @click="store.loadDemo()">
          Load demo
        </button>
        <button class="rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300" @click="store.loadStress()">
          Load 5,000 lines
        </button>
      </div>
    </div>

    <div v-else ref="parentRef" class="min-h-0 flex-1 overflow-auto">
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <div
          v-for="virtualRow in virtualRows"
          :key="store.rows[virtualRow.index].id"
          class="absolute left-0 top-0 grid w-full grid-cols-[28px_minmax(128px,180px)_minmax(0,1fr)_minmax(0,1.1fr)_56px] gap-3 border-b border-zinc-800/80 px-3"
          :class="store.selectedId === store.rows[virtualRow.index].id ? 'bg-zinc-900/80' : 'hover:bg-zinc-900/40'"
          :style="{ height: '120px', transform: `translateY(${virtualRow.start}px)` }"
          @click="store.selectedId = store.rows[virtualRow.index].id"
        >
          <div class="flex items-start pt-4">
            <span
              class="mt-1 h-2 w-2 rounded-full"
              :class="statusClass(store.rows[virtualRow.index].original, store.rows[virtualRow.index].translation)"
            />
          </div>
          <div class="min-w-0 pt-3">
            <div class="truncate text-[13px] text-zinc-100">{{ store.rows[virtualRow.index].name }}</div>
            <div class="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{{ store.rows[virtualRow.index].type }}</div>
            <div class="mt-1 truncate font-mono text-[10px] text-zinc-500" :title="store.rows[virtualRow.index].pathId">
              {{ store.rows[virtualRow.index].pathId }}
            </div>
            <div class="truncate font-mono text-[10px] text-zinc-600" :title="store.rows[virtualRow.index].fieldPath">
              {{ store.rows[virtualRow.index].fieldPath }}
            </div>
          </div>
          <p class="selectable line-clamp-4 whitespace-pre-wrap pt-3 text-[13px] leading-5 text-zinc-300" :title="store.rows[virtualRow.index].original">
            {{ store.rows[virtualRow.index].original }}
          </p>
          <div class="py-2">
            <textarea
              :value="store.rows[virtualRow.index].translation"
              :data-row="virtualRow.index"
              data-role="translation"
              class="h-[88px] w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[13px] leading-5 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-400/50"
              placeholder="Leave empty to keep the original"
              @focus="store.beginEdit()"
              @blur="store.endEdit()"
              @input="store.updateTranslation(store.rows[virtualRow.index].id, ($event.target as HTMLTextAreaElement).value)"
              @keydown.enter.exact.prevent="focusRow(virtualRow.index + 1)"
              @keydown.tab.exact.prevent="focusRow(virtualRow.index + 1)"
              @keydown.esc.prevent="($event.target as HTMLTextAreaElement).blur()"
            />
          </div>
          <div class="flex items-start gap-1 pt-3">
            <button class="row-btn" title="Copy original into translation" @click.stop="store.copyOriginal(store.rows[virtualRow.index].id)">
              <Copy class="h-3.5 w-3.5" />
            </button>
            <button class="row-btn" title="Clear translation" @click.stop="store.clearTranslation(store.rows[virtualRow.index].id)">
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chip {
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--color-zinc-800);
  padding: 0 8px;
  font-size: 11px;
}

.chip:hover {
  color: var(--color-zinc-100);
}

.row-btn {
  display: flex;
  height: 26px;
  width: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-zinc-500);
}

.row-btn:hover {
  background: var(--color-zinc-800);
  color: var(--color-zinc-100);
}
</style>
