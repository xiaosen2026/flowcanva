<script setup lang="ts">
defineProps<{
  zoom: number
  showMinimap: boolean
  snapToGrid: boolean
}>()

const emit = defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'reset-view'): void
  (e: 'auto-arrange'): void
  (e: 'toggle-minimap'): void
  (e: 'toggle-snap'): void
}>()
</script>

<template>
  <div class="fixed bottom-3 right-4 z-40 flex items-center gap-1 bg-base-100/90 backdrop-blur rounded-xl py-1.5 px-1.5 shadow-sm border border-base-300">
    <!-- 整理画布 -->
    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top" data-tip="整理画布 Alt+Shift+F" @click="emit('auto-arrange')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="1" width="5" height="5" rx="1"/>
        <rect x="10" y="1" width="5" height="3" rx="1"/>
        <rect x="1" y="10" width="5" height="4" rx="1"/>
        <rect x="10" y="8" width="5" height="6" rx="1"/>
      </svg>
    </button>

    <!-- 小地图 -->
    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top"
      :class="{ 'btn-active': showMinimap }"
      data-tip="小地图" @click="emit('toggle-minimap')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.9 4c3.8 0 6.9 3.1 6.9 6.9 0 1.5-.6 3.2-1.8 4.7-1.2 1.5-2.5 2.7-3.6 3.4-.5.4-1.1.4-1.6 0-1.1-.7-2.4-2-3.6-3.4-1.2-1.5-1.8-3.2-1.8-4.7 0-3.8 3.1-6.9 6.9-6.9z"/>
        <circle cx="10.9" cy="10.9" r="2.9"/>
      </svg>
    </button>

    <!-- 网格吸附 -->
    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top"
      :class="{ 'btn-active': snapToGrid }"
      data-tip="网格吸附" @click="emit('toggle-snap')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 15 4 4"/>
        <path d="M2.4 10.6a1.2 1.2 0 0 0 0 1.7l2.3 2.3a1.2 1.2 0 0 0 1.7 0l6-6a1 1 0 1 1 3 3l-6 6a1.2 1.2 0 0 0 0 1.7l2.3 2.3a1.2 1.2 0 0 0 1.7 0l6.4-6.4A1 1 0 0 0 8.7 4.3z"/>
        <path d="M5 8l4 4"/>
      </svg>
    </button>

    <div class="w-px h-5 bg-base-300 mx-0.5" />

    <!-- 缩小 -->
    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top" data-tip="缩小" @click="emit('zoom-out')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>

    <span class="text-xs tabular-nums w-11 text-center font-medium text-base-content/60 select-none">{{ Math.round(zoom * 100) }}%</span>

    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top" data-tip="放大" @click="emit('zoom-in')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>

    <div class="w-px h-5 bg-base-300 mx-0.5" />

    <button class="btn btn-ghost btn-sm btn-square h-8 w-8 tooltip tooltip-top" data-tip="重置视图" @click="emit('reset-view')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      </svg>
    </button>
  </div>
</template>
