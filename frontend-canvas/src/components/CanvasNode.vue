<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { marked } from 'marked'
import { uploadAsset } from '../api'
import { ASSET_CATEGORIES } from '../composables/useAssets'
import 'pannellum'
import 'pannellum/build/pannellum.css'

const pannellum: any = (window as any).pannellum
import type { Node } from '../types'

const props = defineProps<{
  node: Node
  selected: boolean
  zoom: number
  zIndex: number
  connecting: boolean
  snapTarget: { nodeId: string; dir: string } | null
  assets: any[]
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'drag-end', pos: { x: number; y: number }): void
  (e: 'drag-move', pos: { x: number; y: number }): void
  (e: 'resize-end', size: { width: number; height: number; x: number; y: number }): void
  (e: 'connect-start', payload: { dir: string; e: PointerEvent }): void
  (e: 'resize-move', size: { width: number; height: number; x: number; y: number }): void
  (e: 'image-loaded', size: { w: number; h: number }): void
  (e: 'save-content', content: string): void
  (e: 'update-asset', id: string, data: any): void
  (e: 'remove-asset', id: string): void
  (e: 'edit-script'): void
  (e: 'edit-director'): void
  (e: 'grid-split', data: { cols: number; rows: number; urls: string[] }): void
}>()

// 资产节点上传
const assetPreviewOpen = ref(false)
const showAssetPicker = ref(false)
// 资产选择器分类筛选(与资产库面板一致)
const pickerCategory = ref<string>('全部')
const pickerSearch = ref('')
// 图片节点: 宫格裁剪状态
const imageGridCols = ref(0)
const imageGridRows = ref(0)
const showImageGridPicker = ref(false)
const imagePreviewOpen = ref(false)

function downloadImage(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = url.split('/').pop() || 'image.png'
  a.click()
}

async function storyboardExport() {
  if (imageGridCols.value < 2 || imageGridRows.value < 2) return
  const img = document.querySelector('.canvas-node img') as HTMLImageElement | null
  if (!img) return
  const cw = img.naturalWidth / imageGridCols.value
  const ch = img.naturalHeight / imageGridRows.value
  const canvas = document.createElement('canvas')
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d')!
  for (let r = 0; r < imageGridRows.value; r++) {
    for (let c = 0; c < imageGridCols.value; c++) {
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `storyboard_r${r+1}_c${c+1}.png`
      a.click()
      await new Promise(r => setTimeout(r, 100))
    }
  }
}

// 宫格裁切→生成资产节点(用 Image()加载避免DOM串扰)
function splitToAssets() {
  const cols = imageGridCols.value
  const rows = imageGridRows.value
  if (cols < 2 || rows < 2) return
  const srcUrl = imageUrls.value[0]
  if (!srcUrl) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const cw = img.naturalWidth / cols
    const ch = img.naturalHeight / rows
    const canvas = document.createElement('canvas')
    canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d')!
    const urls: string[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.clearRect(0, 0, cw, ch)
        ctx.drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch)
        urls.push(canvas.toDataURL('image/png'))
      }
    }
    emit('grid-split', { cols, rows, urls })
  }
  img.onerror = () => console.error('分镜: 图片加载失败', srcUrl)
  img.src = srcUrl
}
const filteredPickerAssets = computed(() => {
  let list = props.assets
  if (pickerCategory.value !== '全部') list = list.filter(a => a.category === pickerCategory.value)
  const q = pickerSearch.value.trim().toLowerCase()
  if (q) list = list.filter(a => (a.filename + ' ' + (a.tags || '')).toLowerCase().includes(q))
  return list
})
// 每次打开选择器重置筛选,避免残留上次搜索词
watch(showAssetPicker, v => { if (v) { pickerCategory.value = '全部'; pickerSearch.value = '' } })
let assetFileInput: HTMLInputElement | null = null

// 工具栏置顶：脱离节点stacking context
const nodeEl = ref<HTMLElement | null>(null)
const toolbarPos = reactive({ left: 0, top: 0, width: 0 })

function updateToolbarPos() {
  if (!nodeEl.value) return
  const r = nodeEl.value.getBoundingClientRect()
  toolbarPos.left = r.left + r.width / 2
  toolbarPos.top = r.top - 28
  toolbarPos.width = r.width
}

onMounted(updateToolbarPos)

watch(() => [props.node.x, props.node.y, props.node.width, props.selected, props.zoom], () => {
  nextTick(updateToolbarPos)
})

function onAssetPick(a: any) {
  showAssetPicker.value = false
  emit('save-content', JSON.stringify({ url: a.url, name: a.filename, size: a.size }))
}

function onAssetSelectImage() {
  if (!assetFileInput) {
    assetFileInput = document.createElement('input')
    assetFileInput.type = 'file'
    assetFileInput.accept = 'image/*,video/*,audio/*'
    assetFileInput.onchange = async () => {
      const file = assetFileInput?.files?.[0]
      if (!file) return
      const a = await uploadAsset(file)
      const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio'
      emit('save-content', JSON.stringify({ url: a.url, name: a.filename, size: a.size, mediaType }))
    }
  }
  assetFileInput.click()
}

function onAssetRemove() {
  emit('save-content', '')
}

function onAssetDragOver(e: DragEvent) {
  e.preventDefault()
}

function onAssetDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  uploadAsset(file).then(a => {
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio'
    emit('save-content', JSON.stringify({ url: a.url, name: a.filename, size: a.size, mediaType }))
  })
}

// 文本节点：双击编辑，单击拖动
const isEditingText = ref(false)
const textEditEl = ref<HTMLDivElement | null>(null)

function startTextEditDirect() {
  if (props.node.node_type !== 'text' || isEditingText.value) return
  isEditingText.value = true
  nextTick(() => {
    if (textEditEl.value) {
      textEditEl.value.innerHTML = props.node.content || ''
      textEditEl.value.focus()
      setTimeout(() => {
        const sel = window.getSelection()
        if (sel && textEditEl.value) {
          sel.removeAllRanges()
          const range = document.createRange()
          range.selectNodeContents(textEditEl.value)
          range.collapse(false)
          sel.addRange(range)
        }
      }, 0)
    }
  })
}

function endTextEdit(e?: FocusEvent) {
  const related = (e?.relatedTarget || document.activeElement) as HTMLElement | null
  if (related?.closest('[data-text-toolbar]')) {
    nextTick(() => textEditEl.value?.focus())
    return
  }
  const el = textEditEl.value
  if (!el || props.node.node_type !== 'text') return
  const html = el.innerHTML
  isEditingText.value = false
  if (html !== (props.node.content || '')) {
    emit('save-content', html)
  }
}

function onTextKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    textEditEl.value?.blur()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    isEditingText.value = false
    nextTick(() => { if (textEditEl.value) textEditEl.value.innerHTML = props.node.content || '' })
  }
}

function execFormat(command: string, value?: string) {
  if (!textEditEl.value) return
  textEditEl.value.focus()
  document.execCommand(command, false, value)
}

const formatButtons = [
  { cmd: 'formatBlock', val: 'h1', icon: 'H1', title: '标题 1' },
  { cmd: 'formatBlock', val: 'h2', icon: 'H2', title: '标题 2' },
  { cmd: 'formatBlock', val: 'h3', icon: 'H3', title: '标题 3' },
  { cmd: 'formatBlock', val: 'p', icon: '¶', title: '正文' },
] as const

function syncTextToDOM() {
  if (textEditEl.value && props.node.node_type === 'text' && document.activeElement !== textEditEl.value) {
    textEditEl.value.innerHTML = props.node.content || ''
  }
}

onMounted(syncTextToDOM)
watch(() => props.node.content, syncTextToDOM)

// Drag state
const dragging = ref(false)
const dragDx = ref(0)
const dragDy = ref(0)
const dragStart = ref({ sx: 0, sy: 0, wx: 0, wy: 0 })

// Resize state
const resizing = ref(false)
const resizeDir = ref('')
const resizeStart = ref({ sx: 0, sy: 0, x: 0, y: 0, w: 0, h: 0 })
const resizeValues = ref({ x: 0, y: 0, w: 0, h: 0 })

const nodeStyle = computed(() => {
  const base = {
    position: 'absolute' as const,
    left: `${props.node.x + dragDx.value + (resizing.value ? resizeValues.value.x - props.node.x : 0)}px`,
    top: `${props.node.y + dragDy.value + (resizing.value ? resizeValues.value.y - props.node.y : 0)}px`,
    width: `${resizing.value ? resizeValues.value.w : props.node.width}px`,
    height: `${resizing.value ? resizeValues.value.h : props.node.height}px`,
    cursor: dragging.value ? 'grabbing' : 'grab',
    userSelect: 'none' as const,
    zIndex: props.zIndex,
    transition: dragging.value || resizing.value ? 'none' : 'box-shadow 0.2s',
  }
  return base
})

// 拖动 drag-move 事件的 rAF 合并句柄,降低父级边重算频率
let dragMoveRaf = 0

function onPointerDown(e: PointerEvent) {
  e.stopPropagation()
  emit('select')
  dragging.value = true
  dragDx.value = 0
  dragDy.value = 0
  dragStart.value = {
    sx: e.clientX,
    sy: e.clientY,
    wx: props.node.x,
    wy: props.node.y,
  }
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (resizing.value) {
    const dx = (e.clientX - resizeStart.value.sx) / props.zoom
    const dy = (e.clientY - resizeStart.value.sy) / props.zoom
    const minW = 120
    const minH = 80
    let { x, y, w, h } = resizeStart.value

    if (resizeDir.value.includes('e')) {
      w = Math.max(minW, resizeStart.value.w + dx)
    }
    if (resizeDir.value.includes('w')) {
      const nw = Math.max(minW, resizeStart.value.w - dx)
      x = resizeStart.value.x + resizeStart.value.w - nw
      w = nw
    }
    if (resizeDir.value.includes('s')) {
      h = Math.max(minH, resizeStart.value.h + dy)
    }
    if (resizeDir.value.includes('n')) {
      const nh = Math.max(minH, resizeStart.value.h - dy)
      y = resizeStart.value.y + resizeStart.value.h - nh
      h = nh
    }

    resizeValues.value = { x, y, w, h }
    emit('resize-move', { width: w, height: h, x, y })
    return
  }

  if (!dragging.value) return
  const dx = (e.clientX - dragStart.value.sx) / props.zoom
  const dy = (e.clientY - dragStart.value.sy) / props.zoom
  // 本地偏移立即更新,节点跟手不延迟
  dragDx.value = dx
  dragDy.value = dy
  // rAF 合并 drag-move:避免高频 pointermove 触发父级全量边重算
  if (dragMoveRaf) return
  dragMoveRaf = requestAnimationFrame(() => {
    dragMoveRaf = 0
    emit('drag-move', { x: props.node.x + dragDx.value, y: props.node.y + dragDy.value })
  })
}

function onPointerUp(e: PointerEvent) {
  if (resizing.value) {
    resizing.value = false
    const el = e.currentTarget as HTMLElement
    el.releasePointerCapture(e.pointerId)
    emit('resize-end', {
      width: resizeValues.value.w,
      height: resizeValues.value.h,
      x: resizeValues.value.x,
      y: resizeValues.value.y,
    })
    return
  }

  if (!dragging.value) return
  dragging.value = false
  // 清理可能挂起的 rAF,避免 drag-end 后再触发一次 drag-move
  if (dragMoveRaf) { cancelAnimationFrame(dragMoveRaf); dragMoveRaf = 0 }
  const el = e.currentTarget as HTMLElement
  el.releasePointerCapture(e.pointerId)

  if (Math.abs(dragDx.value) > 1 || Math.abs(dragDy.value) > 1) {
    emit('drag-end', {
      x: props.node.x + dragDx.value,
      y: props.node.y + dragDy.value,
    })
  }
  dragDx.value = 0
  dragDy.value = 0
}

function onResizePointerDown(e: PointerEvent, dir: string) {
  e.stopPropagation()
  e.preventDefault()
  resizing.value = true
  resizeDir.value = dir
  resizeStart.value = {
    sx: e.clientX,
    sy: e.clientY,
    x: props.node.x,
    y: props.node.y,
    w: props.node.width,
    h: props.node.height,
  }
  resizeValues.value = { x: props.node.x, y: props.node.y, w: props.node.width, h: props.node.height }
  const el = (e.currentTarget as HTMLElement).closest('.canvas-node') as HTMLElement
  if (el) el.setPointerCapture(e.pointerId)
}

function onHandleDown(e: PointerEvent, dir: string) {
  e.stopPropagation()
  e.preventDefault()
  emit('connect-start', { dir, e })
}

// 左=输入(in), 右=输出(out)
const handles = [
  { dir: 'left', label: 'in', style: { top: '50%', left: '-10px', transform: 'translateY(-50%)' } },
  { dir: 'right', label: 'out', style: { top: '50%', right: '-10px', transform: 'translateY(-50%)' } },
]

const typeMeta: Record<string, { name: string; icon: string }> = {
  text: {
    name: '文本',
    icon: '<path d="M1 3h14M1 7h8M1 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  },
  image: {
    name: '图片',
    icon: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="5" cy="5.5" r="1.2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1.5 11l3-3 2.5 2.5 2-2 5.5 5.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  video: {
    name: '视频',
    icon: '<rect x="1.5" y="3" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="12 4.5 12 11.5 14.5 8" fill="currentColor"/>',
  },
  table: {
    name: '剧本',
    icon: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="1.5" y1="6" x2="14.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" stroke-width="1.2"/>',
  },
  full_image: {
    name: '全图',
    icon: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="5" cy="5.5" r="1.2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M1.5 11l3-3 2.5 2.5 2-2 5.5 5.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  },
  agent: {
    name: '智能体',
    icon: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="6.5" r="1" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="10" cy="6.5" r="1" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 10c.5 1 1.5 1.5 2 1.5s1.5-.5 2-1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>',
  },
  workflow: {
    name: '工作流',
    icon: '<rect x="6" y="1" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="1" y="11" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="11" y="11" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="5" x2="3" y2="11" stroke="currentColor" stroke-width="1.2"/><line x1="8" y1="5" x2="13" y2="11" stroke="currentColor" stroke-width="1.2"/>',
  },
  asset: {
    name: '资产加载',
    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5"/>',
  },
  director: {
    name: '导演台',
    icon: '<circle cx="8" cy="8" r="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="11" r="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="14" r="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="2" x2="12" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.5"/>',
  },
}

const currentTypeMeta = computed(() => typeMeta[props.node.node_type] ?? { name: '节点', icon: '' })

const directorSummary = computed(() => {
  if (props.node.node_type !== 'director' || !props.node.content) return null
  try {
    const p = JSON.parse(props.node.content)
    const chars = p.compositionData?.characters ?? []
    const props_ = p.compositionData?.props ?? []
    const thumbnailUrl = p.thumbnailUrl || ''
    return { thumbnailUrl, chars: chars.length, props: props_.length, labels: chars.map((c: any) => c.label), empty: chars.length === 0 && props_.length === 0 }
  } catch { return null }
})

function isSnapHandle(dir: string) {
  return props.snapTarget?.nodeId === props.node.id && props.snapTarget?.dir === dir
}

const assetImageUrl = computed(() => {
  if (props.node.node_type !== 'asset' || !props.node.content) return null
  try {
    const p = JSON.parse(props.node.content)
    return p.url || p.dataUrl || null
  } catch { return null }
})

const workflowContent = computed(() => {
  if (props.node.node_type !== 'workflow' || !props.node.content) return null
  try { return JSON.parse(props.node.content) } catch { return null }
})

const assetMediaType = computed((): 'image' | 'video' | 'audio' | null => {
  if (props.node.node_type !== 'asset' || !props.node.content) return null
  try {
    const p = JSON.parse(props.node.content)
    if (p.mediaType) return p.mediaType
    const url = p.url || p.dataUrl || ''
    if (/\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.startsWith('video/')) return 'video'
    if (/\.(mp3|wav|ogg|flac|aac|m4a)/i.test(url) || url.startsWith('audio/')) return 'audio'
    return 'image'
  } catch { return null }
})

// 剧本节点表格数据
const scriptData = computed(() => {
  if (props.node.node_type !== 'table') return { cols: [] as string[], colWidths: [] as number[], rows: [] as string[][] }
  try {
    const d = JSON.parse(props.node.content || '{}')
    return { cols: d.cols || [], colWidths: d.colWidths || [], rows: d.rows || [] }
  } catch { return { cols: [], colWidths: [], rows: [] } }
})

// 剧本节点自适应表格内容高度
watch(scriptData, () => {
  nextTick(() => {
    const table = nodeEl.value?.querySelector('table') as HTMLElement | null
    if (!table) return
    const colCount = scriptData.value.cols.length
    const rowCount = scriptData.value.rows.length
    if (colCount === 0 && rowCount === 0) return
    const contentH = table.getBoundingClientRect().height + 50  // table + header
    const contentW = table.getBoundingClientRect().width + 32
    const h = Math.max(200, contentH)
    const w = Math.max(400, contentW)
    emit('image-loaded', { w, h })
  })
}, { deep: true })

const videoUrls = computed(() => {
  if (props.node.node_type !== 'video') return []
  try {
    const data = JSON.parse(props.node.content || '{}')
    if (data.videos && Array.isArray(data.videos)) {
      return data.videos.map((v: any) => v.url || '').filter(Boolean)
    }
  } catch {}
  return []
})

const imageUrls = computed(() => {
  if (props.node.node_type !== 'image') return []
  try {
    const data = JSON.parse(props.node.content || '{}')
    const refs = Array.isArray(data.images) ? data.images.map((i: any) => i.url || '') : []
    const gens = Array.isArray(data.generated_images) ? data.generated_images.map((i: any) => i.url || '') : []
    return [...refs, ...gens].filter(Boolean)
  } catch {}
  return []
})

const agentContentHtml = computed(() => {
  if (props.node.node_type !== 'agent') return ''
  const agentContent = props.node.content || ''
  return marked(agentContent) as string
})

// 全景图节点 (pannellum)
const fullImageData = computed(() => {
  if (props.node.node_type !== 'full_image') return { scenes: [] as { name: string; url: string }[], active: 0 }
  try {
    const d = JSON.parse(props.node.content || '{}')
    return { scenes: (d.scenes || []) as { name: string; url: string }[], active: (d.active ?? 0) as number }
  } catch { return { scenes: [], active: 0 } }
})
const fullImageActiveUrl = computed(() => fullImageData.value.scenes[fullImageData.value.active]?.url || '')
const panoContainer = ref<HTMLDivElement | null>(null)
let panoViewer: any = null

function initPanorama(url: string) {
  destroyPanorama()
  if (!panoContainer.value) return
  panoViewer = pannellum.viewer(panoContainer.value, {
    type: 'equirectangular',
    panorama: url,
    autoLoad: true,
    showControls: false,
    mouseZoom: true,
    draggable: true,
    compass: false,
    hfov: 100,
    autoRotate: 0,
    keyboardZoom: false,
  })
  ;(window as any).__panoViewer = panoViewer
}

function destroyPanorama() {
  if (panoViewer) {
    panoViewer.destroy()
    panoViewer = null
  }
}

watch(fullImageActiveUrl, (url) => {
  if (url) { initPanorama(url) }
  else { destroyPanorama() }
})

onMounted(() => {
  if (props.node.node_type === 'full_image' && fullImageActiveUrl.value) {
    initPanorama(fullImageActiveUrl.value)
  }
})


</script>

<template>
  <div
    class="canvas-node group flex flex-col"
    :class="{
      'opacity-60': connecting,
    }"
    ref="nodeEl"
    :data-node-id="node.id"
    :style="nodeStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <!-- 头部：图标 + 名称（悬浮，不在选中框内） -->
    <div class="flex items-center gap-1.5 px-3 pt-2 pb-2 select-none shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14" height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-white/70 shrink-0"
        v-html="currentTypeMeta.icon"
      />
      <span class="text-xs text-white/70 font-medium truncate">{{ currentTypeMeta.name }}</span>
    </div>

    <!-- 节点内容窗口 -->
    <div
      class="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/20 bg-neutral-900 transition-all"
      :class="{
        'mx-2 mb-2': node.node_type !== 'image' && node.node_type !== 'asset' && node.node_type !== 'video',
        'border-l-cyan-400 border-r-cyan-400 border-l-2 border-r-2': selected,
      }"
    >
      <!-- 文本节点 -->
      <div v-if="node.node_type === 'text'" class="h-full min-h-0 flex flex-col relative">
        <div
          ref="textEditEl"
          :contenteditable="isEditingText ? 'true' : 'false'"
          class="flex-1 min-h-0 p-4 text-white/85 text-sm overflow-y-auto overflow-x-hidden break-words leading-relaxed outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-2 [&_h1]:leading-tight [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white/90 [&_h2]:mb-1.5 [&_h2]:leading-tight [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white/85 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:bg-neutral-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:text-green-300 [&_code]:font-mono [&_pre]:bg-neutral-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_blockquote]:border-l-3 [&_blockquote]:border-cyan-500/50 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-white/60 [&_blockquote]:italic [&_a]:text-cyan-400 [&_a]:underline [&_a]:decoration-cyan-400/30 [&_strong]:text-white [&_strong]:font-bold [&_em]:italic [&_hr]:border-white/10 [&_hr]:my-3 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-white/10 [&_th]:p-2 [&_th]:bg-neutral-800 [&_td]:border [&_td]:border-white/10 [&_td]:p-2"
          placeholder="输入内容..."
          @blur="endTextEdit"
          @keydown="onTextKeydown"
          @wheel.stop
          @dblclick.prevent
        ></div>
      </div>

      <!-- 图片节点 -->
      <div v-else-if="node.node_type === 'image'" class="h-full flex items-center justify-center overflow-hidden relative">
        <template v-if="imageUrls.length > 0">
          <img v-for="(url, i) in imageUrls" :key="i" :src="url" class="rounded-lg object-contain w-full h-full pointer-events-none select-none" @load="(e) => { const img = e.target as HTMLImageElement; const maxW = 600; const maxH = 480; let w = img.naturalWidth, h = img.naturalHeight; if (w > maxW) { h = h * maxW / w; w = maxW; } if (h > maxH) { w = w * maxH / h; h = maxH; } emit('image-loaded', { w: Math.round(w) + 60, h: Math.round(h) + 36 }); }" />
          <!-- 宫格裁剪覆盖层 -->
          <div v-if="imageGridCols > 0 && imageGridRows > 0" class="absolute inset-0 pointer-events-none z-10">
            <div v-for="c in imageGridCols - 1" :key="'vc'+c" class="absolute top-0 bottom-0 border-r border-primary/60" :style="{ left: (c * 100 / imageGridCols) + '%' }" />
            <div v-for="r in imageGridRows - 1" :key="'hr'+r" class="absolute left-0 right-0 border-t border-primary/60" :style="{ top: (r * 100 / imageGridRows) + '%' }" />
          </div>
        </template>
        <div v-else class="flex items-center justify-center text-white/30 w-full h-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      </div>

      <!-- 视频节点 -->
      <div v-else-if="node.node_type === 'video'" class="h-full p-2 flex items-center justify-center overflow-hidden">
        <template v-if="videoUrls.length > 0">
          <div class="w-full h-full flex flex-col gap-1 overflow-auto">
            <video v-for="(url, i) in videoUrls" :key="i" :src="url" controls class="w-full rounded-lg object-contain max-h-full"
              @loadedmetadata="(e) => { if (i !== 0) return; const v = e.target as HTMLVideoElement; const maxW = 640; const maxH = 480; let w = v.videoWidth, h = v.videoHeight; if (w > maxW) { h = h * maxW / w; w = maxW; } if (h > maxH) { w = w * maxH / h; h = maxH; } emit('image-loaded', { w: Math.round(w) + 60, h: Math.round(h) + 36 }); }" />
          </div>
        </template>
        <div v-else class="flex items-center justify-center text-white/30 w-full h-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
      </div>

      <!-- 剧本节点 -->
      <div v-else-if="node.node_type === 'table'" class="text-xs">
        <table v-if="scriptData.cols.length > 0" class="border-collapse">
          <thead>
            <tr class="bg-white/5 sticky top-0">
              <th v-for="(col, ci) in scriptData.cols" :key="ci" class="p-1.5 text-left text-white/70 font-medium border-b border-r border-white/20 max-w-[200px]" :style="scriptData.colWidths[ci] ? { width: scriptData.colWidths[ci] + 'px', minWidth: scriptData.colWidths[ci] + 'px' } : {}">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in scriptData.rows" :key="ri" class="hover:bg-white/5">
              <td v-for="(cell, ci) in row" :key="ci" class="p-1.5 text-white/80 border-b border-r border-white/20 max-w-[200px] whitespace-pre-wrap break-words" :style="scriptData.colWidths[ci] ? { maxWidth: scriptData.colWidths[ci] + 'px', minWidth: '40px' } : {}">{{ cell || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="flex items-center justify-center h-full text-white/30 text-sm">
          点击编辑按钮添加剧本内容
        </div>
      </div>

      <!-- 全图节点 -->
      <div v-else-if="node.node_type === 'full_image'" class="h-full overflow-hidden rounded-xl bg-black relative cursor-grab active:cursor-grabbing">
        <div ref="panoContainer" class="absolute inset-0" @wheel.stop @pointerdown.stop="emit('select')" />
        <div v-if="!fullImageActiveUrl" class="absolute inset-0 flex items-center justify-center text-white/30 text-sm z-10 pointer-events-none">
          连线图片节点或上传全景图
        </div>
      </div>

      <!-- 智能体节点 -->
      <div v-else-if="node.node_type === 'agent'" class="h-full p-4 text-white/85 text-sm overflow-y-auto leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white/90 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white/85 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_code]:bg-neutral-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:text-green-300 [&_pre]:bg-neutral-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-xs [&_strong]:text-white [&_strong]:font-bold [&_em]:italic" v-html="agentContentHtml || '智能体配置'"></div>

      <!-- 工作流节点 -->
      <div v-else-if="node.node_type === 'workflow'" class="h-full p-2 overflow-y-auto">
        <template v-if="workflowContent?.outputs?.length">
          <div v-for="(o, i) in workflowContent.outputs.slice(0, 2)" :key="i" class="space-y-0.5">
            <img v-if="o.type === 'image'" :src="o.value" class="w-full object-cover rounded border border-white/10" />
            <video v-else-if="o.type === 'video'" :src="o.value" controls class="w-full rounded" />
            <audio v-else-if="o.type === 'audio'" :src="o.value" controls class="w-full" />
            <pre v-else class="text-white/60 text-xs whitespace-pre-wrap break-all">{{ o.value }}</pre>
          </div>
          <div v-if="workflowContent.outputs.length > 2" class="text-white/25 text-[9px]">+{{ workflowContent.outputs.length - 2 }}</div>
        </template>
        <div v-else class="text-white/30 text-xs">{{ workflowContent?.variables?.length ? `${workflowContent.variables.length} 变量待执行` : '工作流配置' }}</div>
      </div>

      <!-- 资产加载节点 -->
      <div v-else-if="node.node_type === 'asset'" class="h-full w-full flex items-center justify-center relative"
        @dragover="onAssetDragOver" @drop="onAssetDrop" @click="!assetImageUrl && onAssetSelectImage()">
        <!-- 图片 -->
        <template v-if="assetMediaType === 'image' && assetImageUrl && !dragging">
          <img :src="assetImageUrl" class="w-full h-full object-contain"
            @load="(e) => { const img = e.target as HTMLImageElement; const w = Math.round(img.naturalWidth * 0.25), h = Math.round(img.naturalHeight * 0.25); emit('image-loaded', { w, h: h + 34 }); }"
          />
        </template>
        <!-- 视频 -->
        <template v-else-if="assetMediaType === 'video' && assetImageUrl && !dragging">
          <video :src="assetImageUrl" controls class="w-full h-full object-contain" />
        </template>
        <!-- 音频 -->
        <template v-else-if="assetMediaType === 'audio' && assetImageUrl && !dragging">
          <audio :src="assetImageUrl" controls class="w-full max-w-[200px]" />
        </template>
        <!-- 空状态 -->
        <div v-else class="flex flex-col items-center justify-center text-white/30 gap-2 p-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span class="text-sm">{{ assetImageUrl ? '拖拽中...' : '点击或拖放上传图片/视频/音频' }}</span>
        </div>
      </div>

      <!-- 导演台节点 -->
      <div v-else-if="node.node_type === 'director'" class="h-full w-full flex flex-col items-center justify-center gap-2 px-2 py-2 text-center overflow-hidden">
        <template v-if="directorSummary?.thumbnailUrl">
          <img :src="directorSummary.thumbnailUrl" class="w-full h-full object-cover rounded-lg pointer-events-none" alt="" />
          <div class="absolute bottom-1 left-1 text-[9px] text-white/40 bg-black/30 px-1 rounded">👤{{ directorSummary.chars }}</div>
        </template>
        <template v-else-if="directorSummary?.empty">
          <svg class="text-white/15" width="24" height="26" viewBox="0 0 20 22" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M19.5 15a1 1 0 0 1-.5.9l-9 5.1a1 1 0 0 1-1 0l-9-5.1a1 1 0 0 1 0-1.8l.8-.4 7.5 4.3a1 1 0 0 0 1 0l7.7-4.3.8.4a1 1 0 0 1 .5.9z"/>
            <path d="M19.5 9.9a1 1 0 0 1-.5.9l-9 5.1a1 1 0 0 1-1 0l-9-5.1a1 1 0 0 1 0-1.8l.8-.4 7.5 4.3a1 1 0 0 0 1 0l7.7-4.3.8.4a1 1 0 0 1 .5.9z"/>
            <path d="M9 0a1 1 0 0 1 1 0l9 5.1a1 1 0 0 1 0 1.8l-9 5.1a1 1 0 0 1-1 0L0 6.9a1 1 0 0 1 0-1.8L9 0z"/>
          </svg>
          <p class="text-[10px] text-white/20">空场景</p>
        </template>
        <template v-else-if="directorSummary">
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-cyan-300/80">👤 {{ directorSummary.chars }}</span>
            <span v-if="directorSummary.props > 0" class="text-[11px] text-white/40">· 📦 {{ directorSummary.props }}</span>
          </div>
        </template>
        <template v-else>
          <p class="text-[10px] text-white/20">空白</p>
        </template>
      </div>
    </div>

    <!-- 四角缩放手柄 -->
    <div
      class="absolute z-20 w-4 h-4 -left-2 -top-2 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
      @pointerdown="onResizePointerDown($event, 'nw')"
    />
    <div
      class="absolute z-20 w-4 h-4 -right-2 -top-2 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity"
      @pointerdown="onResizePointerDown($event, 'ne')"
    />
    <div
      class="absolute z-20 w-4 h-4 -left-2 -bottom-2 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity"
      @pointerdown="onResizePointerDown($event, 'sw')"
    />
    <div
      class="absolute z-20 w-4 h-4 -right-2 -bottom-2 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
      @pointerdown="onResizePointerDown($event, 'se')"
    />

    <!-- 连接手柄：左=输入(蓝), 右=输出(绿) -->
    <div
      v-for="h in handles"
      :key="h.dir"
      :data-connect-handle="h.dir"
      :data-node-id="node.id"
      class="absolute z-30 w-5 h-5 rounded-full border-2 border-base-100 cursor-crosshair opacity-60 hover:opacity-100 hover:scale-125"
      :class="[
        h.dir === 'left' ? 'bg-blue-500' : 'bg-green-500',
        isSnapHandle(h.dir)
          ? '!opacity-100 !scale-150 !border-primary ring-2 ring-primary/40'
          : '',
      ]"
      :style="h.style"
      @pointerdown="onHandleDown($event, h.dir)"
    />
    <!-- 文本工具栏 Teleport -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'text'" class="fixed z-[9999]" :style="{ left: toolbarPos.left + 'px', top: toolbarPos.top + 'px', transform: 'translate(-50%, -100%)' }" @pointerdown.stop data-text-toolbar>
        <div class="flex items-center gap-1 rounded-xl px-2 py-2 border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg">
          <template v-for="btn in formatButtons" :key="btn.cmd + btn.val">
            <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors" :title="btn.title" @pointerdown.stop.prevent="execFormat(btn.cmd, btn.val)">{{ btn.icon }}</button>
          </template>
          <span v-if="isEditingText" class="w-px h-4 bg-white/10" />
          <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors" title="粗体" @pointerdown.stop.prevent="execFormat('bold')"><span class="font-bold">B</span></button>
          <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs italic transition-colors" title="斜体" @pointerdown.stop.prevent="execFormat('italic')"><span class="italic">I</span></button>
          <span v-if="isEditingText" class="w-px h-4 bg-white/10" />
          <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="无序列表" @pointerdown.stop.prevent="execFormat('insertUnorderedList')"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="3" cy="12" r="1.2"/><line x1="6" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5"/></svg></button>
          <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="有序列表" @pointerdown.stop.prevent="execFormat('insertOrderedList')"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><line x1="3" y1="5" x2="8" y2="5" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="9" x2="8" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.2"/><text x="0.5" y="5.5" font-size="7" fill="currentColor" font-family="sans-serif">1</text><text x="0.5" y="9.5" font-size="7" fill="currentColor" font-family="sans-serif">2</text><text x="0.5" y="13.5" font-size="7" fill="currentColor" font-family="sans-serif">3</text></svg></button>
          <span v-if="isEditingText" class="w-px h-4 bg-white/10" />
          <button v-if="isEditingText" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="分割线" @pointerdown.stop.prevent="execFormat('insertHorizontalRule')"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5"/></svg></button>
          <button class="w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" :title="isEditingText ? '退出编辑' : '编辑文字'" @pointerdown.stop.prevent="isEditingText ? textEditEl?.blur() : startTextEditDirect()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 资产工具栏 Teleport -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'asset'" class="fixed z-[9999]" :style="{ left: toolbarPos.left + 'px', top: toolbarPos.top + 'px', transform: 'translate(-50%, -100%)' }" @pointerdown.stop>
        <div class="flex items-center gap-1.5 rounded-xl px-2.5 py-2 border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg">
          <button class="flex items-center gap-1.5 h-8 px-2.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap" title="从资产库选择" @pointerdown.stop.prevent="showAssetPicker = !showAssetPicker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span class="text-xs">资产库</span>
          </button>
          <span class="w-px h-5 bg-white/10" />
          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="本地上传" @pointerdown.stop.prevent="onAssetSelectImage"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
          <button v-if="assetImageUrl" class="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="预览大图" @pointerdown.stop.prevent="assetPreviewOpen = true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button v-if="assetImageUrl" class="w-8 h-8 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="删除" @pointerdown.stop.prevent="onAssetRemove"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
        <!-- 资产选择下拉 -->
        <div v-if="showAssetPicker" class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 rounded-xl border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg p-2">
          <!-- 分类筛选 -->
          <div class="flex flex-wrap gap-1 mb-2">
            <button v-for="cat in ASSET_CATEGORIES" :key="cat" class="px-2 py-0.5 rounded text-[10px] transition-colors" :class="pickerCategory === cat ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'" @pointerdown.stop.prevent="pickerCategory = cat">{{ cat }}</button>
          </div>
          <!-- 搜索框 -->
          <input v-model="pickerSearch" placeholder="搜索文件名/标签..." class="w-full h-6 mb-2 text-[10px] bg-white/5 border border-white/10 rounded px-2 text-white/60 outline-none focus:border-white/20" @pointerdown.stop @keydown.stop />
          <div v-if="props.assets.length === 0" class="text-white/30 text-xs text-center py-4">暂无资产</div>
          <div v-else-if="filteredPickerAssets.length === 0" class="text-white/30 text-xs text-center py-4">该分类暂无资产</div>
          <div v-else class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            <div v-for="a in filteredPickerAssets" :key="a.id" class="flex flex-col items-center gap-1 p-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors" @pointerdown.stop.prevent="onAssetPick(a)">
              <img :src="a.url" class="w-full aspect-square object-cover rounded-md" @error="($event.target as HTMLImageElement).style.display='none'" />
              <span class="text-[10px] text-white/50 truncate w-full text-center">{{ a.filename }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 资产大图预览 -->
    <Teleport to="body">
      <div v-if="assetPreviewOpen && assetImageUrl" class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80" @click="assetPreviewOpen = false">
        <img :src="assetImageUrl" class="max-w-[90vw] max-h-[90vh] object-contain" @click.stop />
        <button class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" @click="assetPreviewOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </Teleport>

    <!-- 全景操作提示 -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'full_image' && fullImageActiveUrl" class="fixed z-[9999] pointer-events-none select-none" :style="{ left: toolbarPos.left + 'px', top: (toolbarPos.top - 12) + 'px', transform: 'translate(-50%, -100%)' }">
        <span class="inline-flex items-center gap-1 text-xs text-white/60" style="text-shadow: 0 0 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)">
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 1v8M10 5l4-4 4 4M10 17l4 4 4-4M14 21v-8"/><line x1="1" y1="11" x2="7" y2="11"/><line x1="21" y1="11" x2="27" y2="11"/><polyline points="4 14 1 11 4 8"/><polyline points="24 8 27 11 24 14"/></svg>
          方向键旋转
          <span class="mx-1 text-white/30">·</span>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="4"/><line x1="8" y1="1" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="15"/><line x1="1" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="15" y2="8"/></svg>
          滚轮缩放
        </span>
      </div>
    </Teleport>

    <!-- 剧本编辑器按钮 -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'table'" class="fixed z-[9999]" :style="{ left: toolbarPos.left + 'px', top: toolbarPos.top + 'px', transform: 'translate(-50%, -100%)' }" @pointerdown.stop>
        <div class="flex items-center gap-1 rounded-xl px-2 py-2 border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg">
          <button class="flex items-center gap-1.5 h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" @pointerdown.stop.prevent="emit('edit-script')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span class="text-[11px]">编辑剧本</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 图片节点工具栏 -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'image'" class="fixed z-[9999]" :style="{ left: toolbarPos.left + 'px', top: toolbarPos.top + 'px', transform: 'translate(-50%, -100%)' }" @pointerdown.stop>
        <div class="flex items-center gap-1 rounded-xl px-2 py-2 border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg">
          <!-- 宫格裁剪 -->
          <div class="relative">
            <button class="flex items-center gap-1 h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" :class="imageGridCols>0?'text-primary bg-primary/10':''" @pointerdown.stop.prevent="showImageGridPicker = !showImageGridPicker">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              <span class="text-[11px]">宫格</span>
            </button>
            <div v-if="showImageGridPicker" class="absolute top-full left-0 mt-1 bg-neutral-800 border border-white/15 rounded-xl p-1.5 shadow-xl min-w-[140px] z-50" @pointerdown.stop>
              <button v-for="g in [[0,0,'关闭'],[2,2,'4宫格'],[3,3,'9宫格'],[4,4,'16宫格'],[5,5,'25宫格']]" :key="g[2]" class="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-lg hover:bg-white/10 transition-colors" :class="imageGridCols===g[0]&&imageGridRows===g[1]?'text-primary bg-primary/10':'text-white/60'" @pointerdown.stop.prevent="imageGridCols=g[0] as number; imageGridRows=g[1] as number; showImageGridPicker=false">{{ g[2] }}</button>
            </div>
          </div>
          <!-- 分镜导出下载 -->
          <button v-if="imageGridCols>1 && imageGridRows>1" class="flex items-center gap-1 h-7 px-2 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="分镜下载" @pointerdown.stop.prevent="storyboardExport()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span class="text-[11px]">下载</span>
          </button>
          <!-- 分镜到画布: 切块生成资产节点 -->
          <button v-if="imageGridCols>1 && imageGridRows>1" class="flex items-center gap-1 h-7 px-2 text-xs text-primary/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="分镜到画布" @pointerdown.stop.prevent="splitToAssets()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span class="text-[11px]">分镜</span>
          </button>
          <span class="w-px h-4 bg-white/10" />
          <!-- 放大预览 -->
          <button class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="放大预览" @pointerdown.stop.prevent="imagePreviewOpen = true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <!-- 下载 -->
          <button v-if="imageUrls.length > 0" class="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="下载图片" @pointerdown.stop.prevent="downloadImage(imageUrls[0])">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 图片全屏预览 -->
    <Teleport to="body">
      <div v-if="imagePreviewOpen && imageUrls.length > 0" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" @click="imagePreviewOpen = false">
        <button class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" @click="imagePreviewOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <img :src="imageUrls[0]" class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg" @click.stop />
      </div>
    </Teleport>

    <!-- 导演台工具栏按钮 -->
    <Teleport to="body">
      <div v-if="selected && node.node_type === 'director'" class="fixed z-[9999]" :style="{ left: toolbarPos.left + 'px', top: toolbarPos.top + 'px', transform: 'translate(-50%, -100%)' }" @pointerdown.stop>
        <div class="flex items-center gap-1 rounded-xl px-2 py-2 border border-white/10 bg-neutral-800/95 backdrop-blur-md shadow-lg">
          <button class="flex items-center gap-1.5 h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" @pointerdown.stop.prevent="emit('edit-director')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <span class="text-[11px]">打开导演台</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
