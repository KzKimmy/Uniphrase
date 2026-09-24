<script setup lang="ts">
import { FolderOpen, Languages, Minus, Moon, Package, Redo2, Replace, Save, Settings, Sparkles, Square, Sun, Undo2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { assetFileName } from '@renderer/lib/entries'
import { getApi } from '@renderer/lib/bridge'
import { theme, toggleTheme } from '@renderer/lib/theme'
import { useTranslationStore } from '@renderer/stores/translation'

const store = useTranslationStore()
const extractMenu = ref(false)
const translateMenu = ref(false)
const api = getApi()
const crumb = computed(() => {
  if (store.sourcePath) return { title: assetFileName(store.sourcePath), detail: store.sourcePath }
  if (store.projectPath) return { title: assetFileName(store.projectPath), detail: store.projectPath }
  if (store.entries.length > 0) return { title: 'Unsaved workspace', detail: '' }
  return { title: 'No assets loaded', detail: '' }
})

async function extract(kind: 'file' | 'directory'): Promise<void> {
  extractMenu.value = false
  await store.extractFrom(kind)
}

function translate(scope: 'filtered' | 'all'): void {
  translateMenu.value = false
  void store.translateWithAi(scope)
}
</script>

<template>
  <header class="drag flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 pr-0">
    <div class="flex min-w-0 items-center gap-2.5 pl-3">
      <div class="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-950">
        <Languages class="h-4 w-4" />
      </div>
      <div class="leading-none">
        <div class="text-[13px] font-semibold tracking-tight text-zinc-100">Uniphrase</div>
        <div class="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Unity translator</div>
      </div>
    </div>

    <div class="h-5 w-px bg-zinc-800" />

    <div class="min-w-0 flex-1 truncate pr-3 font-mono text-[11px] text-zinc-500" :title="crumb.detail || crumb.title">
      {{ crumb.title }}
      <span v-if="crumb.detail" class="text-zinc-600"> · {{ crumb.detail }}</span>
    </div>

    <div class="no-drag flex items-center gap-1.5 pr-1">
      <button class="icon-btn" title="Open project" @click="store.openProject()">
        <FolderOpen class="h-4 w-4" />
      </button>
      <button class="icon-btn" title="Save project (Ctrl+S)" :disabled="store.entries.length === 0" @click="store.saveProject(false)">
        <Save class="h-4 w-4" />
      </button>

      <div class="relative">
        <button class="primary-btn" :disabled="store.task?.running" @click="extractMenu = !extractMenu">Extract</button>
        <div v-if="extractMenu" class="fixed inset-0 z-20" @click="extractMenu = false" />
        <div v-if="extractMenu" class="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-2xl">
          <button class="menu-item" @click="extract('file')">Asset or bundle file</button>
          <button class="menu-item" @click="extract('directory')">Game folder</button>
        </div>
      </div>

      <button class="secondary-btn" :disabled="store.entries.length === 0 || store.task?.running" @click="store.repack()">
        <Package class="h-3.5 w-3.5" />
        Repack
      </button>

      <div class="relative">
        <button class="secondary-btn" :disabled="store.entries.length === 0 || store.task?.running" @click="translateMenu = !translateMenu">
          <Sparkles class="h-3.5 w-3.5" />
          Translate
        </button>
        <div v-if="translateMenu" class="fixed inset-0 z-20" @click="translateMenu = false" />
        <div v-if="translateMenu" class="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-2xl">
          <button class="menu-item" @click="translate('filtered')">Empty rows in this view</button>
          <button class="menu-item" @click="translate('all')">All empty strings</button>
        </div>
      </div>

      <div class="mx-1 h-5 w-px bg-zinc-800" />

      <button class="icon-btn" title="Undo (Ctrl+Z)" :disabled="store.undoCount === 0" @click="store.undo()">
        <Undo2 class="h-4 w-4" />
      </button>
      <button class="icon-btn" title="Redo (Ctrl+Y)" :disabled="store.redoCount === 0" @click="store.redo()">
        <Redo2 class="h-4 w-4" />
      </button>
      <button class="icon-btn" title="Batch replace" :disabled="store.entries.length === 0" @click="store.replaceOpen = true">
        <Replace class="h-4 w-4" />
      </button>
      <button
        class="icon-btn"
        :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
        @click="toggleTheme()"
      >
        <Sun v-if="theme === 'dark'" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </button>
      <button class="icon-btn" title="Settings" @click="store.settingsOpen = true">
        <Settings class="h-4 w-4" />
      </button>
    </div>

    <div class="no-drag flex h-12">
      <button class="window-btn" title="Minimize" @click="api.windowMinimize()">
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button class="window-btn" title="Maximize" @click="api.windowToggleMaximize()">
        <Square class="h-3 w-3" />
      </button>
      <button class="window-btn hover:bg-red-600 hover:text-white" title="Close" @click="api.windowClose()">
        <X class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.icon-btn,
.primary-btn,
.secondary-btn,
.menu-item,
.window-btn {
  transition: background-color 120ms ease, color 120ms ease;
}

.icon-btn {
  display: flex;
  height: 28px;
  width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-zinc-400);
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-zinc-800);
  color: var(--color-zinc-100);
}

.icon-btn:disabled {
  opacity: 0.35;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
}

.primary-btn {
  background: var(--color-zinc-100);
  color: var(--color-zinc-950);
}

.primary-btn:hover:not(:disabled) {
  background: var(--color-zinc-200);
}

.secondary-btn {
  border: 1px solid var(--color-zinc-800);
  background: var(--color-zinc-900);
  color: var(--color-zinc-200);
}

.secondary-btn:hover:not(:disabled) {
  background: var(--color-zinc-800);
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.4;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  color: var(--color-zinc-200);
}

.menu-item:hover {
  background: var(--color-zinc-800);
}

.window-btn {
  display: flex;
  width: 46px;
  align-items: center;
  justify-content: center;
  color: var(--color-zinc-400);
}

.window-btn:hover {
  background: var(--color-zinc-800);
  color: var(--color-zinc-100);
}
</style>
