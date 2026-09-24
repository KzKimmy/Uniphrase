<script setup lang="ts">
import { applyReplace, type ReplaceOptions } from '@renderer/lib/replace'
import { useTranslationStore } from '@renderer/stores/translation'
import { computed, ref } from 'vue'

const store = useTranslationStore()
const find = ref('')
const replacement = ref('')
const regex = ref(false)
const caseSensitive = ref(false)
const source = ref<ReplaceOptions['source']>('translation')
const scope = ref<'filtered' | 'all'>('filtered')

const preview = computed(() => {
  if (!store.replaceOpen || !find.value) return { count: 0, error: '' }
  const options: ReplaceOptions = {
    find: find.value,
    replacement: replacement.value,
    regex: regex.value,
    caseSensitive: caseSensitive.value,
    source: source.value
  }
  try {
    const list = scope.value === 'filtered' ? store.rows : store.entries
    const count = list.filter((entry) => {
      const input = source.value === 'original' ? entry.original : entry.translation
      if (source.value === 'translation' && input.length === 0) return false
      return applyReplace(input, options) !== entry.translation
    }).length
    return { count, error: '' }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : 'Invalid pattern.' }
  }
})

function apply(): void {
  const count = store.batchReplace(
    {
      find: find.value,
      replacement: replacement.value,
      regex: regex.value,
      caseSensitive: caseSensitive.value,
      source: source.value
    },
    scope.value
  )
  store.showToast(count === 0 ? 'No strings changed' : `Updated ${count} strings`)
  if (count > 0) store.replaceOpen = false
}

function fill(): void {
  const count = store.fillEmpty(scope.value)
  store.showToast(count === 0 ? 'No empty translations' : `Filled ${count} translations`)
}
</script>

<template>
  <div v-if="store.replaceOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-6" @click.self="store.replaceOpen = false">
    <div class="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
      <div class="text-[14px] font-medium text-zinc-100">Batch replace</div>
      <p class="mt-1 text-[12px] leading-5 text-zinc-500">One undo step covers the whole batch. Empty translations are left untouched unless you fill them from the original.</p>

      <label class="mt-4 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Find</label>
      <input v-model="find" class="field mt-1 w-full" placeholder="Text or regular expression" />

      <label class="mt-3 block text-[11px] uppercase tracking-[0.14em] text-zinc-500">Replace with</label>
      <input v-model="replacement" class="field mt-1 w-full" placeholder="Replacement" />

      <div class="mt-3 flex flex-wrap gap-3 text-[12px] text-zinc-300">
        <label class="flex items-center gap-2"><input v-model="regex" type="checkbox" /> Regex</label>
        <label class="flex items-center gap-2"><input v-model="caseSensitive" type="checkbox" /> Match case</label>
        <label class="flex items-center gap-2">
          <input v-model="source" type="radio" value="translation" /> In translations
        </label>
        <label class="flex items-center gap-2">
          <input v-model="source" type="radio" value="original" /> From original
        </label>
        <label class="flex items-center gap-2">
          <input v-model="scope" type="radio" value="filtered" /> Visible rows
        </label>
        <label class="flex items-center gap-2">
          <input v-model="scope" type="radio" value="all" /> All rows
        </label>
      </div>

      <p class="mt-3 min-h-5 text-[12px]" :class="preview.error ? 'text-amber-300' : 'text-zinc-500'">
        {{ preview.error || `${preview.count} strings will change` }}
      </p>

      <div class="mt-4 flex justify-end gap-2">
        <button class="ghost" @click="store.replaceOpen = false">Cancel</button>
        <button class="ghost" @click="fill">Fill empty from original</button>
        <button class="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950" :disabled="!find || !!preview.error" @click="apply">
          Replace
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field {
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-zinc-800);
  background: var(--color-zinc-950);
  padding: 0 8px;
  font-size: 13px;
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

.ghost:hover {
  background: var(--color-zinc-900);
}
</style>
