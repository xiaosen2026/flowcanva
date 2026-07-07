<script setup lang="ts">
import { computed } from 'vue'
import type { ViewportState, Node } from '../types'
import { useMinimap } from '../composables/useMinimap'

const props = defineProps<{
  viewport: ViewportState
  nodes: Node[]
}>()

const emit = defineEmits<{
  (e: 'navigate', wx: number, wy: number): void
}>()

const { bounds, viewportRect, nodeStyle } = useMinimap(() => props.viewport, () => props.nodes)

function onClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratioX = (e.clientX - rect.left) / rect.width
  const ratioY = (e.clientY - rect.top) / rect.height
  const b = bounds.value
  const wx = b.minX + ratioX * b.width
  const wy = b.minY + ratioY * b.height
  emit('navigate', wx, wy)
}
</script>

<template>
  <div
    class="fixed bottom-16 right-4 w-44 h-28 bg-base-200/90 rounded-lg border border-base-300 overflow-hidden z-50 shadow-sm cursor-pointer"
    @click="onClick"
  >
    <!-- 节点点 -->
    <div
      v-for="n in nodes"
      :key="n.id"
      class="absolute rounded-sm opacity-80"
      :style="{ ...nodeStyle(n), backgroundColor: 'var(--color-primary)', minWidth: '2px', minHeight: '2px' }"
    />
    <!-- 视口矩形 -->
    <div
      class="absolute border border-primary/60 bg-primary/10 rounded-sm"
      :style="viewportRect"
    />
  </div>
</template>
