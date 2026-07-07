<script setup lang="ts">
import SimpleNodeConfig from '../components/SimpleNodeConfig.vue'
</script>

<template>
  <SimpleNodeConfig node-type="workflow" title="工作流节点配置" description="画布中用于 ComfyUI 工作流编排与执行，通过 Server URL 直连 ComfyUI 后端推理生成，不依赖 LLM 大模型" />
</template>
