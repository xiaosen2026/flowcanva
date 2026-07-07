<script setup lang="ts">
const CANVAS_APP_URL = import.meta.env.DEV ? '/canvas' : '/canvas'
</script>

<template>
    <div class="flex h-screen overflow-hidden bg-base-100">
      <aside class="w-60 bg-base-100 flex flex-col shrink-0 border-r border-base-200/60 shadow-sm relative z-10">
        <div class="flex items-center gap-2.5 px-5 py-5 border-b border-base-200/60">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          </div>
          <router-link to="/" class="text-base font-extrabold tracking-wide leading-tight hover:text-primary transition-colors text-base-content/80">FlowCanva</router-link>
        </div>

        <nav class="flex-1 overflow-y-auto py-4 space-y-4">
          <div>
            <div class="px-5 pb-2 text-[11px] font-extrabold text-base-content/35 uppercase tracking-widest">我的项目</div>
            <router-link
              to="/"
              class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold rounded-lg mx-2.5 hover:bg-base-200/50 hover:text-base-content transition-all duration-200 relative group text-base-content/60"
              active-class="bg-primary/5 text-primary font-semibold hover:bg-primary/5!"
            >
              <span class="absolute left-0 top-2 bottom-2 w-0.75 bg-primary rounded-r opacity-0 group-[.router-link-active]:opacity-100 transition-opacity" />
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
              画布项目
            </router-link>
          </div>

          <div class="mx-4 border-t border-base-200/40" />

          <div>
            <div class="px-5 pb-2 text-[11px] font-extrabold text-base-content/35 uppercase tracking-widest">资产管理</div>
            <router-link
              to="/assets"
              class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold rounded-lg mx-2.5 hover:bg-base-200/50 hover:text-base-content transition-all duration-200 relative group text-base-content/60"
              active-class="bg-primary/5 text-primary font-semibold hover:bg-primary/5!"
            >
              <span class="absolute left-0 top-2 bottom-2 w-0.75 bg-primary rounded-r opacity-0 group-[.router-link-active]:opacity-100 transition-opacity" />
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              素材库
            </router-link>
          </div>

          <div class="mx-4 border-t border-base-200/40" />

          <div>
            <div class="px-5 pb-2 text-[11px] font-extrabold text-base-content/35 uppercase tracking-widest">节点配置</div>
            <router-link
              to="/admin"
              class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold rounded-lg mx-2.5 hover:bg-base-200/50 hover:text-base-content transition-all duration-200 relative group text-base-content/60"
              active-class="bg-primary/5 text-primary font-semibold hover:bg-primary/5!"
            >
              <span class="absolute left-0 top-2 bottom-2 w-0.75 bg-primary rounded-r opacity-0 group-[.router-link-active]:opacity-100 transition-opacity" />
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              仪表盘
            </router-link>

            <div class="px-6 pt-3 pb-1.5 text-[11px] font-extrabold text-base-content/30 uppercase tracking-wider">节点类型</div>
            <router-link
              v-for="nt in ['text', 'image', 'video', 'table', 'full_image', 'asset', 'director', 'agent', 'workflow']" :key="nt"
              :to="`/admin/nodes/${nt}`"
              class="flex items-center gap-2 px-5 py-2 text-[12px] font-semibold rounded-lg mx-2.5 ml-6 hover:bg-base-200/50 hover:text-base-content transition-all duration-200 relative group text-base-content/55"
              active-class="bg-primary/5 text-primary font-semibold hover:bg-primary/5!"
            >
              <span class="absolute left-0 top-2 bottom-2 w-0.75 bg-primary rounded-r opacity-0 group-[.router-link-active]:opacity-100 transition-opacity" />
              <span class="w-1.25 h-1.25 rounded-full bg-base-content/20 group-[.router-link-active]:bg-primary shrink-0 transition-colors" />
              {{ { text: '文本节点', image: '图片节点', video: '视频节点', table: '剧本节点', full_image: '全图节点', asset: '资产节点', director: '导演台节点', agent: '智能体节点', workflow: '工作流节点' }[nt] }}
            </router-link>

            <router-link
              to="/admin/logs"
              class="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold rounded-lg mx-2.5 hover:bg-base-200/50 hover:text-base-content transition-all duration-200 relative group text-base-content/60 mt-1"
              active-class="bg-primary/5 text-primary font-semibold hover:bg-primary/5!"
            >
              <span class="absolute left-0 top-2 bottom-2 w-0.75 bg-primary rounded-r opacity-0 group-[.router-link-active]:opacity-100 transition-opacity" />
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              日志
            </router-link>
          </div>

          <div class="mx-4 border-t border-base-200/40" />

          <div class="px-5 pb-3">
            <a
              :href="CANVAS_APP_URL"
              target="_blank"
              class="flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-lg hover:bg-base-200/50 transition-all duration-200 text-primary font-semibold group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              打开画布
            </a>
          </div>
        </nav>
      </aside>

      <main class="flex-1 overflow-y-auto bg-base-100">
        <router-view />
      </main>
    </div>
</template>
