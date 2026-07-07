<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import type { Node, Edge, ViewportState } from '../types'
import CanvasNode from './CanvasNode.vue'
import TextNodePanel from './panels/TextNodePanel.vue'
import ImageNodePanel from './panels/ImageNodePanel.vue'
import VideoNodePanel from './panels/VideoNodePanel.vue'
import TableNodePanel from './panels/TableNodePanel.vue'
import FullImageNodePanel from './panels/FullImageNodePanel.vue'
import AgentNodePanel from './panels/AgentNodePanel.vue'
import WorkflowNodePanel from './panels/WorkflowNodePanel.vue'
import AssetNodePanel from './panels/AssetNodePanel.vue'
import ScriptEditorModal from './ScriptEditorModal.vue'
import DirectorEditorModal from './DirectorEditorModal.vue'

const panelMap: Record<string, any> = {
  text: TextNodePanel,
  image: ImageNodePanel,
  video: VideoNodePanel,
  table: TableNodePanel,
  full_image: FullImageNodePanel,
  agent: AgentNodePanel,
  workflow: WorkflowNodePanel,
  asset: AssetNodePanel,
}

const props = defineProps<{
  viewport: ViewportState
  worldStyle: Record<string, string>
  gridStyle: Record<string, string>
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  selectedNode: Node | null
  nodeZIndices: Record<string, number>
  assets: any[]
  snapToGrid: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'deselect'): void
  (e: 'move-node', id: string, x: number, y: number): void
  (e: 'resize-node', id: string, width: number, height: number, x: number, y: number): void
  (e: 'image-loaded', id: string, w: number, h: number): void
  (e: 'add-node', type: string, wx: number, wy: number): void
  (e: 'add-connected-node', type: string, wx: number, wy: number, sourceNodeId: string): void
  (e: 'create-edge', sourceNodeId: string, targetNodeId: string): void
  (e: 'delete-edge', edgeId: string): void
  (e: 'save-panel', content: string): void
  (e: 'save-node-content', nodeId: string, content: string): void
  (e: 'remove-connected-edge', edgeId: string): void
  (e: 'update-asset', id: string, data: { category?: string; tags?: string }): void
  (e: 'remove-asset', id: string): void
  (e: 'create-asset-from-screenshot', imageUrl: string, name: string): void
  (e: 'grid-split', data: { cols: number; rows: number; urls: string[] }): void
}>()

// 连线拖拽状态
const connecting = ref<{
  sourceNodeId: string
  sourceDir: string
  mx: number
  my: number
} | null>(null)

// 磁吸目标
const SNAP_THRESHOLD = 28
const snapTarget = ref<{ nodeId: string; dir: string } | null>(null)

// 拉线空白处弹出菜单
const connectMenu = ref<{ x: number; y: number; sourceNodeId: string } | null>(null)
const connectMenuTypes = [
  { type: 'text', label: '文本', icon: '<path d="M1 3h14M1 7h8M1 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>' },
  { type: 'image', label: '图片', icon: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="5" cy="5.5" r="1.2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1.5 11l3-3 2.5 2.5 2-2 5.5 5.5" stroke="currentColor" stroke-width="1.5" fill="none"/>' },
  { type: 'video', label: '视频', icon: '<rect x="1.5" y="3" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="12 4.5 12 11.5 14.5 8" fill="currentColor"/>' },
  { type: 'table', label: '剧本', icon: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="1.5" y1="6" x2="14.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" stroke-width="1.2"/>' },
  { type: 'agent', label: '智能体', icon: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="6.5" r="1" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="10" cy="6.5" r="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 10c.5 1 1.5 1.5 2 1.5s1.5-.5 2-1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>' },
  { type: 'asset', label: '资产', icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5"/>' },
]

// 节点内容区水平边距（匹配 CanvasNode mx-2 = 0.5rem = 8px）
const CONTENT_MARGIN = 8

// 面板贴合选中节点底部（世界坐标）
const PANEL_GAP = 12
const PANEL_EXTRA_W = 160
const panelStyle = computed(() => {
  const node = props.selectedNode
  if (!node) return { display: 'none', position: '', left: '', top: '', width: '', zIndex: '' }
  // 拖拽/缩放过程中隐藏面板，避免位置跟随卡顿；松手后重新显示
  if (dragOffsets[node.id] || resizeOffsets[node.id]) {
    return { display: 'none', position: '', left: '', top: '', width: '', zIndex: '' }
  }
  const x = node.x
  const y = node.y + node.height
  const w = node.width
  const pw = Math.max(w + PANEL_EXTRA_W, 320)
  return {
    display: '',
    position: 'absolute',
    left: `${x - PANEL_EXTRA_W / 2}px`,
    top: `${y + PANEL_GAP}px`,
    width: `${pw}px`,
    zIndex: '50',
  }
})

// 计算每个节点的连线输入（上游节点的数据流到下游）
interface InputData {
  edgeId: string
  sourceNodeId: string
  sourceNodeType: string
  data: any
}
const nodeInputs = computed(() => {
  const map: Record<string, InputData[]> = {}
  for (const edge of props.edges) {
    const source = getNode(edge.source_node_id)
    if (!source) continue
    let data: any = source.content || null
    if (source.node_type === 'asset' && source.content) {
      try { data = JSON.parse(source.content) } catch { /* keep raw */ }
    }
    if (source.node_type === 'image' && source.content) {
      try {
        const parsed = JSON.parse(source.content)
        const gens = parsed.generated_images || []
        data = gens.length > 0 ? { dataUrl: gens[0].url } : null
      } catch { /* keep raw */ }
    }
    if (!map[edge.target_node_id]) map[edge.target_node_id] = []
    map[edge.target_node_id].push({
      edgeId: edge.id,
      sourceNodeId: source.id,
      sourceNodeType: source.node_type,
      data,
    })
  }
  return map
})

// 节点拖拽中的实时偏移（用于边跟随移动）
const dragOffsets = reactive<Record<string, { x: number; y: number }>>({})

// 节点缩放中的实时偏移（用于面板跟随）
const resizeOffsets = reactive<Record<string, { x: number; y: number; w: number; h: number }>>({})

// 节点 id -> Node 映射,避免拖动时每帧 O(边数×节点数) 的 find 扫描
// 仅在 nodes 增删时重建(不访问 x/y,拖动不触发重建)
const nodesById = computed(() => {
  const m = new Map<string, Node>()
  for (const n of props.nodes) m.set(n.id, n)
  return m
})

function getNode(nodeId: string): Node | undefined {
  return nodesById.value.get(nodeId)
}

// 获取连接手柄的屏幕坐标
function getHandleScreenPos(nodeId: string, dir: string) {
  const n = getNode(nodeId)
  if (!n) return { sx: 0, sy: 0 }
  const cx = n.x + n.width / 2
  const cy = n.y + n.height / 2
  const v = props.viewport
  switch (dir) {
    case 'top': return { sx: cx * v.zoom + v.ox, sy: n.y * v.zoom + v.oy }
    case 'bottom': return { sx: cx * v.zoom + v.ox, sy: (n.y + n.height) * v.zoom + v.oy }
    case 'left': return { sx: n.x * v.zoom + v.ox, sy: cy * v.zoom + v.oy }
    case 'right': return { sx: (n.x + n.width) * v.zoom + v.ox, sy: cy * v.zoom + v.oy }
    default: return { sx: 0, sy: 0 }
  }
}

// 获取连接手柄的世界坐标
function getHandleWorldPos(nodeId: string, dir: string) {
  const n = getNode(nodeId)
  if (!n) return { wx: 0, wy: 0 }
  switch (dir) {
    case 'top': return { wx: n.x + n.width / 2, wy: n.y }
    case 'bottom': return { wx: n.x + n.width / 2, wy: n.y + n.height }
    case 'left': return { wx: n.x + CONTENT_MARGIN, wy: n.y + n.height / 2 }
    case 'right': return { wx: n.x + n.width - CONTENT_MARGIN, wy: n.y + n.height / 2 }
    default: return { wx: 0, wy: 0 }
  }
}

// 连线：源节点右边 -> 目标节点左边
function edgePath(edge: Edge) {
  const s = getNode(edge.source_node_id)
  const t = getNode(edge.target_node_id)
  if (!s || !t) return ''
  const so = dragOffsets[edge.source_node_id]
  const to = dragOffsets[edge.target_node_id]
  const sx = (so?.x ?? s.x) + s.width - CONTENT_MARGIN
  const sy = (so?.y ?? s.y) + s.height / 2
  const tx = (to?.x ?? t.x) + CONTENT_MARGIN
  const ty = (to?.y ?? t.y) + t.height / 2
  const dx = Math.abs(tx - sx) * 0.5
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`
}

// 临时连线路径（从源节点右边拖拽到鼠标，有磁吸时吸附到手柄）
const tempPath = computed(() => {
  if (!connecting.value) return ''
  const n = getNode(connecting.value.sourceNodeId)
  if (!n) return ''
  const v = props.viewport
  // 有磁吸目标时，端点使用手柄的世界坐标
  let mx: number, my: number
  if (snapTarget.value) {
    const wp = getHandleWorldPos(snapTarget.value.nodeId, snapTarget.value.dir)
    mx = wp.wx
    my = wp.wy
  } else {
    mx = (connecting.value.mx - v.ox) / v.zoom
    my = (connecting.value.my - v.oy) / v.zoom
  }
  const so = dragOffsets[connecting.value.sourceNodeId]
  const sx = (so?.x ?? n.x) + n.width - CONTENT_MARGIN
  const sy = (so?.y ?? n.y) + n.height / 2
  const dx = Math.abs(mx - sx) * 0.5
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${mx - dx} ${my}, ${mx} ${my}`
})

// 临时连线端点圆点（有磁吸时吸附到手柄位置）
const tempEnd = computed(() => {
  if (!connecting.value) return null
  if (snapTarget.value) {
    const wp = getHandleWorldPos(snapTarget.value.nodeId, snapTarget.value.dir)
    return { cx: wp.wx, cy: wp.wy }
  }
  const v = props.viewport
  return {
    cx: (connecting.value.mx - v.ox) / v.zoom,
    cy: (connecting.value.my - v.oy) / v.zoom,
  }
})

// 检查添加 sourceId -> targetId 是否会形成环路（DFS）
function wouldCreateCycle(sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true
  const visited = new Set<string>()
  const stack = [targetId]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (cur === sourceId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const e of props.edges) {
      if (e.source_node_id === cur && !visited.has(e.target_node_id)) {
        stack.push(e.target_node_id)
      }
    }
  }
  return false
}

const alignGuides = ref<{ type: 'h' | 'v'; pos: number; start: number; end: number }[]>([])

function onNodeDragMove(id: string, x: number, y: number) {
  if (props.snapToGrid) {
    const draggedNode = getNode(id)
    if (draggedNode) {
      const w = draggedNode.width, h = draggedNode.height
      const cx = x + w / 2, cy = y + h / 2
      const guides: { type: 'h' | 'v'; pos: number; start: number; end: number }[] = []
      let snapX = x, snapY = y
      const threshold = 5
      const alignPts: { val: number; snapTo: number; type: 'h' | 'v' }[] = []

      for (const other of props.nodes) {
        if (other.id === id) continue
        const ox = other.x, oy = other.y, ow = other.width, oh = other.height
        // 左边对齐
        if (Math.abs(x - ox) < threshold) alignPts.push({ val: x, snapTo: ox, type: 'v' })
        if (Math.abs(x + w - ox - ow) < threshold) alignPts.push({ val: x + w, snapTo: ox + ow, type: 'v' })
        if (Math.abs(x + w - ox) < threshold) alignPts.push({ val: x + w, snapTo: ox, type: 'v' })
        if (Math.abs(x - ox - ow) < threshold) alignPts.push({ val: x, snapTo: ox + ow, type: 'v' })
        // 垂直居中
        if (Math.abs(cx - (ox + ow / 2)) < threshold) alignPts.push({ val: cx, snapTo: ox + ow / 2, type: 'v' })
        // 上边对齐
        if (Math.abs(y - oy) < threshold) alignPts.push({ val: y, snapTo: oy, type: 'h' })
        if (Math.abs(y + h - oy - oh) < threshold) alignPts.push({ val: y + h, snapTo: oy + oh, type: 'h' })
        if (Math.abs(y + h - oy) < threshold) alignPts.push({ val: y + h, snapTo: oy, type: 'h' })
        if (Math.abs(y - oy - oh) < threshold) alignPts.push({ val: y, snapTo: oy + oh, type: 'h' })
        // 水平居中
        if (Math.abs(cy - (oy + oh / 2)) < threshold) alignPts.push({ val: cy, snapTo: oy + oh / 2, type: 'h' })
      }

      for (const pt of alignPts) {
        if (pt.type === 'v') {
          snapX += pt.snapTo - pt.val
          guides.push({ type: 'v', pos: pt.snapTo, start: Math.min(y, snapY), end: Math.max(y + h, snapY + h) })
        } else {
          snapY += pt.snapTo - pt.val
          guides.push({ type: 'h', pos: pt.snapTo, start: Math.min(x, snapX), end: Math.max(x + w, snapX + w) })
        }
      }

      alignGuides.value = guides
      x = snapX
      y = snapY
    }
  }
  dragOffsets[id] = { x, y }
}

function onNodeDragEnd(id: string, x: number, y: number) {
  alignGuides.value = []
  emit('move-node', id, x, y)
  nextTick(() => delete dragOffsets[id])
}

function onNodeResizeMove(id: string, w: number, h: number, x: number, y: number) {
  resizeOffsets[id] = { x, y, w, h }
}

function onNodeResizeEnd(id: string, w: number, h: number, x: number, y: number) {
  emit('resize-node', id, w, h, x, y)
  nextTick(() => {
    delete resizeOffsets[id]
  })
}

function onConnectStart(nodeId: string, dir: string, e: PointerEvent) {
  connecting.value = {
    sourceNodeId: nodeId,
    sourceDir: dir,
    mx: e.clientX,
    my: e.clientY,
  }
  document.addEventListener('pointermove', onConnectMove)
  document.addEventListener('pointerup', onConnectEnd)
}

function onConnectMove(e: PointerEvent) {
  if (!connecting.value) return
  e.preventDefault()
  connecting.value.mx = e.clientX
  connecting.value.my = e.clientY

  // 磁吸检测：只扫描实际存在的 left/right 手柄，并排除会造成环路的节点
  let best: { nodeId: string; dir: string; dist: number } | null = null
  for (const node of props.nodes) {
    if (node.id === connecting.value.sourceNodeId) continue
    if (wouldCreateCycle(connecting.value.sourceNodeId, node.id)) continue
    for (const dir of ['left', 'right']) {
      const pos = getHandleScreenPos(node.id, dir)
      const dist = Math.hypot(e.clientX - pos.sx, e.clientY - pos.sy)
      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        best = { nodeId: node.id, dir, dist }
      }
    }
  }
  snapTarget.value = best ? { nodeId: best.nodeId, dir: best.dir } : null
}

function onConnectEnd(e: PointerEvent) {
  if (!connecting.value) return
  document.removeEventListener('pointermove', onConnectMove)
  document.removeEventListener('pointerup', onConnectEnd)

  const sourceNodeId = connecting.value.sourceNodeId
  const mouseX = e.clientX
  const mouseY = e.clientY

  let targetNodeId: string | null = null

  // 优先检测精确命中连接手柄
  const target = document.elementFromPoint(mouseX, mouseY) as HTMLElement | null
  const handle = target?.closest('[data-connect-handle]') as HTMLElement | null
  if (handle) {
    targetNodeId = handle.dataset.nodeId ?? null
  }

  // 回退到磁吸目标
  if (!targetNodeId && snapTarget.value) {
    targetNodeId = snapTarget.value.nodeId
  }

  // 环路检测
  if (targetNodeId && wouldCreateCycle(sourceNodeId, targetNodeId)) {
    targetNodeId = null
  }

  if (targetNodeId && targetNodeId !== sourceNodeId) {
    emit('create-edge', sourceNodeId, targetNodeId)
  } else if (!targetNodeId) {
    // 拖到空白处 → 弹出创建节点菜单
    connectMenu.value = { x: mouseX, y: mouseY, sourceNodeId }
  }

  connecting.value = null
  snapTarget.value = null
}

function onConnectMenuClick(type: string) {
  if (!connectMenu.value) return
  const { x, y, sourceNodeId } = connectMenu.value
  const v = props.viewport
  const wx = (x - v.ox) / v.zoom
  const wy = (y - v.oy) / v.zoom
  connectMenu.value = null
  emit('add-connected-node', type, wx, wy, sourceNodeId)
}

function closeConnectMenu() {
  connectMenu.value = null
}

const showScriptEditor = ref(false)
const showDirectorEditor = ref(false)

function onPanelSave(content: string) {
  emit('save-panel', content)
}
</script>

<template>
  <div
    class="canvas-viewport"
    :style="{ touchAction: 'none', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', cursor: connecting ? 'crosshair' : 'grab', backgroundColor: '#0d0e14' }"
  >
    <!-- 网格层 -->
    <div :style="gridStyle" />

    <!-- 世界层 -->
    <div :style="worldStyle">
      <!-- SVG 连线层 -->
      <svg
        class="absolute top-0 left-0 pointer-events-none"
        style="width: 1px; height: 1px; overflow: visible;"
      >
        <!-- 已有连线 -->
        <path
          v-for="edge in edges"
          :key="edge.id"
          :d="edgePath(edge)"
          stroke="rgba(255,255,255,0.25)"
          stroke-width="2"
          fill="none"
          class="pointer-events-auto cursor-pointer hover:stroke-error hover:stroke-[3px] transition-colors"
          @click.stop="emit('delete-edge', edge.id)"
          @pointerdown.stop
          @pointerup.stop
        />
        <!-- 临时拖拽连线 -->
        <path
          v-if="connecting"
          :d="tempPath"
          stroke="rgba(96,165,250,0.9)"
          stroke-width="2"
          fill="none"
          stroke-dasharray="6 3"
          stroke-linecap="round"
        />
        <circle
          v-if="connecting && tempEnd"
          :cx="tempEnd.cx"
          :cy="tempEnd.cy"
          :r="4"
          fill="rgba(96,165,250,0.9)"
        />
      </svg>

      <!-- 对齐辅助线 -->
      <svg class="pointer-events-none absolute inset-0 overflow-visible">
        <line v-for="(g, i) in alignGuides" :key="i"
          :x1="g.type === 'v' ? g.pos : g.start" :y1="g.type === 'v' ? g.start : g.pos"
          :x2="g.type === 'v' ? g.pos : g.end"   :y2="g.type === 'v' ? g.end : g.pos"
          stroke="rgba(59,130,246,0.6)" stroke-width="1" stroke-dasharray="4 2"
        />
      </svg>

      <CanvasNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :selected="node.id === selectedNodeId"
        :zoom="viewport.zoom"
        :z-index="nodeZIndices[node.id] ?? 0"
        :connecting="connecting !== null"
        :snap-target="snapTarget"
        :assets="assets"
        @select="emit('select', node.id)"
        @drag-end="onNodeDragEnd(node.id, $event.x, $event.y)"
        @drag-move="onNodeDragMove(node.id, $event.x, $event.y)"
        @resize-end="onNodeResizeEnd(node.id, $event.width, $event.height, $event.x, $event.y)"
        @resize-move="onNodeResizeMove(node.id, $event.width, $event.height, $event.x, $event.y)"
        @connect-start="onConnectStart(node.id, $event.dir, $event.e)"
        @save-content="(content: string) => emit('save-node-content', node.id, content)"
        @edit-script="showScriptEditor = true"
        @edit-director="showDirectorEditor = true"
        @grid-split="(data: any) => emit('grid-split', data)"
        @image-loaded="($event: any) => emit('image-loaded', node.id, $event.w, $event.h)"
        @dblclick.prevent
      />

      <component
        v-if="selectedNode?.node_type !== 'text' && selectedNode?.node_type !== 'asset' && selectedNode?.node_type !== 'table'"
        :is="panelMap[selectedNode?.node_type ?? '']"
        :node="selectedNode"
        :panel-style="panelStyle"
        :node-inputs="nodeInputs[selectedNode?.id ?? ''] ?? []"
        :assets="assets"
        @save="onPanelSave"
        @remove-connected-edge="(edgeId: string) => emit('remove-connected-edge', edgeId)"
        @update-asset="(id: string, data: any) => emit('update-asset', id, data)"
        @remove-asset="(id: string) => emit('remove-asset', id)"
        @create-asset-node="(imageUrl: string, name: string) => emit('create-asset-from-screenshot', imageUrl, name)"
      />
    </div>

    <!-- 拉线空白处弹出创建节点菜单 -->
    <Teleport to="body">
      <div v-if="connectMenu" class="fixed z-[9999]" :style="{ left: connectMenu.x + 'px', top: connectMenu.y + 'px', transform: 'translate(-50%, 12px)' }" @pointerdown.stop>
        <div class="flex w-[196px] flex-col gap-1 rounded-2xl p-2 backdrop-blur-[32px] border border-white/15 bg-neutral-900/95 shadow-xl">
          <div class="flex h-7 items-center px-2 text-xs text-white/50">引用源节点创建</div>
          <button v-for="t in connectMenuTypes" :key="t.type" class="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-white/85 hover:bg-white/10 transition-colors cursor-pointer" @click="onConnectMenuClick(t.type)">
            <svg class="shrink-0 text-white/60" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" v-html="t.icon" />
            <span class="text-[13px] truncate">{{ t.label }}</span>
          </button>
        </div>
      </div>
    </Teleport>
    <div v-if="connectMenu" class="fixed inset-0 z-[9998]" @pointerdown="closeConnectMenu" />
  </div>

  <ScriptEditorModal
    v-if="showScriptEditor && selectedNode"
    :node="selectedNode"
    @close="showScriptEditor = false"
    @save="(content: string) => { emit('save-panel', content); showScriptEditor = false }"
  />
  <DirectorEditorModal
    v-if="showDirectorEditor && selectedNode"
    :node="selectedNode"
    @close="showDirectorEditor = false"
    @save="(content: string) => { emit('save-panel', content); showDirectorEditor = false }"
  />
</template>
