<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { useTranslationStore } from '@renderer/stores/translation'

const store = useTranslationStore()
</script>

<template>
  <div v-if="store.task" class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-6">
    <div class="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
      <div class="flex items-center gap-2 text-[13px] font-medium text-zinc-100">
        <LoaderCircle v-if="store.task.running" class="h-4 w-4 animate-spin text-zinc-400" />
        {{ store.task.kind === 'extract' ? 'Extracting strings' : store.task.kind === 'translate' ? 'Translating with AI' : 'Building patch' }}
      </div>
      <p class="mt-3 min-h-10 text-[13px] leading-5 text-zinc-400">{{ store.task.error || store.task.message }}</p>
      <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div class="h-full bg-zinc-100 transition-[width] duration-200" :style="{ width: `${store.task.progress}%` }" />
      </div>
      <div class="mt-2 flex items-center justify-between font-mono text-[11px] text-zinc-500">
        <span>{{ store.task.running ? (store.task.kind === 'translate' ? 'Requesting' : 'Engine running') : store.task.error ? 'Stopped' : 'Finished' }}</span>
        <span>{{ Math.round(store.task.progress) }}%</span>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          v-if="store.task.running"
          class="rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-900"
          @click="store.cancelTask()"
        >
          Cancel
        </button>
        <button
          v-else
          class="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950"
          @click="store.dismissTask()"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
