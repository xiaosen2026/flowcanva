<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchNodeConfigs } from '../api'

const NODE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  table: '剧本',
  full_image: '全图',
  asset: '资产',
  agent: '智能体',
  workflow: '工作流',
  director: '导演台',
}

const ALL_NODES = ['text', 'image', 'video', 'table', 'full_image', 'asset', 'director', 'agent', 'workflow']

interface NodeConfig {
  node_type: string
  model_name: string
  api_channel: string
  enabled: number
  updated_at: string
}

const configs = ref<NodeConfig[]>([])

const stats = computed(() => {
  const total = configs.value.length
  const enabled = configs.value.filter(c => c.enabled).length
  return { total, enabled, disabled: total - enabled }
})

const allConfigs = computed(() => configs.value)

function formatDate(s: string) {
  if (!s) return '-'
  const d = new Date(s)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function modelLabel(c: NodeConfig) {
  if (!c.model_name) return '-'
  const ch = c.api_channel ? ` (${c.api_channel})` : ''
  return c.model_name + ch
}

onMounted(async () => {
  try {
    configs.value = await fetchNodeConfigs()
  } catch (e) {
    console.error(e)
  }
})
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header 头部渐变区 -->
    <div class="rounded-3xl bg-gradient-to-br from-primary/8 via-primary/3 to-transparent border border-primary/10 p-8 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90 mb-1">仪表盘</h1>
        <p class="text-sm text-base-content/50 font-semibold">概览系统当前运行的节点状态与模型配置</p>
      </div>
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold">
        <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        {{ stats.enabled }}/{{ stats.total }} 已启用
      </div>
    </div>

    <!-- 状态卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <div class="card bg-base-100 border border-base-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div class="card-body p-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/15">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
            </div>
            <div>
              <div class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">节点总数</div>
              <div class="text-2xl font-black text-base-content/80 mt-0.5">{{ stats.total }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div class="card-body p-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success ring-1 ring-success/15">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">已启用</div>
              <div class="text-2xl font-black text-success mt-0.5">{{ stats.enabled }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div class="card-body p-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-base-content/5 flex items-center justify-center text-base-content/40 ring-1 ring-base-content/10">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <div>
              <div class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">已停用</div>
              <div class="text-2xl font-black text-base-content/80 mt-0.5">{{ stats.disabled }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 节点配置表格 -->
    <div class="bg-base-100 border border-base-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-md w-full">
          <thead>
            <tr class="bg-base-200/20 border-b border-base-200/80 text-xs text-base-content/40 font-bold">
              <th class="py-4 pl-6">节点类型</th>
              <th class="py-4">模型配置</th>
              <th class="py-4">状态</th>
              <th class="py-4">更新时间</th>
              <th class="py-4 pr-6 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-200/40">
            <tr v-for="c in allConfigs" :key="c.node_type" class="hover:bg-base-200/10 transition-colors duration-200">
              <td class="py-4 pl-6">
                <span class="font-bold text-xs text-base-content/75">{{ NODE_LABELS[c.node_type] || c.node_type }}</span>
              </td>
              <td class="py-4">
                <span class="text-xs font-medium font-mono" :class="c.model_name ? 'text-base-content/60' : 'text-base-content/25'">{{ modelLabel(c) }}</span>
              </td>
              <td class="py-4">
                <span :class="c.enabled ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success' : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-base-content/10 text-base-content/50'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="c.enabled ? 'bg-success animate-pulse' : 'bg-base-content/30'"></span>
                  {{ c.enabled ? '已启用' : '已禁用' }}
                </span>
              </td>
              <td class="py-4 text-xs text-base-content/40 font-medium">{{ formatDate(c.updated_at) }}</td>
              <td class="py-4 pr-6 text-right">
                <router-link :to="`/admin/nodes/${c.node_type}`" class="btn btn-xs btn-ghost hover:bg-primary/10 text-primary rounded-lg font-bold text-[10px]">配置</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
