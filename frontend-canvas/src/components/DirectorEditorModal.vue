<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Node } from '../types'
import DirectorPropertiesPanel from './DirectorPropertiesPanel.vue'
import {
  defaultDirectorComposition,
  parseDirectorComposition,
  serializeDirectorComposition,
  BLANK_POSE,
  type DirectorCharacter,
  type DirectorCompositionData,
  type DirectorProp,
  CHARACTER_COLORS,
  TARGET_CHARACTER_HEIGHT,
} from '../composables/directorState'
import { useDirectorThree } from '../composables/useDirectorThree'
import { uploadAsset } from '../api'

const props = defineProps<{ node: Node | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save', content: string): void }>()

type SelectedObject = { type: 'character' | 'prop'; index: number }

const containerRef = ref<HTMLDivElement | null>(null)
const composition = ref<DirectorCompositionData>(parseDirectorComposition(props.node))
const searchQuery = ref('')
const showLabels = ref(true)
const showGrid = ref(true)
const selected = ref<SelectedObject>({ type: 'character', index: 0 })

const env = computed(() => composition.value.environment)
const characters = computed(() => composition.value.characters)
const propList = computed(() => (composition.value.props as DirectorProp[]) ?? [])
const filteredObjects = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const items = [
    ...characters.value.map((item, idx) => ({ type: 'character' as const, index: idx, label: item.label, color: item.color })),
    ...propList.value.map((item, idx) => ({ type: 'prop' as const, index: idx, label: item.label, color: item.color })),
  ]
  return q ? items.filter(i => i.label.toLowerCase().includes(q)) : items
})

const selectedCharacter = computed(() => selected.value.type === 'character' ? characters.value[selected.value.index] : null)
const selectedProp = computed(() => selected.value.type === 'prop' ? propList.value[selected.value.index] : null)

const directorScene = useDirectorThree({ containerRef, env, characters, props: propList, showLabels, showGrid })

async function addCharacterWithStyle(height: number, girth: number, style: string) {
  const count = characters.value.length
  const color = CHARACTER_COLORS[count % CHARACTER_COLORS.length]
  const label = `角色${String.fromCharCode(65 + count)}`
  const item: DirectorCharacter = {
    id: Math.random().toString(36).slice(2, 10),
    label, color, bodyType: style === 'female' ? 'female' : 'mannequin',
    pose: 'stand', jointAngles: { ...BLANK_POSE } satisfies DirectorCharacter['jointAngles'],
    position: { x: (count % 3) * 1.8 - 1.8, y: 0, z: Math.floor(count / 3) * 1.8 },
    rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, uniformScale: 1,
    visible: true, locked: false, height, girth, style, cgOffset: { x: 0, y: 0, z: 0 }, showCG: true,
  }
  composition.value.characters.push(item)
  await directorScene.addCharacter(item)
  selected.value = { type: 'character', index: composition.value.characters.length - 1 }
}

async function addCharacter() { await addCharacterWithStyle(TARGET_CHARACTER_HEIGHT, 0.98, 'neutral') }

function addPropShape(shape: 'cube' | 'sphere' | 'cylinder') {
  const next = propList.value.length + 1
  const item: DirectorProp = { id: Math.random().toString(36).slice(2, 10), label: `${shape === 'cube' ? '方块' : shape === 'sphere' ? '球体' : '圆柱'}${next}`, shape, position: { x: 3 + next, y: 0.6, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: CHARACTER_COLORS[next % CHARACTER_COLORS.length], visible: true }
  composition.value.props.push(item as any)
  directorScene.addProp(item)
  selected.value = { type: 'prop', index: propList.value.length - 1 }
}

async function removeSelectedObject() {
  if (selected.value.type === 'character') {
    const item = characters.value[selected.value.index]
    if (!item) return
    directorScene.removeObject(`character:${item.id}`)
    composition.value.characters.splice(selected.value.index, 1)
  } else {
    const item = propList.value[selected.value.index]
    if (!item) return
    directorScene.removeObject(`prop:${item.id}`)
    composition.value.props.splice(selected.value.index, 1)
  }
  selected.value = characters.value.length ? { type: 'character', index: 0 } : propList.value.length ? { type: 'prop', index: 0 } : { type: 'character', index: 0 }
}

async function resetView() {
  composition.value.environment = structuredClone(defaultDirectorComposition.environment)
  directorScene.applyEnvironment()
}

function save(thumbnailUrl?: string): string {
  if (!thumbnailUrl) {
    const dataUrl = directorScene.captureThumbnail()
    if (dataUrl) {
      fetch(dataUrl).then(r => r.blob()).then(blob => {
        const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
        uploadAsset(file).then(a => {
          const serialized = JSON.parse(serializeDirectorComposition(props.node, composition.value))
          serialized.thumbnailUrl = a.url || ''
          emit('save', JSON.stringify(serialized))
        }).catch(() => emit('save', serializeDirectorComposition(props.node, composition.value)))
      }).catch(() => emit('save', serializeDirectorComposition(props.node, composition.value)))
      return ''
    }
  }
  const serialized = JSON.parse(serializeDirectorComposition(props.node, composition.value))
  if (thumbnailUrl) serialized.thumbnailUrl = thumbnailUrl
  const content = JSON.stringify(serialized)
  emit('save', content)
  return content
}

async function handleClose() {
  const dataUrl = directorScene.captureThumbnail()
  let thumbnailUrl = ''
  if (dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
      const asset = await uploadAsset(file)
      thumbnailUrl = asset.url || ''
    } catch (e) { console.warn('缩略图上传失败', e) }
  }
  save(thumbnailUrl)
  emit('close')
}

const floorWidth = ref(3)

function floorWidthChanged() {
  directorScene.setFloorScale(floorWidth.value)
}

async function uploadFloorImage() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const asset = await uploadAsset(file)
      directorScene.setFloorTexture(asset.url)
    } catch (e) { console.error('底图上传失败', e) }
  }
  input.click()
}

watch(() => props.node?.id, async () => {
  console.log('[DirectorEditor] opening node:', props.node?.id, 'content length:', props.node?.content?.length || 0)
  composition.value = parseDirectorComposition(props.node)
  console.log('[DirectorEditor] parsed chars:', composition.value.characters.length)
  selected.value = { type: 'character', index: 0 }
  await directorScene.updateAllSceneObjects()
  directorScene.applyEnvironment()
})
watch(env, directorScene.applyEnvironment, { deep: true })
watch(showGrid, directorScene.applyEnvironment)
watch(showLabels, directorScene.updateLabelVisibility)
watch(selectedCharacter, directorScene.syncCharacter, { deep: true })
watch(selectedProp, directorScene.syncProp, { deep: true })
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[10000] flex flex-col bg-neutral-950 select-none" @keydown.escape="handleClose">
      <div class="flex items-center justify-between px-4 py-1.5 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <input v-model="searchQuery" placeholder="搜索..." class="h-7 w-40 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs px-2 outline-none" />
          <span class="text-xs text-cyan-400/80 border border-cyan-500/30 bg-cyan-500/10 rounded px-2 py-1 font-medium">📷 Win+Shift+S 截图 → 退出到画布任意位置 Ctrl+V 粘贴即可</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="h-7 w-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10" @click="resetView">⟲</button>
          <button class="h-7 w-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10" @click="handleClose">✕</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 flex">
        <div class="w-48 border-r border-white/10 p-2 overflow-y-auto shrink-0 space-y-1">
          <div v-for="obj in filteredObjects" :key="`${obj.type}-${obj.index}`" class="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors" :class="selected.type === obj.type && selected.index === obj.index ? 'bg-cyan-500/15 text-cyan-200' : 'hover:bg-white/5 text-white/60'" @click="selected = { type: obj.type, index: obj.index }">
            <div class="w-2 h-2 rounded-full shrink-0" :style="{ background: obj.color }" />
            <span class="flex-1 truncate">{{ obj.label }}</span>
            <span class="text-[10px] text-white/30">{{ obj.type === 'character' ? '角色' : '道具' }}</span>
          </div>
        </div>
        <div class="flex-1 flex flex-col min-h-0">
          <div ref="containerRef" class="flex-1 relative" />
          <div class="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-white/10 shrink-0">
            <button class="h-7 px-2 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20" @click="addCharacter">+ 添加角色</button>
            <button class="h-7 px-2 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20" @click="addPropShape('cube')">+ 道具</button>
            <button class="h-7 px-2 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20" @click="uploadFloorImage">+ 底图</button>
            <span class="text-white/30 text-[10px] mx-1">宽</span>
            <input v-model.number="floorWidth" type="range" min="0.5" max="20" step="0.5" class="w-16 h-1 accent-cyan-500" @input="floorWidthChanged" />
            <span class="text-white/50 text-[10px] w-9">{{ floorWidth }}m</span>
          </div>
        </div>
        <DirectorPropertiesPanel v-model:show-labels="showLabels" v-model:show-grid="showGrid" :composition="composition" :selected="selected" @remove-selected="removeSelectedObject" @reset-view="resetView" @save="save" @add-prop="addPropShape" />
      </div>
    </div>
  </Teleport>
</template>
