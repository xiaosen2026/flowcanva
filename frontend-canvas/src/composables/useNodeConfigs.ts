import { ref } from 'vue'
import { fetchNodeConfigs } from '../api'

export interface ModelInfo {
  name: string
  channel: string
  base_url: string
  api_key: string
  path: string
  protocol?: string
  parameters: Record<string, any>
}

export interface RoleInfo {
  key: string
  label: string
  prompt: string
}

interface ExtraModel {
  name?: string
  channel?: string
  base_url?: string
  api_key?: string
  path?: string
  protocol?: string
  parameters?: Record<string, any>
}

interface NodeConfig {
  id: string
  node_type: string
  model_name: string
  api_channel: string
  base_url: string
  api_key: string
  parameters: string
  prompt_template: string
  extra_config: string
  enabled: number
}

const configMap = ref<Record<string, NodeConfig>>({})
const modelInfoMap = ref<Record<string, ModelInfo[]>>({})
const roleMap = ref<Record<string, RoleInfo[]>>({})
const loading = ref(false)

const FALLBACK_NAMES = ['GPT-4', 'Claude 3', 'Gemini']

export function useNodeConfigs() {
  async function load() {
    if (loading.value) return
    loading.value = true
    try {
      const configs = await fetchNodeConfigs()
      const cMap: Record<string, NodeConfig> = {}
      const miMap: Record<string, ModelInfo[]> = {}

      for (const c of configs) {
        cMap[c.node_type] = c
        if (!c.enabled) continue

        const list: ModelInfo[] = []

        if (c.model_name) {
          list.push({
            name: c.model_name,
            channel: c.api_channel || '',
            base_url: c.base_url || '',
            api_key: c.api_key || '',
            path: '',
            protocol: (c as any).protocol || '',
            parameters: parseParams(c.parameters),
          })
        }

        try {
          const extra = JSON.parse(c.extra_config || '{}')
          const extraModels: ExtraModel[] = extra.models || []
          for (const m of extraModels) {
            if (m.name) {
              list.push({
                name: m.name,
                channel: m.channel || '',
                base_url: m.base_url || '',
                api_key: m.api_key || '',
                path: m.path || '',
                protocol: m.protocol || '',
                parameters: m.parameters || {},
              })
            }
          }
          // parse roles
          const extraRoles: RoleInfo[] = extra.roles || []
          roleMap.value[c.node_type] = extraRoles
        } catch { /* ignore */ }

        miMap[c.node_type] = list
      }

      configMap.value = cMap
      modelInfoMap.value = miMap
      return configs
    } catch {
      // keep defaults
    } finally {
      loading.value = false
    }
  }

  function parseParams(raw: string): Record<string, any> {
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { return {} }
  }

  function getModels(nodeType: string): string[] {
    const list = modelInfoMap.value[nodeType]
    if (list && list.length > 0) return list.map(m => m.name)
    return FALLBACK_NAMES
  }

  function getModelConfig(nodeType: string, modelName: string): ModelInfo | null {
    const list = modelInfoMap.value[nodeType]
    if (!list) return null
    return list.find(m => m.name === modelName) || null
  }

  function getRoles(nodeType: string): RoleInfo[] {
    return roleMap.value[nodeType] || []
  }

  return { configMap, modelInfoMap, loadNodeConfigs: load, getModels, getModelConfig, getRoles }
}
