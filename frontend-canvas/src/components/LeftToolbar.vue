<script setup lang="ts">
defineProps<{
  canUndo: boolean
  canRedo: boolean
  nodeTypes: { type: string; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'add-node', type: string): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'open-asset-manager'): void
  (e: 'open-preset-manager'): void
}>()
</script>

<template>
  <div class="fixed left-3 top-1/2 -translate-y-1/2 z-40 grid grid-cols-2 gap-x-0.5 gap-y-1 bg-base-100/90 backdrop-blur rounded-xl py-4 px-2 shadow-sm border border-base-300 w-[128px] place-items-center">
    <button
      v-for="nt in nodeTypes"
      :key="nt.type"
      class="btn btn-ghost btn-sm h-auto w-14 flex-col gap-0.5 py-2 px-0 min-h-0 "
      @click="emit('add-node', nt.type)"
    >
      <!-- 文本图标 -->
      <svg v-if="nt.type === 'text'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 7 4 4 20 4 20 7"/>
        <line x1="9" y1="20" x2="15" y2="20"/>
        <line x1="12" y1="4" x2="12" y2="20"/>
      </svg>

      <!-- 图片图标 -->
      <svg v-else-if="nt.type === 'image'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>

      <!-- 视频图标 -->
      <svg v-else-if="nt.type === 'video'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>

      <!-- 表格图标 -->
      <svg v-else-if="nt.type === 'table'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>

      <!-- 全图图标 -->
      <svg v-else-if="nt.type === 'full_image'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
        <path d="M2 16l5-5 4 4 3-3 8 8"/>
        <circle cx="8" cy="8" r="1.5"/>
      </svg>

      <!-- 智能体图标 -->
      <svg v-else-if="nt.type === 'agent'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
        <circle cx="9" cy="9" r="1.5"/>
        <circle cx="15" cy="9" r="1.5"/>
        <path d="M9 14c.83 1.5 2.5 2.5 3 2.5s2.17-1 3-2.5"/>
      </svg>

      <!-- 工作流图标 -->
      <svg v-else-if="nt.type === 'workflow'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="2" width="6" height="6" rx="1"/>
        <rect x="2" y="16" width="6" height="6" rx="1"/>
        <rect x="16" y="16" width="6" height="6" rx="1"/>
        <line x1="12" y1="8" x2="5" y2="16"/>
        <line x1="12" y1="8" x2="19" y2="16"/>
      </svg>

      <!-- 资产加载图标 -->
      <svg v-else-if="nt.type === 'asset'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>

      <!-- 导演台图标 -->
      <svg v-else-if="nt.type === 'director'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>

      <span class="text-[10px] leading-tight text-base-content/50">{{ nt.label }}</span>
    </button>

    <!-- 分隔线 -->
    <div class="col-span-2 w-[100px] h-px bg-base-300 my-0.5" />

    <!-- 撤销 -->
    <button
      class="btn btn-ghost btn-sm h-auto w-14 flex-col gap-0.5 py-2 px-0 min-h-0"
      @click="emit('undo')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7v6h6"/>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
      </svg>
      <span class="text-[10px] leading-tight text-base-content/50">撤销</span>
    </button>

    <!-- 重做 -->
    <button
      class="btn btn-ghost btn-sm h-auto w-14 flex-col gap-0.5 py-2 px-0 min-h-0 "
      @click="emit('redo')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 7v6h-6"/>
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
      </svg>
      <span class="text-[10px] leading-tight text-base-content/50">重做</span>
    </button>

    <!-- 分隔线 -->
    <div class="col-span-2 w-[100px] h-px bg-base-300 my-0.5" />

    <!-- 资产管理 -->
    <button
      class="btn btn-ghost btn-sm h-auto w-14 flex-col gap-0.5 py-2 px-0 min-h-0 "
      @click="emit('open-asset-manager')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="text-[10px] leading-tight text-base-content/50">资产库</span>
    </button>

    <!-- 预设管理 -->
    <button
      class="btn btn-ghost btn-sm h-auto w-14 flex-col gap-0.5 py-2 px-0 min-h-0 "
      @click="emit('open-preset-manager')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span class="text-[10px] leading-tight text-base-content/50">预设</span>
    </button>
  </div>
</template>