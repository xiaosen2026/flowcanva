export interface Canvas {
  id: string
  name: string
  project_type: string
  created_at: string
  updated_at: string
  nodes: Node[]
  edges?: Edge[]
}

export interface Node {
  id: string
  canvas_id: string
  node_type: 'text' | 'image' | 'video' | 'table' | 'full_image' | 'agent' | 'workflow' | 'asset' | 'director'
  x: number
  y: number
  width: number
  height: number
  content: string
  config: string
  created_at: string
  updated_at: string
}

export interface ViewportState {
  ox: number
  oy: number
  zoom: number
}

export interface Edge {
  id: string
  canvas_id: string
  source_node_id: string
  target_node_id: string
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
