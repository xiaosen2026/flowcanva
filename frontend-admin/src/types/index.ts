export interface Canvas {
  id: string
  name: string
  project_type: string
  created_at: string
  updated_at: string
  nodes?: Node[]
}

export interface Node {
  id: string
  canvas_id: string
  node_type: string
  x: number
  y: number
  width: number
  height: number
  content: string
  config: string
  created_at: string
  updated_at: string
}

export interface NodeConfig {
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
  created_at: string
  updated_at: string
}

export interface LogEntry {
  id: string
  level: string
  module: string
  message: string
  detail: string
  created_at: string
}

export interface Asset {
  id: string
  filename: string
  url: string
  size: number
  width: number
  height: number
  category: string
  tags: string
  created_at: string
}

export interface AssetListResponse {
  items: Asset[]
  total: number
  page: number
  page_size: number
}
