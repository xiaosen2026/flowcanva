<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchLogs } from '../api'
import type { LogEntry } from '../types'

const logs = ref<LogEntry[]>([])
const filterLevel = ref('')
const loading = ref(false)

async function loadLogs() {
  loading.value = true
  try {
    logs.value = await fetchLogs({ level: filterLevel.value || undefined })
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(loadLogs)
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto space-y-8">
    <!-- Header 说明区域 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-base-200/80">
      <div class="space-y-1.5">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6.5 h-6.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div>
            <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90">系统日志</h1>
            <p class="text-xs text-base-content/40 font-medium">实时监控和查阅系统后台关键操作及报错轨迹</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 过滤器操作区 -->
    <div class="flex items-center gap-3 bg-base-100 border border-base-200/85 p-3 rounded-2xl w-fit shadow-sm">
      <select v-model="filterLevel" class="select select-sm select-bordered w-36 font-semibold text-xs rounded-xl focus:ring-2 focus:ring-primary/10" @change="loadLogs">
        <option value="">全部级别</option>
        <option value="INFO">INFO (普通信息)</option>
        <option value="WARN">WARN (警告警告)</option>
        <option value="ERROR">ERROR (致命异常)</option>
      </select>
      <button class="btn btn-sm btn-ghost hover:bg-base-200 border border-base-200 rounded-xl px-4 font-bold text-xs" @click="loadLogs">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1"></span>
        刷新日志
      </button>
    </div>

    <!-- 表格区域 -->
    <div class="bg-base-100 border border-base-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-md w-full">
          <thead>
            <tr class="bg-base-200/30 border-b border-base-200/80 text-xs text-base-content/40 font-bold">
              <th class="py-4 pl-6 w-52">产生时间</th>
              <th class="py-4 w-28">日志级别</th>
              <th class="py-4 w-40">模块名</th>
              <th class="py-4 pr-6">消息内容</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-200/50">
            <tr v-for="l in logs" :key="l.id" class="hover:bg-base-200/10 transition-colors duration-200">
              <td class="py-4 pl-6 whitespace-nowrap text-xs text-base-content/40 font-mono font-bold">{{ l.created_at }}</td>
              <td class="py-4">
                <span
                  :class="{
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-info/10 text-info': l.level === 'INFO',
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-warning/10 text-warning': l.level === 'WARN',
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-error/10 text-error': l.level === 'ERROR',
                  }"
                >
                  {{ l.level }}
                </span>
              </td>
              <td class="py-4 text-xs font-semibold text-base-content/60 font-mono">{{ l.module }}</td>
              <td class="py-4 pr-6 text-sm text-base-content/75 font-medium leading-relaxed max-w-xl break-words">{{ l.message }}</td>
            </tr>
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="4" class="text-center text-xs font-bold text-base-content/30 py-16">
                暂无匹配的系统操作日志记录
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
