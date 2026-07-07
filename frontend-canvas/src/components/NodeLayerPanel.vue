<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '../types'

const props = defineProps<{
  nodes: Node[]
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', nodeId: string): void
}>()

const NODE_LABELS: Record<string, string> = {
  text: '文本', image: '图片', video: '视频', table: '剧本',
  full_image: '全图', agent: '智能体', workflow: '工作流',
  asset: '资产', director: '导演台',
}

const NODE_ICONS: Record<string, string> = {
  text: 'T', image: 'I', video: 'V', table: '≡',
  full_image: '◻', agent: 'A', workflow: 'W',
  asset: '↓', director: 'D',
}

const grouped = computed(() => {
  const map: Record<string, Node[]> = {}
  for (const n of props.nodes) {
    const t = n.node_type || 'other'
    if (!map[t]) map[t] = []
    map[t].push(n)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
})

// 计算同类节点序号: 文本1, 文本2...
const nodeOrder = computed(() => {
  const counter: Record<string, number> = {}
  const map: Record<string, number> = {}
  for (const n of props.nodes) {
    const t = n.node_type || 'other'
    counter[t] = (counter[t] || 0) + 1
    map[n.id] = counter[t]
  }
  return map
})

function nodeLabel(n: Node): string {
  const label = NODE_LABELS[n.node_type] || n.node_type
  const order = nodeOrder.value[n.id] || 0
  // 优先取 content 中的 name 字段
  try {
    const c = JSON.parse(n.content || '{}')
    if (c.name) return c.name
  } catch {}
  return `${label} ${order}`
}

function onClick(nodeId: string) {
  emit('select', nodeId)
}
</script>

<template>
  <div
    class="fixed top-12 right-2 bottom-16 w-48 bg-base-200/90 backdrop-blur rounded-xl border border-base-300 shadow-lg z-[9999] flex flex-col overflow-hidden select-none"
    @pointerdown.stop @click.stop @wheel.stop @dblclick.stop
  >
    <div class="px-3 py-2 text-[10px] font-extrabold text-base-content/40 uppercase tracking-widest border-b border-base-300 shrink-0">
      图层 {{ nodes.length }}
    </div>
    <div class="flex-1 overflow-y-auto py-1">
      <div v-for="[type, items] in grouped" :key="type">
        <div class="px-3 py-1 text-[9px] font-extrabold text-base-content/25 uppercase tracking-wider">
          {{ NODE_LABELS[type] || type }}
        </div>
        <div
          v-for="n in items" :key="n.id"
          class="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-base-300/50"
          :class="n.id === selectedNodeId ? 'bg-primary/10 text-primary font-bold' : 'text-base-content/60'"
          @click.stop="onClick(n.id)"
        >
          <span class="w-4 h-4 rounded flex items-center justify-center text-[9px] shrink-0 bg-base-300/50 leading-none">{{ NODE_ICONS[n.node_type] || '?' }}</span>
          <span class="truncate">{{ nodeLabel(n) }}</span>
        </div>
      </div>
      <div v-if="nodes.length === 0" class="px-3 py-4 text-[10px] text-base-content/20 text-center">暂无节点</div>
    </div>
  </div>
</template>
