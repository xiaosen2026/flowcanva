<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  nodeType: string
  title: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '控制画布端此类型节点组件是否激活并可被选用'
})

const enabled = ref(1)
const loading = ref(false)
const saved = ref(false)

async function load() {
  try {
    const res = await fetch(`/api/admin/node-configs/${props.nodeType}`)
    if (!res.ok) return
    const data = await res.json()
    enabled.value = data.enabled ?? 1
  } catch (e) { console.error(e) }
}

async function save() {
  loading.value = true
  saved.value = false
  try {
    await fetch(`/api/admin/node-configs/${props.nodeType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled.value }),
    })
    saved.value = true
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="p-8 max-w-3xl mx-auto space-y-8">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90 mb-1">{{ title }}</h1>
      <p class="text-sm text-base-content/40 font-medium">{{ description }}</p>
    </div>

    <div v-if="saved" class="alert alert-success bg-success/10 border-success/20 text-success text-xs font-semibold rounded-xl flex items-center gap-2.5 p-4 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>节点配置已成功同步到系统数据库</span>
    </div>

    <div class="flex flex-col gap-6">
      <!-- 说明卡片：此节点不涉及 AI -->
      <div class="card bg-info/5 border border-info/10 rounded-2xl p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-info shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div class="space-y-1">
            <p class="text-sm font-bold text-info/80">此节点不涉及 AI 模型调用</p>
            <p class="text-xs text-info/60 leading-relaxed">该节点为纯工具型组件，无需配置模型名称、API 渠道等参数。下方仅控制节点在画布端的显示开关。</p>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 shadow-sm p-5 rounded-2xl">
        <label class="label cursor-pointer justify-between w-full">
          <div class="space-y-0.5">
            <span class="label-text font-bold text-base-content/80 text-sm">启用此节点类型</span>
            <p class="text-[11px] text-base-content/40 font-medium">关闭后，画布端左侧工具栏将隐藏此节点，已放置的节点不受影响</p>
          </div>
          <input v-model.number="enabled" type="checkbox" class="toggle toggle-primary toggle-md" :true-value="1" :false-value="0" />
        </label>
      </div>

      <button class="btn btn-primary btn-md w-full rounded-2xl font-bold tracking-widest text-sm shadow-md transition-all duration-200 active:scale-[0.98]" :class="{ 'btn-disabled opacity-60': loading }" @click="save">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1"></span>
        {{ loading ? '保存中...' : '保存配置' }}
      </button>
    </div>
  </div>
</template>
