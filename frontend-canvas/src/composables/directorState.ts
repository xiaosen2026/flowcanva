import type { Node } from '../types'

export interface DirectorVec3 {
  x: number
  y: number
  z: number
}

export type DirectorJointAngles = Record<string, number>

export interface DirectorCharacter {
  id: string
  label: string
  color: string
  bodyType: string
  pose: string
  jointAngles: DirectorJointAngles
  position: DirectorVec3
  rotation: DirectorVec3
  scale: DirectorVec3
  uniformScale: number
  visible: boolean
  locked: boolean
  height: number
  girth: number
  style: string
  cgOffset: DirectorVec3
  showCG: boolean
}

export interface DirectorCamera {
  id: string
  label: string
  position: DirectorVec3
  lookAtTarget: string
  lookAt: DirectorVec3
  cameraRotation: DirectorVec3
  fov: number
  zoom: number
  visible: boolean
  locked: boolean
  screenshots: string[]
}

export interface DirectorEnvironment {
  panoramaUrl: string
  skyColor: string
  groundVisible: boolean
  groundOpacity: number
  groundHeight: number
  panoramaRotationY: number
  panoramaRadius: number
  sceneScale: number
  sceneTranslation: DirectorVec3
  sceneRotation: DirectorVec3
}

export interface DirectorProp {
  id: string
  label: string
  shape: 'cube' | 'sphere' | 'cylinder'
  position: DirectorVec3
  rotation: DirectorVec3
  scale: DirectorVec3
  color: string
  visible: boolean
}

export interface DirectorCompositionData {
  characters: DirectorCharacter[]
  characterGroups: unknown[]
  cameras: DirectorCamera[]
  props: DirectorProp[]
  environment: DirectorEnvironment
  aspectRatio: number
}

export interface JointDef {
  key: string
  label: string
  group: string
  side: string
  bone: string
  axis: 'x' | 'y' | 'z'
  min: number
  max: number
}

export const JOINTS: JointDef[] = [
  { group: '身体', side: '', key: 'bodyX', label: '前倾', bone: 'mixamorig:Hips', axis: 'x', min: -100, max: 100 },
  { group: '身体', side: '', key: 'bodyY', label: '转身', bone: 'mixamorig:Hips', axis: 'y', min: -90, max: 90 },
  { group: '身体', side: '', key: 'bodyZ', label: '侧倾', bone: 'mixamorig:Hips', axis: 'z', min: -30, max: 30 },
  { group: '躯干', side: '', key: 'spineX', label: '前倾(弯腰)', bone: 'mixamorig:Spine1', axis: 'x', min: -35, max: 35 },
  { group: '躯干', side: '', key: 'spineY', label: '扭转', bone: 'mixamorig:Spine1', axis: 'y', min: -40, max: 40 },
  { group: '躯干', side: '', key: 'spineZ', label: '侧倾', bone: 'mixamorig:Spine1', axis: 'z', min: -30, max: 30 },
  { group: '头部', side: '', key: 'headX', label: '点头', bone: 'mixamorig:Head', axis: 'x', min: -45, max: 45 },
  { group: '头部', side: '', key: 'headY', label: '转头', bone: 'mixamorig:Head', axis: 'y', min: -60, max: 60 },
  { group: '头部', side: '', key: 'headZ', label: '歪头', bone: 'mixamorig:Head', axis: 'z', min: -35, max: 35 },
  { group: '手臂—肩', side: '左', key: 'lArmFwd', label: '前举', bone: 'mixamorig:LeftArm', axis: 'y', min: -90, max: 180 },
  { group: '手臂—肩', side: '左', key: 'lArmAbd', label: '外展', bone: 'mixamorig:LeftArm', axis: 'z', min: -95, max: 35 },
  { group: '手臂—肩', side: '左', key: 'lArmTwist', label: '扭转', bone: 'mixamorig:LeftArm', axis: 'x', min: -90, max: 90 },
  { group: '手臂—肩', side: '右', key: 'rArmFwd', label: '前举', bone: 'mixamorig:RightArm', axis: 'y', min: -90, max: 180 },
  { group: '手臂—肩', side: '右', key: 'rArmAbd', label: '外展', bone: 'mixamorig:RightArm', axis: 'z', min: -35, max: 95 },
  { group: '手臂—肩', side: '右', key: 'rArmTwist', label: '扭转', bone: 'mixamorig:RightArm', axis: 'x', min: -90, max: 90 },
  { group: '肘部', side: '左', key: 'lFore', label: '弯曲', bone: 'mixamorig:LeftForeArm', axis: 'y', min: -110, max: 10 },
  { group: '肘部', side: '右', key: 'rFore', label: '弯曲', bone: 'mixamorig:RightForeArm', axis: 'y', min: -10, max: 110 },
  { group: '手腕', side: '左', key: 'lHand', label: '弯曲', bone: 'mixamorig:LeftHand', axis: 'x', min: -60, max: 60 },
  { group: '手腕', side: '右', key: 'rHand', label: '弯曲', bone: 'mixamorig:RightHand', axis: 'x', min: -60, max: 60 },
  { group: '腿部—髋', side: '左', key: 'lLegFwd', label: '抬腿', bone: 'mixamorig:LeftUpLeg', axis: 'x', min: -90, max: 50 },
  { group: '腿部—髋', side: '左', key: 'lLegAbd', label: '外展', bone: 'mixamorig:LeftUpLeg', axis: 'z', min: -30, max: 45 },
  { group: '腿部—髋', side: '右', key: 'rLegFwd', label: '抬腿', bone: 'mixamorig:RightUpLeg', axis: 'x', min: -90, max: 50 },
  { group: '腿部—髋', side: '右', key: 'rLegAbd', label: '外展', bone: 'mixamorig:RightUpLeg', axis: 'z', min: -45, max: 30 },
  { group: '膝', side: '左', key: 'lKnee', label: '弯曲', bone: 'mixamorig:LeftLeg', axis: 'x', min: 0, max: 130 },
  { group: '膝', side: '右', key: 'rKnee', label: '弯曲', bone: 'mixamorig:RightLeg', axis: 'x', min: 0, max: 130 },
  { group: '踝', side: '左', key: 'lFoot', label: '勾绷', bone: 'mixamorig:LeftFoot', axis: 'x', min: -40, max: 40 },
  { group: '踝', side: '右', key: 'rFoot', label: '勾绷', bone: 'mixamorig:RightFoot', axis: 'x', min: -40, max: 40 },
]

export const BLANK_POSE: DirectorJointAngles = Object.fromEntries(JOINTS.map(j => [j.key, 0]))

export const POSE_PRESETS: { key: string; label: string; values: Partial<DirectorJointAngles> }[] = [
  { key: 'stand', label: '站立', values: { lArmAbd: -80, rArmAbd: 80, lFore: -8, rFore: 8 } },
  { key: 'tpose', label: 'T型', values: {} },
  { key: 'walk', label: '行走', values: { lArmAbd: -80, rArmAbd: 80, lLegFwd: -25, rLegFwd: 20, lKnee: 20, rKnee: 10, lArmFwd: -25, rArmFwd: 30, lFore: -25, rFore: 25 } },
  { key: 'run', label: '跑步', values: { lArmAbd: -80, rArmAbd: 80, spineX: 15, lLegFwd: -40, rLegFwd: 30, lKnee: 30, rKnee: 85, lArmFwd: 7, rArmFwd: -5, lFore: -95, rFore: 95, lArmTwist: 21, rArmTwist: 20 } },
  { key: 'akimbo', label: '叉腰', values: { lArmAbd: -85, rArmAbd: 85, lArmFwd: 15, rArmFwd: 15, lFore: -115, rFore: 115, lArmTwist: 20, rArmTwist: -20 } },
  { key: 'bow', label: '鞠躬', values: { bodyX: 0, spineX: 35, headX: 12, lArmAbd: -80, rArmAbd: 80, lFore: -8, rFore: 8 } },
  { key: 'think', label: '思考', values: { headX: 12, headZ: 8, lArmAbd: -80, lArmFwd: 15, lFore: -95, rArmAbd: 80, rArmFwd: 25, rFore: 100, rArmTwist: 15 } },
  { key: 'fight', label: '格斗', values: { spineX: 10, spineY: 12, lLegFwd: -15, rLegFwd: 10, lKnee: 20, rKnee: 20, lArmFwd: 60, rArmFwd: 20, lArmAbd: -85, rArmAbd: 85, lFore: -100, rFore: 90, lArmTwist: -30, rArmTwist: 20 } },
  { key: 'kick', label: '踢球', values: { spineX: -10, rLegFwd: -70, rKnee: 20, lKnee: 12, lArmAbd: -80, rArmAbd: 80, lArmFwd: -15, rArmFwd: -15 } },
  { key: 'throw', label: '投掷', values: { bodyY: -20, spineY: -28, lLegFwd: -20, rLegFwd: 15, rArmFwd: -85, rArmAbd: 85, rFore: 85, lArmFwd: 50, lArmAbd: -85 } },
  { key: 'wave', label: '招手', values: { lArmAbd: -80, lFore: -8, rArmAbd: 110, rArmFwd: 15, rFore: 80, rArmTwist: -30, headY: -8 } },
  { key: 'reach', label: '伸手', values: { lArmAbd: -80, lFore: -8, spineX: 5, rArmFwd: 85, rArmAbd: 80, rFore: 0 } },
  { key: 'sit', label: '坐下', values: { lArmAbd: -80, rArmAbd: 80, lArmFwd: -5, rArmFwd: -5, lFore: -30, rFore: 30, spineX: 3, lLegFwd: -85, rLegFwd: -85, lKnee: 90, rKnee: 90 } },
  { key: 'kneelOne', label: '单膝跪地', values: { lArmAbd: -80, rArmAbd: 80, lFore: -8, rFore: 8, spineX: 8, lLegFwd: 0, lKnee: 90, rLegFwd: -85, rKnee: 100, lArmFwd: -5, rArmFwd: -5 } },
  { key: 'kneelTwo', label: '双膝跪地', values: { lArmAbd: -80, rArmAbd: 80, lFore: -8, rFore: 8, spineX: 5, lLegFwd: -5, rLegFwd: -5, lKnee: 95, rKnee: 95 } },
  { key: 'prone', label: '匍匐', values: { bodyX: 85, spineX: 5, headX: -10, lArmAbd: -80, rArmAbd: 80, lArmFwd: -70, rArmFwd: -70, lFore: -30, rFore: 30, lLegFwd: 5, rLegFwd: -5, lKnee: 15, rKnee: 25 } },
  { key: 'lieDown', label: '躺下', values: { bodyX: -90, spineX: -5, headX: 5, lArmAbd: -80, rArmAbd: 80, lArmFwd: -5, rArmFwd: -5, lFore: -8, rFore: 8, lLegFwd: 3, rLegFwd: 3, lKnee: 5, rKnee: 5 } },
]

export const CHARACTER_COLORS = ['#4F8EF7', '#F75353', '#34C759', '#FF9F0A', '#AF52DE', '#5AC8FA', '#FF2D55', '#00C7BE']
export const TARGET_CHARACTER_HEIGHT = 1.75

export const cameraPresets: Record<string, { label: string; position: DirectorVec3; lookAt: DirectorVec3; fov: number }> = {
  front: { label: '正面', position: { x: 0, y: 1.5, z: 8 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
  side: { label: '侧面', position: { x: 10, y: 1.5, z: 0 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
  top: { label: '俯拍', position: { x: 0, y: 12, z: 0.1 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
  low: { label: '仰拍', position: { x: 0, y: 0.3, z: 5 }, lookAt: { x: 0, y: 1.8, z: 0 }, fov: 60 },
  closeup: { label: '特写', position: { x: 0, y: 1.5, z: 2.5 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 35 },
  medium: { label: '中景', position: { x: 0, y: 1.8, z: 6 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 45 },
  wide: { label: '全景', position: { x: 0, y: 4, z: 14 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 65 },
}

export const aspectRatios: Record<string, { label: string; w: number; h: number }> = {
  '16:9': { label: '16:9', w: 320, h: 180 },
  '9:16': { label: '9:16', w: 180, h: 320 },
  '1:1': { label: '1:1', w: 240, h: 240 },
  '4:3': { label: '4:3', w: 280, h: 210 },
  '21:9': { label: '21:9', w: 350, h: 150 },
}

const zeroVec = (): DirectorVec3 => ({ x: 0, y: 0, z: 0 })
const scaleVec = (v: number): DirectorVec3 => ({ x: v, y: v, z: v })

export const defaultDirectorComposition: DirectorCompositionData = {
  characters: [
    { id: 'h79pdstc', label: '角色A', color: '#4F8EF7', bodyType: 'mannequin', pose: 'stand', jointAngles: clonePose(POSE_PRESETS[0].values), position: { x: -2, y: 0, z: 3 }, rotation: zeroVec(), scale: scaleVec(1.03), uniformScale: 1, visible: true, locked: false, height: 1.75, girth: 0.98, style: 'neutral', cgOffset: zeroVec(), showCG: true },
    { id: 'ye8gvwx6', label: '角色B', color: '#F75353', bodyType: 'female', pose: 'stand', jointAngles: clonePose(POSE_PRESETS[0].values), position: zeroVec(), rotation: { x: 0, y: -4.8, z: 0 }, scale: scaleVec(0.94), uniformScale: 1, visible: true, locked: false, height: 1.68, girth: 0.82, style: 'female', cgOffset: zeroVec(), showCG: true },
  ],
  characterGroups: [],
  cameras: [{
    id: '79aewao7', label: '机位1', position: { x: -0.7, y: 1.1, z: 8.6 }, lookAtTarget: '',
    lookAt: { x: -0.7, y: 0.14, z: -1.3 }, cameraRotation: { x: 174.3, y: 0, z: -180 },
    fov: 50, zoom: 1, visible: true, locked: false, screenshots: [],
  }],
  props: [],
  environment: {
    panoramaUrl: '', skyColor: '#060608', groundVisible: true, groundOpacity: 0.4, groundHeight: 0,
    panoramaRotationY: 0, panoramaRadius: 60, sceneScale: 3, sceneTranslation: { x: -0.2, y: 0, z: 0 }, sceneRotation: zeroVec(),
  },
  aspectRatio: 0.5625,
}

function clonePose(vals: Partial<DirectorJointAngles>): DirectorJointAngles {
  const result: Record<string, number> = {}
  for (const key of JOINTS.map(j => j.key)) {
    result[key] = vals[key] ?? 0
  }
  return result as DirectorJointAngles
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeCharacter(character: Partial<DirectorCharacter>): DirectorCharacter {
  const fallback = defaultDirectorComposition.characters[0]
  return {
    ...clone(fallback),
    ...character,
    jointAngles: character.jointAngles
      ? { ...clone(BLANK_POSE), ...character.jointAngles }
      : clone(fallback.jointAngles),
    position: character.position ?? clone(fallback.position),
    rotation: character.rotation ?? clone(fallback.rotation),
    scale: character.scale ?? clone(fallback.scale),
    cgOffset: character.cgOffset ?? clone(fallback.cgOffset),
    showCG: character.showCG ?? fallback.showCG,
  }
}

export function parseDirectorComposition(node: Node | null): DirectorCompositionData {
  if (!node?.content) return clone(defaultDirectorComposition)
  try {
    const parsed = JSON.parse(node.content)
    const composition = parsed?.compositionData ?? parsed
    if (!composition?.characters) return clone(defaultDirectorComposition)
    const fallback = clone(defaultDirectorComposition)
    return {
      ...fallback,
      ...composition,
      characters: (composition.characters ?? []).map(normalizeCharacter),
      cameras: composition.cameras ?? fallback.cameras,
      props: (composition.props as DirectorProp[]) ?? [],
      environment: { ...fallback.environment, ...(composition.environment ?? {}) },
    }
  } catch {
    return clone(defaultDirectorComposition)
  }
}

export function serializeDirectorComposition(node: Node | null, data: DirectorCompositionData): string {
  return JSON.stringify({
    type: 'director-console-3d',
    name: node?.content ? (safeJson(node.content)?.name ?? '导演台') : '导演台',
    action: 'director_console_panorama_input',
    contentWidth: 350,
    contentHeight: 350,
    compositionData: data,
    _updatedAtMs: Date.now(),
    _lastAppliedFullyAtMs: Date.now(),
  })
}

function safeJson(content: string): any {
  try { return JSON.parse(content) } catch { return null }
}
