<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  canvasId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface Preset {
  id: string
  name: string
  prompt: string
  category: string
  preset_type: string
  scope: string
  canvas_id: string
}

const presets = ref<Preset[]>([])
const categories = ref<string[]>([])
const presetTypes = ref<string[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)

const newName = ref('')
const newPrompt = ref('')
const newCategory = ref('通用')
const newPresetType = ref('image')
const newScope = ref('canvas')

async function load() {
  loading.value = true
  try {
    const globalRes = await fetch('/api/admin/presets?scope=global')
    const g = await globalRes.json()
    let c: any[] = []
    if (props.canvasId) {
      try {
        const canvasRes = await fetch(`/api/admin/presets?scope=canvas&canvas_id=${props.canvasId}`)
        if (canvasRes.ok) c = await canvasRes.json()
      } catch {}
    }
    presets.value = [...(Array.isArray(c) ? c : []), ...(Array.isArray(g) ? g : [])]
    categories.value = [...new Set(presets.value.map((p: any) => p.category))]
    presetTypes.value = [...new Set(presets.value.map((p: any) => p.preset_type || 'image'))]
  } catch { } finally { loading.value = false }
}

function startEdit(p: Preset) {
  editingId.value = p.id
  newName.value = p.name
  newPrompt.value = p.prompt
  newCategory.value = p.category
  newPresetType.value = p.preset_type || 'image'
  newScope.value = p.scope
  showForm.value = true
}

function cancelEdit() {
  editingId.value = null
  showForm.value = false
  newName.value = ''
  newPrompt.value = ''
  newCategory.value = '通用'
}

async function savePreset() {
  if (!newName.value.trim() || !newPrompt.value.trim()) return
  try {
    if (editingId.value) {
      const res = await fetch(`/api/admin/presets/${editingId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.value, prompt: newPrompt.value, category: newCategory.value, preset_type: newPresetType.value, scope: newScope.value, canvas_id: props.canvasId }),
      })
      if (!res.ok) throw new Error('保存失败')
    } else {
      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.value, prompt: newPrompt.value, category: newCategory.value, preset_type: newPresetType.value, scope: newScope.value, canvas_id: props.canvasId }),
      })
      if (!res.ok) throw new Error('保存失败')
    }
    cancelEdit()
    load()
  } catch (e) { console.error('save preset', e) }
}

async function deletePreset(id: string) {
  if (!confirm('删除该预设？')) return
  await fetch(`/api/admin/presets/${id}`, { method: 'DELETE' })
  load()
}

onMounted(load)
</script>

<template>
  <div class="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="bg-base-200 border border-base-300 rounded-2xl w-[560px] h-[80vh] flex flex-col shadow-xl" @wheel.stop>
      <div class="flex items-center justify-between px-5 py-4 border-b border-base-300">
        <h2 class="text-lg font-semibold">预设管理</h2>
        <button class="btn btn-ghost btn-sm btn-square" @click="emit('close')">✕</button>
      </div>

      <div class="flex-1 overflow-y-auto p-5 space-y-3">
        <div v-if="loading" class="text-center py-8 text-base-content/40">加载中...</div>

        <template v-else>
          <div v-for="pt in presetTypes" :key="pt" class="space-y-3 mb-4">
            <div class="text-sm font-semibold text-base-content/60">{{ { image: '图片预设', video: '视频预设' }[pt] || pt }}</div>
            <template v-for="cat in [...new Set(presets.filter(p => (p.preset_type || 'image') === pt).map(p => p.category))]" :key="cat">
              <div class="text-xs font-medium text-base-content/40 ml-3 mb-1">{{ cat }}</div>
              <div v-for="p in presets.filter(pr => (pr.preset_type || 'image') === pt && pr.category === cat)" :key="p.id" class="flex items-start gap-3 bg-base-100 rounded-lg p-3 border border-base-300 ml-3 mb-1.5">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{{ p.name }}</span>
                    <span class="badge badge-xs" :class="p.scope === 'canvas' ? 'badge-info' : 'badge-ghost'">{{ p.scope === 'canvas' ? '画布' : '全局' }}</span>
                  </div>
                  <p class="text-xs text-base-content/50 mt-1 truncate">{{ p.prompt }}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button class="btn btn-ghost btn-xs" @click="startEdit(p)">编辑</button>
                  <button class="btn btn-ghost btn-xs text-error" @click="deletePreset(p.id)">删除</button>
                </div>
              </div>
            </template>
          </div>

          <div v-if="presets.length === 0" class="text-center py-8 text-base-content/30">暂无预设</div>
        </template>
      </div>

      <div class="px-5 py-4 border-t border-base-300">
        <template v-if="showForm">
          <div class="space-y-3">
            <div class="flex gap-2">
              <input v-model="newName" placeholder="名称" class="input input-bordered input-sm flex-1" />
              <input v-model="newCategory" placeholder="分类" class="input input-bordered input-sm w-24" />
            </div>
            <textarea v-model="newPrompt" placeholder="提示词内容" class="textarea textarea-bordered w-full h-16 text-sm" />
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-base-content/50">类型:</span>
                <select v-model="newPresetType" class="select select-xs select-bordered">
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                </select>
              </div>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input v-model="newScope" type="radio" value="canvas" class="radio radio-xs" /><span class="text-xs">画布</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input v-model="newScope" type="radio" value="global" class="radio radio-xs" /><span class="text-xs">全局</span>
              </label>
              <div class="flex-1" />
              <button class="btn btn-primary btn-xs" @click="savePreset">保存</button>
              <button class="btn btn-ghost btn-xs" @click="cancelEdit">取消</button>
            </div>
          </div>
        </template>
        <button v-else class="btn btn-ghost btn-sm" @click="showForm = true">+ 新建预设</button>
      </div>
    </div>
  </div>
</template>
