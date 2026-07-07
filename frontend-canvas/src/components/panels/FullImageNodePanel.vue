<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { Node, Asset } from '../../types'
import { uploadAsset } from '../../api'

const props = defineProps<{
  node: Node | null
  panelStyle: Record<string, string>
  nodeInputs?: { edgeId: string; sourceNodeId: string; sourceNodeType: string; data: any }[]
  assets?: Asset[]
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
  (e: 'remove-connected-edge', edgeId: string): void
  (e: 'update-asset', id: string, data: { category?: string }): void
  (e: 'remove-asset', id: string): void
  (e: 'create-asset-node', imageUrl: string, name: string): void
}>()

interface Scene { name: string; url: string; edgeId: string }
const scenes = ref<Scene[]>([])
const activeScene = ref(0)
let knownEdgeIds = new Set<string>()

const pollTimer = setInterval(() => syncScenesFromInputs(props.nodeInputs), 1000)
onUnmounted(() => clearInterval(pollTimer))

function syncScenesFromInputs(inputs: typeof props.nodeInputs) {
  if (!inputs) { scenes.value = []; activeScene.value = 0; knownEdgeIds = new Set(); return }
  const map = new Map<string, Scene>()
  for (const s of scenes.value) map.set(s.edgeId, s)
  const newScenes: Scene[] = []
  const newIds = new Set<string>()
  for (const inp of inputs) {
    newIds.add(inp.edgeId)
    let url = ''
    if (inp.sourceNodeType === 'asset' && inp.data?.url) url = inp.data.url
    else if (inp.sourceNodeType === 'image' && inp.data?.dataUrl) url = inp.data.dataUrl
    if (!url) continue
    const existing = map.get(inp.edgeId)
    newScenes.push(existing || { name: '', url, edgeId: inp.edgeId })
  }
  scenes.value = newScenes
  knownEdgeIds = newIds
  renumber()
  if (activeScene.value >= scenes.value.length) activeScene.value = Math.max(0, scenes.value.length - 1)
  emit('save', JSON.stringify({ scenes: scenes.value.map(s => ({ name: s.name, url: s.url, edgeId: s.edgeId })), active: activeScene.value }))
}

function renumber() {
  scenes.value.forEach((s, i) => { s.name = `场景${i + 1}` })
}

function getNodeEl() {
  return document.querySelector(`[data-node-id="${props.node?.id}"]`)?.closest('.canvas-node') as HTMLElement | null
}

const showFullscreenPreview = ref(false)
let fullscreenPano: any = null

async function onScreenshot() {
  showFullscreenPreview.value = true
}

watch(showFullscreenPreview, (v) => {
  if (v) {
    setTimeout(() => {
      const el = document.getElementById('pano-fullscreen')
      if (el && scenes.value[activeScene.value]?.url) {
        fullscreenPano = (window as any).pannellum?.viewer(el, {
          type: 'equirectangular',
          panorama: scenes.value[activeScene.value].url,
          autoLoad: true,
          showControls: false,
          hfov: 100,
        })
      }
    }, 100)
  } else {
    fullscreenPano?.destroy()
    fullscreenPano = null
  }
})

watch(() => props.nodeInputs, syncScenesFromInputs, { immediate: true })

watch(() => props.node, (n) => {
  if (n && scenes.value.length === 0) {
    try {
      const d = JSON.parse(n.content || '{}')
      if (d.scenes?.length) syncScenesFromInputs(props.nodeInputs)
    } catch {}
  }
})
</script>

<template>
  <div v-if="node" :style="panelStyle" class="pointer-events-auto" @pointerdown.stop>
    <div class="bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-3">
      <div class="flex items-center gap-2 overflow-x-auto">
        <div v-for="(s, i) in scenes" :key="s.edgeId"
          class="shrink-0 group relative cursor-pointer"
          @click="activeScene = i"
        >
          <div class="w-16 h-10 rounded-lg overflow-hidden border-2 transition-colors"
            :class="activeScene === i ? 'border-cyan-400' : 'border-white/10'"
          >
            <img :src="s.url" class="w-full h-full object-cover" />
          </div>
          <span class="block text-[10px] text-center mt-0.5 truncate w-16"
            :class="activeScene === i ? 'text-white/60' : 'text-white/30'"
          >{{ s.name }}</span>
        </div>
        <div v-if="scenes.length === 0" class="text-white/30 text-xs">拖线连接图片/资产节点</div>
      </div>

      <div class="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <span class="text-[11px] text-white/30">{{ scenes.length }} 个场景</span>
        <button class="h-7 px-3 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors flex items-center gap-1"
          @click="onScreenshot" :disabled="scenes.length === 0"
          :class="{ 'opacity-30 pointer-events-none': scenes.length === 0 }"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          截图
        </button>
      </div>
    </div>
  </div>

  <!-- 全屏截图预览 -->
  <Teleport to="body">
    <div v-if="showFullscreenPreview && scenes[activeScene]" class="fixed inset-0 z-[10000] bg-black flex flex-col" @click.self="showFullscreenPreview = false">
      <div class="flex items-center justify-between px-4 py-2">
        <span class="text-white/40 text-sm">{{ scenes[activeScene].name }}</span>
        <div class="flex items-center gap-3">
          <span class="text-white/60 text-xs bg-white/10 px-3 py-1.5 rounded-lg">Win+Shift+S 截图你需要的内容</span>
          <button class="text-white/50 hover:text-white text-sm" @click="showFullscreenPreview = false">✕ 关闭</button>
        </div>
      </div>
      <div class="flex-1 min-h-0" id="pano-fullscreen" />
    </div>
  </Teleport>
</template>
