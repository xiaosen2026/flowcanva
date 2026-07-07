<script setup lang="ts">
import { computed, ref } from 'vue'
import { JOINTS, POSE_PRESETS, BLANK_POSE, aspectRatios, type DirectorCompositionData, type DirectorJointAngles } from '../composables/directorState'
import type { DirectorProp } from '../composables/directorState'

const props = defineProps<{
  composition: DirectorCompositionData
  selected: { type: 'character' | 'prop'; index: number }
  showLabels: boolean
  showGrid: boolean
}>()

const emit = defineEmits<{
  'update:showLabels': [value: boolean]
  'update:showGrid': [value: boolean]
  'add-prop': [shape: 'cube' | 'sphere' | 'cylinder']
  'remove-selected': []
  'reset-view': []
  'save': []
}>()

const pasteError = ref('')
const pasteSuccess = ref('')

async function copySystemPrompt() {
  if (!selectedCharacter.value) return
  const char = selectedCharacter.value

  const jointRef = JOINTS.map(j =>
    `  ${j.key}  [axis:${j.axis}] range:[${j.min},${j.max}] ${j.group}>${j.side}${j.label}`
  ).join('\n')

  const presetRef = POSE_PRESETS.map(p => {
    const vals = Object.entries(p.values).map(([k, v]) => `${k}:${v}`).join(' ')
    return `  ${p.key}=${p.label} → ${vals || '(T-pose, 全0)'}`
  }).join('\n')

  const text = `## 3D角色骨骼姿态系统

你是一个3D角色姿态生成器。理解以下定义后，根据动作描述输出对应关节角度JSON。

### 当前角色
名称: ${char.label} | 体型: ${char.style} | 身高: ${char.height}m
> 注意: 关节值0=T-pose(双臂水平外展, 双腿并拢直立), 关节值0≠自然站立

### 当前全部关节值
\`\`\`json
${JSON.stringify(char.jointAngles, null, 2)}
\`\`\`

### 27个关节定义 (key→axis→范围→含义)
\`\`\`
${jointRef}
\`\`\`

### 坐标轴快查 (所有旋转是骨骼本地轴, 以下为T-pose下的方向)
| 关节 | 正角度 | 负角度 |
|--------|-----------|-----------|
| bodyX/spineX | 前弯 | 后仰 |
| bodyY/spineY | 右转 | 左转 |
| bodyZ/spineZ | 右倾 | 左倾 |
| headX | 低头 | 仰头 |
| lArmAbd | 手臂上举 | 手臂下放 |
| rArmAbd | 手臂上举 | 手臂下放 |
| lKnee/rKnee | 正弯 | 反弓 |
| lLegFwd/rLegFwd | 前抬 | 后踢 |

> ⚠️ 手臂前/后方向看lArmFwd: 参照下方范例, 不要凭表猜测

### 姿势预设参考 (已知的可工作范例)
\`\`\`
${presetRef}
\`\`\`

### 姿态仿照范例 (精确数值, AI以此为准推算)
\`\`\`json
// 自然站立: 手臂收拢在体侧, 膝关节微松
{"lArmAbd":-80,"rArmAbd":80,"lFore":-8,"rFore":8}

// 双手前伸拿东西: 手臂从体侧向前举起(正lArmFwd), 肘略弯
{"lArmAbd":-60,"lArmFwd":70,"lFore":-25,"rArmAbd":60,"rArmFwd":70,"rFore":25}

// 单膝跪地+右手前伸拿玫瑰: 左膝着地, 身体微前倾, 右手前伸握住, 左手自然下垂
{"lLegFwd":0,"lKnee":90,"rLegFwd":-85,"rKnee":100,"spineX":8,"rArmAbd":50,"rArmFwd":75,"rFore":-15,"lArmAbd":-80}

// 叉腰: 双臂夹紧身体, 肘关节大幅弯曲, 手在腰侧
{"lArmAbd":-85,"lArmFwd":15,"lFore":-115,"rArmAbd":85,"rArmFwd":15,"rFore":115}

// 坐着(椅子): 双腿前下+膝弯90°, 身体微前倾
{"lLegFwd":-85,"lKnee":90,"rLegFwd":-85,"rKnee":90,"spineX":3}

// 躺下: 身体后倒90°, 膝盖弯曲弓起
{"bodyX":-90,"lLegFwd":12,"lKnee":45,"rLegFwd":12,"rKnee":45}
\`\`\`

### 推理方法
1. 找到与描述最接近的预设/范例
2. 根据描述微调(例: 拿玫瑰 → 参照 rArmFwd:75 使手前伸)
3. 双膝跪地 → 参照 lKnee/rKnee≈90-100; 单膝跪 → 只改一侧腿, 另一侧保持站立
4. 向后倒 → bodyX负; 前倾 → spineX正; 举手 → lArmAbd增大(往正方向)
5. 前伸/在身前 → lArmFwd正; 后摆/在背后 → lArmFwd负
6. **输出值覆盖当前值(非叠加), 只输出需要改动的关节**

### 输出格式
只输出JSON代码块, key=关节名 value=角度值, 只输出需要改动的关节:

\`\`\`json
{ "jointKey": 角度, ... }
\`\`\`

请回复 ready, 之后我发动作描述时你直接输出JSON。`

  await navigator.clipboard.writeText(text)
  pasteSuccess.value = '已复制给AI'
  setTimeout(() => pasteSuccess.value = '', 1500)
}

async function pastePose() {
  pasteError.value = ''
  pasteSuccess.value = ''
  if (!selectedCharacter.value) return
  try {
    const text = await navigator.clipboard.readText()
    const data = JSON.parse(text)
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('需要JSON对象')
    let applied = 0
    for (const [k, v] of Object.entries(data)) {
      if (k in selectedCharacter.value.jointAngles && typeof v === 'number') {
        selectedCharacter.value.jointAngles[k] = v
        applied++
      }
    }
    if (!applied) throw new Error('未匹配到任何关节')
    pasteSuccess.value = `已粘贴 ${applied} 个姿态值`
    setTimeout(() => pasteSuccess.value = '', 1500)
  } catch (e: any) {
    pasteError.value = e?.message || '粘贴失败'
    setTimeout(() => pasteError.value = '', 2000)
  }
}

const activeTab = ref<'object' | 'scene'>('object')
const env = computed(() => props.composition.environment)
const selectedCharacter = computed(() => props.selected.type === 'character' ? props.composition.characters[props.selected.index] : null)
const selectedProp = computed(() => props.selected.type === 'prop' ? (props.composition.props as DirectorProp[])?.[props.selected.index] : null)
const selectedTitle = computed(() => selectedCharacter.value?.label ?? selectedProp.value?.label ?? '未选择')

const jointGroups = computed(() => {
  const map = new Map<string, typeof JOINTS>()
  for (const j of JOINTS) {
    if (!map.has(j.group)) map.set(j.group, [])
    map.get(j.group)!.push(j)
  }
  return [...map.entries()]
})

function applyPose(presetKey: string) {
  const char = selectedCharacter.value
  if (!char) return
  const preset = POSE_PRESETS.find(p => p.key === presetKey)
  if (!preset) return
  char.pose = presetKey
  char.jointAngles = { ...BLANK_POSE }
  Object.entries(preset.values).forEach(([k, v]) => { if (v !== undefined) char.jointAngles[k] = v })
}

</script>

<template>
  <div class="w-72 border-l border-white/10 shrink-0 flex flex-col min-h-0">
    <!-- Tab bar -->
    <div class="flex border-b border-white/10 shrink-0">
      <button class="flex-1 h-8 text-xs rounded-none transition-colors" :class="activeTab === 'object' ? 'bg-white/10 text-white border-b-2 border-cyan-500' : 'text-white/40 hover:text-white/70'" @click="activeTab = 'object'">对象</button>
      <button class="flex-1 h-8 text-xs rounded-none transition-colors" :class="activeTab === 'scene' ? 'bg-white/10 text-white border-b-2 border-cyan-500' : 'text-white/40 hover:text-white/70'" @click="activeTab = 'scene'">场景</button>
    </div>

    <!-- Scrollable content -->
    <div class="p-3 overflow-y-auto flex-1 space-y-3">
      <!-- Object info (always visible) -->
      <section class="border-b border-white/10 pb-3 space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-white/80 text-sm">{{ selectedTitle }}</div>
            <div class="text-white/35 text-[10px]">{{ selectedCharacter?.pose || selected.type }}</div>
          </div>
          <button class="h-6 px-2 text-xs rounded bg-red-500/10 text-red-300 hover:bg-red-500/20" @click="emit('remove-selected')">删除</button>
        </div>
      </section>

      <template v-if="activeTab === 'object'">
        <section v-if="selectedCharacter" class="border-b border-white/10 pb-3 space-y-2">
          <label class="text-white/40 text-[10px] uppercase block">姿势预设</label>
          <div class="flex flex-wrap gap-1">
            <button v-for="p in POSE_PRESETS" :key="p.key" class="h-6 px-2 text-[10px] rounded-lg border border-white/10 transition-colors" :class="selectedCharacter?.pose === p.key ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-white/50 hover:text-white'" @click="applyPose(p.key)">{{ p.label }}</button>
          </div>
        </section>

        <section v-if="selectedCharacter" class="border-b border-white/10 pb-3 space-y-1">
          <div class="flex flex-col gap-1">
            <button class="h-6 px-2 text-[10px] rounded bg-white/5 border border-white/10 text-white/50 hover:text-white" @click="copySystemPrompt">📋 复制给AI</button>
            <button class="h-6 px-2 text-[10px] rounded bg-white/5 border border-white/10 text-white/50 hover:text-white" @click="pastePose">📥 粘贴AI输出</button>
          </div>
          <div v-if="pasteSuccess" class="text-[10px] text-cyan-400">{{ pasteSuccess }}</div>
          <div v-if="pasteError" class="text-[10px] text-red-400">{{ pasteError }}</div>
        </section>

        <section v-if="selectedCharacter" class="border-b border-white/10 pb-3 space-y-2">
          <label class="text-white/40 text-[10px] uppercase block">属性</label>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="selectedCharacter.label" class="input-field" />
            <select v-model="selectedCharacter.style" class="input-field bg-neutral-900">
              <option value="neutral">标准</option><option value="female">女性</option>
            </select>
            <div class="flex items-center gap-1 col-span-2">
              <span class="text-[10px] text-white/30 w-6">颜色</span>
              <input v-model="selectedCharacter.color" type="color" class="h-7 flex-1 bg-white/5 border border-white/10 rounded cursor-pointer" />
              <span class="text-white/40 text-[10px] font-mono">{{ selectedCharacter.color }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-white/30 w-6">身高</span>
              <input v-model.number="selectedCharacter.height" type="number" step="0.01" min="0.5" max="3" class="input-field" />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-white/30 w-6">体宽</span>
              <input v-model.number="selectedCharacter.girth" type="number" step="0.01" min="0.5" max="2" class="input-field" />
            </div>
          </div>
        </section>

        <template v-if="selectedProp">
          <div class="grid grid-cols-[18px_1fr_1fr_1fr] gap-1 items-center text-[10px] text-white/40">
            <span>位</span><input v-model.number="selectedProp.position.x" type="number" step="0.1" class="field" /><input v-model.number="selectedProp.position.y" type="number" step="0.1" class="field" /><input v-model.number="selectedProp.position.z" type="number" step="0.1" class="field" />
            <span>转</span><input v-model.number="selectedProp.rotation.x" type="number" step="1" class="field" /><input v-model.number="selectedProp.rotation.y" type="number" step="1" class="field" /><input v-model.number="selectedProp.rotation.z" type="number" step="1" class="field" />
          </div>
        </template>

        <section v-if="selectedCharacter" class="border-b border-white/10 pb-3 space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-white/40 text-[10px] uppercase">脚底坐标 (红X·绿Y·蓝Z)</label>
            <button class="h-5 w-8 rounded-full transition-colors relative" :class="selectedCharacter.showCG ? 'bg-cyan-500' : 'bg-white/15'" @click="selectedCharacter.showCG = !selectedCharacter.showCG">
              <div class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" :class="selectedCharacter.showCG ? 'left-auto right-0.5' : 'left-0.5'" />
            </button>
          </div>
        </section>

        <section v-if="selectedCharacter" class="border-b border-white/10 pb-3 space-y-2">
          <label class="text-white/40 text-[10px] uppercase block">关节控制</label>
          <div v-for="([group, joints]) in jointGroups" :key="group" class="rounded-lg bg-white/[0.03] border border-white/10 p-2 space-y-1.5">
            <div class="text-white/60 text-xs">{{ group }}</div>
            <div v-for="j in joints" :key="j.key" class="flex items-center gap-2">
              <span class="text-white/35 text-[10px] w-12">{{ j.label }}</span>
              <input v-model.number="selectedCharacter.jointAngles[j.key]" type="range" :min="j.min" :max="j.max" step="1" class="flex-1 h-1 accent-cyan-500" />
              <input v-model.number="selectedCharacter.jointAngles[j.key]" type="number" :min="j.min" :max="j.max" step="1" class="w-10 h-6 bg-white/5 border border-white/10 rounded text-white/60 text-xs px-1 outline-none" />
            </div>
          </div>
        </section>

        <section v-if="selectedProp" class="border-b border-white/10 pb-3 space-y-2">
          <label class="text-white/40 text-[10px] uppercase block">道具</label>
          <select v-model="selectedProp.shape" class="input-field bg-neutral-900">
            <option value="cube">方块</option><option value="sphere">球体</option><option value="cylinder">圆柱</option>
          </select>
          <input v-model="selectedProp.label" class="input-field" placeholder="名称" />
          <input v-model="selectedProp.color" type="color" class="h-7 w-full bg-white/5 border border-white/10 rounded" />
        </section>

        <section class="border-b border-white/10 pb-3 space-y-2">
          <div class="flex gap-1"><button class="h-6 px-2 text-[10px] rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white" @click="emit('add-prop', 'cube')">+方块</button><button class="h-6 px-2 text-[10px] rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white" @click="emit('add-prop', 'sphere')">+球体</button><button class="h-6 px-2 text-[10px] rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white" @click="emit('add-prop', 'cylinder')">+圆柱</button></div>
        </section>
      </template>

      <template v-if="activeTab === 'scene'">
        <section class="border-b border-white/10 pb-3 space-y-2">
          <div class="flex items-center gap-2"><span class="text-white/40 text-[10px] w-12">缩放</span><input type="range" v-model.number="env.sceneScale" min="0.5" max="5" step="0.5" class="flex-1 h-1 accent-cyan-500" /><span class="text-white/60 text-xs w-8">{{ Math.round(env.sceneScale * 100) }}%</span></div>
          <div class="flex items-center gap-2"><span class="text-white/40 text-[10px] w-12">天空</span><input type="color" v-model="env.skyColor" class="h-6 flex-1 rounded" /></div>
        </section>

        <section class="pb-2 space-y-2">
          <div class="flex items-center justify-between"><span class="text-white/40 text-[10px]">标签</span><button class="toggle" :class="showLabels ? 'bg-cyan-500' : 'bg-white/15'" @click="emit('update:showLabels', !showLabels)"><div class="knob" :class="showLabels ? 'translate-x-4' : 'translate-x-0.5'" /></button></div>
          <div class="flex items-center justify-between"><span class="text-white/40 text-[10px]">网格</span><button class="toggle" :class="showGrid ? 'bg-cyan-500' : 'bg-white/15'" @click="emit('update:showGrid', !showGrid)"><div class="knob" :class="showGrid ? 'translate-x-4' : 'translate-x-0.5'" /></button></div>
          <div class="flex items-center gap-2"><span class="text-white/40 text-[10px] w-12">地面</span><input type="range" v-model.number="env.groundOpacity" min="0" max="1" step="0.1" class="flex-1 h-1 accent-cyan-500" /></div>
          <div class="flex items-center gap-2"><span class="text-white/40 text-[10px] w-12">高度</span><input type="range" v-model.number="env.groundHeight" min="-2" max="2" step="0.1" class="flex-1 h-1 accent-cyan-500" /></div>
        </section>
      </template>

      <button class="w-full h-7 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20" @click="emit('reset-view')">重置视角</button>
      <button class="w-full h-7 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30" @click="emit('save')">保存</button>
    </div>
  </div>
</template>

<style scoped>
.field, .input-field { height: 24px; border-radius: 6px; border: 1px solid rgb(255 255 255 / 0.1); background: rgb(255 255 255 / 0.05); padding: 0 4px; color: rgb(255 255 255 / 0.65); font-size: 12px; outline: none; }
.input-field { height: 28px; padding: 0 8px; }
.toggle { position: relative; width: 36px; height: 20px; border-radius: 999px; transition: background-color 0.2s; }
.knob { position: absolute; top: 2px; width: 16px; height: 16px; border-radius: 999px; background: white; transition: transform 0.2s; }
</style>
