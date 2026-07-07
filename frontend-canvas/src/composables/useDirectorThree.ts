import { nextTick, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { DirectorCamera, DirectorCharacter, DirectorEnvironment, DirectorVec3, DirectorProp, DirectorJointAngles } from './directorState'
import { JOINTS } from './directorState'

function deg(v = 0) { return THREE.MathUtils.degToRad(v) }
function applyTransform(obj: THREE.Object3D, pos: DirectorVec3, rot: DirectorVec3, scl: DirectorVec3) {
  obj.position.set(pos.x, pos.y, pos.z)
  obj.rotation.set(deg(rot.x), deg(rot.y), deg(rot.z))
  obj.scale.set(scl.x, scl.y, scl.z)
}

const XBOT_URL = '/canvas/models/Xbot.glb'
let cachedXbot: { gltf: any } | null = null

async function ensureXbot(): Promise<any> {
  if (cachedXbot) return cachedXbot
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(XBOT_URL)
  cachedXbot = { gltf }
  return cachedXbot
}

export function useDirectorThree(options: {
  containerRef: Ref<HTMLDivElement | null>
  env: ComputedRef<DirectorEnvironment>
  characters: ComputedRef<DirectorCharacter[]>
  props: ComputedRef<DirectorProp[]>
  showLabels: Ref<boolean>
  showGrid: Ref<boolean>
}) {
  let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls

  let animId = 0, groundPlane: THREE.Mesh, gridHelper: THREE.GridHelper
  const sceneObjects = new Map<string, THREE.Group>()
  const loaded = ref(false)

  type GlbEntity = { id: string; group: THREE.Group; model: THREE.Group; boneMap: Map<string, THREE.Bone>; rest: Map<THREE.Bone, THREE.Quaternion>; color: string; cgMarker?: THREE.Group }

  async function initScene() {
    const el = options.containerRef.value
    if (!el) return
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000)
    camera.position.set(0, 12, 18)
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.LinearToneMapping
    renderer.toneMappingExposure = 1.2
    el.appendChild(renderer.domElement)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.set(0, 1, 0)

    groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8, transparent: true, opacity: options.env.value.groundOpacity }))
    groundPlane.rotation.x = -Math.PI / 2; groundPlane.receiveShadow = true; scene.add(groundPlane)
    gridHelper = new THREE.GridHelper(50, 50, 0x333355, 0x222244); scene.add(gridHelper)
    scene.add(new THREE.HemisphereLight(0x8899cc, 0x445566, 1.2))
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dl = new THREE.DirectionalLight(0xffffff, 3)
    dl.position.set(5, 15, 5); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048); scene.add(dl)

    applyEnvironment()
    loaded.value = true
    await updateAllSceneObjects()
    animate()
    window.addEventListener('resize', resizeRenderer)
  }

  function createLabel(text: string, color: string) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.roundRect(8, 8, 240, 48, 18); ctx.fill()
    ctx.fillStyle = color; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 32)
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }))
    s.scale.set(2, 0.5, 1); s.position.y = 3.2; s.renderOrder = 999
    return s
  }

  function createCGAxes(color: string): THREE.Group {
    const cg = new THREE.Group()
    const len = 0.6, rad = 0.04
    // One-direction axis: shaft from 0 to len + cone at len
    const makeAxis = (hex: number, dir: THREE.Vector3) => {
      const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.3, roughness: 0.4 })
      const g = new THREE.Group()
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 8), mat)
      shaft.position.copy(dir.clone().multiplyScalar(len / 2))
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      g.add(shaft)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad * 3, rad * 10, 8), mat)
      cone.position.copy(dir.clone().multiplyScalar(len))
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      g.add(cone)
      return g
    }
    // ground ring at foot
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.02, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })
    )
    ring.rotation.x = -Math.PI / 2
    cg.add(ring)
    cg.add(makeAxis(0xff3333, new THREE.Vector3(1, 0, 0)))
    cg.add(makeAxis(0x33ff33, new THREE.Vector3(0, 1, 0)))
    cg.add(makeAxis(0x3388ff, new THREE.Vector3(0, 0, 1)))
    return cg
  }

  async function createGlbCharacter(item: DirectorCharacter): Promise<GlbEntity> {
    const { gltf } = await ensureXbot()
    const group = new THREE.Group()
    const model = skClone(gltf.scene) as THREE.Group

    // Xbot default height is ~1.75 units, scale relative to that
    const defaultH = 1.75
    const targetH = item.height || defaultH
    const sf = targetH / defaultH
    model.scale.set(sf * (item.girth || 1), sf, sf * (item.girth || 1))

    // Floor: find the lowest point
    const bbox = new THREE.Box3().setFromObject(model)
    model.position.y -= bbox.min.y

    // Apply custom character color tint
    const tintColor = new THREE.Color(item.color)
    model.traverse((m: THREE.Object3D) => {
      const mesh = m as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false
        const orig = mesh.material as THREE.MeshStandardMaterial
        if (orig && orig.color) {
          const cloned = orig.clone()
          cloned.color.copy(tintColor).multiplyScalar(1.2)
          cloned.emissive?.set(tintColor).multiplyScalar(0.15)
          mesh.material = cloned
        }
      }
    })
    const boneMap = new Map<string, THREE.Bone>()
    const rest = new Map<THREE.Bone, THREE.Quaternion>()
    model.traverse((obj: THREE.Object3D) => {
      const bone = obj as THREE.Bone
      if (bone.isBone) {
        const norm = String(bone.name || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
        if (norm) boneMap.set(norm, bone)
        rest.set(bone, bone.quaternion.clone())
      }
    })

    group.add(model)
    const labelSprite = createLabel(`${item.label}`, item.color)
    labelSprite.position.y = targetH + 0.4; group.add(labelSprite)

    const cgGroup = createCGAxes(item.color)
    if (item.showCG) group.add(cgGroup)

    return { id: item.id, group, model, boneMap, rest, color: item.color, cgMarker: cgGroup }
  }

  function applyGlbPose(entity: GlbEntity, poseValues: DirectorJointAngles) {
    const boneToJoints = new Map<THREE.Bone, typeof JOINTS>()
    const missed: string[] = []
    for (const joint of JOINTS) {
      const norm = joint.bone.replace(/[^a-z0-9]/gi, '').toLowerCase()
      const bone = entity.boneMap.get(norm)
      if (bone) {
        if (!boneToJoints.has(bone)) boneToJoints.set(bone, [])
        boneToJoints.get(bone)!.push(joint)
      } else {
        missed.push(`${joint.key}→${joint.bone}(${norm})`)
      }
    }
    if (missed.length) console.warn('applyGlbPose missed bones:', missed)
    console.debug('boneToJoints keys:', [...boneToJoints.entries()].map(([b, j]) => `${b.name}←${j.map(x=>x.key).join(',')}`))
    const isArm = (j: typeof JOINTS) => j.length >= 2 && j.every(x => x.key.includes('Arm'))
    for (const [bone, joints] of boneToJoints.entries()) {
      const restQ = entity.rest.get(bone)
      if (restQ) bone.quaternion.copy(restQ)
      if (isArm(joints)) {
        // Arm: TE_MAN uses Euler ZXY for combined raise/straddle/twist
        const euler = new THREE.Euler(0, 0, 0, 'ZXY')
        for (const joint of joints) {
          let angle = Number(poseValues[joint.key] || 0)
          if (joint.key.includes('Fwd') || joint.key.includes('Twist')) angle = -angle
          euler[joint.axis] += deg(angle)
        }
        bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler))
      } else {
        for (const joint of joints) {
          const angle = -(Number(poseValues[joint.key] || 0))
          if (!angle) continue
          const axis = new THREE.Vector3(joint.axis === 'x' ? 1 : 0, joint.axis === 'y' ? 1 : 0, joint.axis === 'z' ? 1 : 0)
          bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, deg(angle)))
        }
      }
    }
  }

  async function addCharacter(item: DirectorCharacter) {
    try {
      const entity = await createGlbCharacter(item)
      applyGlbPose(entity, item.jointAngles)
      entity.group.name = `character:${item.id}`;
      (entity.group as any).__glbEntity = entity
      applyTransform(entity.group, item.position, item.rotation, item.scale)
      scene.add(entity.group); sceneObjects.set(entity.group.name, entity.group)
    } catch (e) {
      console.error('Failed to create character:', e)
    }
  }

  function addProp(item: DirectorProp) {
    const g = new THREE.Group()
    const c = new THREE.Color(item.color)
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1, roughness: 0.3 })
    let geo: THREE.BufferGeometry
    if (item.shape === 'sphere') geo = new THREE.SphereGeometry(0.6, 24, 24)
    else if (item.shape === 'cylinder') geo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 24)
    else geo = new THREE.BoxGeometry(1, 1, 1)
    g.add(new THREE.Mesh(geo, mat))
    const ls = createLabel(item.label, item.color); g.add(ls)
    g.name = `prop:${item.id}`; applyTransform(g, item.position, item.rotation, item.scale)
    scene.add(g); sceneObjects.set(g.name, g)
  }

  function disposeObject(obj: THREE.Object3D) {
    scene.remove(obj)
    obj.traverse((child: THREE.Object3D) => {
      const m = child as THREE.Mesh
      m.geometry?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(mt => mt.dispose())
      else mat?.dispose?.()
    })
  }

  async function updateAllSceneObjects() {
    if (!scene) return
    sceneObjects.forEach(disposeObject)
    sceneObjects.clear()
    await Promise.all([
      ...options.characters.value.filter(i => i.visible).map(item => addCharacter(item)),
      ...options.props.value.filter(i => i.visible).map(item => { addProp(item) }),
    ])
  }

  function syncCharacter(item: DirectorCharacter | null) {
    if (!item) return
    const obj = sceneObjects.get(`character:${item.id}`)
    if (!obj) return
    applyTransform(obj, item.position, item.rotation, item.scale)
    const entity = (obj as any).__glbEntity as GlbEntity | undefined
    if (entity) {
      // Extract body joint values, apply as group rotation (pivot at foot)
      const bodyX = item.jointAngles?.bodyX ?? 0
      const bodyY = item.jointAngles?.bodyY ?? 0
      const bodyZ = item.jointAngles?.bodyZ ?? 0
      const bonePose: Record<string, number> = {}
      for (const k of JOINTS) {
        const key = k.key as string
        if (key === 'bodyX' || key === 'bodyY' || key === 'bodyZ') continue
        bonePose[key] = item.jointAngles[key] ?? 0
      }
      applyGlbPose(entity, bonePose as DirectorJointAngles)
      // Body rotation around foot (group pivot)
      const bodyQ = new THREE.Quaternion()
      bodyQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg(bodyX)))
      bodyQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg(bodyY)))
      bodyQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg(bodyZ)))
      obj.quaternion.premultiply(bodyQ)
      if (entity.cgMarker) {
        entity.cgMarker.position.set(0, 0, 0)
        entity.cgMarker.visible = item.showCG ?? true
      }
      // Color change
      const lastColor = (entity.model as any).__lastColor as string | undefined
      if (lastColor !== item.color) {
        const tintColor = new THREE.Color(item.color)
        entity.model.traverse((m: THREE.Object3D) => {
          const mesh = m as THREE.Mesh
          if (mesh.isMesh) {
            const mat = mesh.material as THREE.MeshStandardMaterial
            if (mat && mat.color) mat.color.copy(tintColor).multiplyScalar(1.2)
          }
        });
        (entity.model as any).__lastColor = item.color
      }
      // Height/girth scaling
      const sf = (item.height || 1.75) / 1.75
      const girth = item.girth || 1
      entity.model.scale.set(sf * girth, sf, sf * girth)
      const bbox = new THREE.Box3().setFromObject(entity.model)
      entity.model.position.setY(-bbox.min.y)
    }
  }

  function syncProp(item: DirectorProp | null) {
    if (!item) return
    const obj = sceneObjects.get(`prop:${item.id}`)
    if (obj) applyTransform(obj, item.position, item.rotation, item.scale)
  }

  function removeObject(key: string) {
    const obj = sceneObjects.get(key)
    if (obj) disposeObject(obj)
    sceneObjects.delete(key)
  }

  function applyEnvironment() {
    if (!scene || !groundPlane) return
    scene.background = new THREE.Color(options.env.value.skyColor)
    scene.fog = new THREE.Fog(options.env.value.skyColor, 30, 150)
    groundPlane.visible = options.env.value.groundVisible
    groundPlane.position.y = options.env.value.groundHeight
    const s = options.env.value.sceneScale / 3
    groundPlane.scale.set(s, s, 1)
    ;(groundPlane.material as THREE.MeshStandardMaterial).opacity = options.env.value.groundOpacity
    gridHelper.visible = options.showGrid.value
    gridHelper.position.y = options.env.value.groundHeight + 0.002
  }

  function updateLabelVisibility() {}

  function setCameraPreset() {}

  function resizeRenderer() {
    const el = options.containerRef.value
    if (!el || !renderer || !camera) return
    camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  }


  let floorImageMesh: THREE.Mesh | null = null
  let floorImageUrl: string | null = null
  let floorScale = 3

  function setFloorTexture(url: string) {
    if (!scene || !groundPlane) return
    floorImageUrl = url
    _buildFloorImage()
  }

  function setFloorScale(s: number) {
    floorScale = s
    if (floorImageUrl) _buildFloorImage()
  }

  function _buildFloorImage() {
    if (!floorImageUrl || !scene) return
    const img = new Image()
    img.onload = () => {
      if (floorImageMesh) { scene.remove(floorImageMesh); floorImageMesh.geometry?.dispose(); (floorImageMesh.material as THREE.Material).dispose() }
      const w = floorScale
      const h = w * (img.naturalHeight / img.naturalWidth) || w
      const tex = new THREE.CanvasTexture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      const geo = new THREE.PlaneGeometry(w, h)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false, depthWrite: false, side: THREE.DoubleSide })
      floorImageMesh = new THREE.Mesh(geo, mat)
      floorImageMesh.rotation.x = -Math.PI / 2
      floorImageMesh.position.set(0, 0.005, 0)
      floorImageMesh.renderOrder = 1
      gridHelper.renderOrder = 2
      scene.add(floorImageMesh)
    }
    img.src = floorImageUrl
  }

  function removeFloorTexture() {
    if (!floorImageMesh || !scene) return
    scene.remove(floorImageMesh)
    floorImageMesh.geometry?.dispose(); (floorImageMesh.material as THREE.Material).dispose()
    floorImageMesh = null
    gridHelper.renderOrder = 0
  }

  function animate() {
    animId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }

  nextTick(initScene)
  onUnmounted(() => {
    window.removeEventListener('resize', resizeRenderer)
    if (animId) cancelAnimationFrame(animId)
    sceneObjects.forEach(disposeObject)
    renderer?.dispose(); controls?.dispose()
  })

  function captureThumbnail(): string {
    if (!renderer || !scene || !camera) return ''
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL('image/jpeg', 0.7)
  }

  return { loaded, updateAllSceneObjects, syncCharacter, syncProp, removeObject, applyEnvironment, updateLabelVisibility, setCameraPreset: () => {}, addCharacter, addProp, setFloorTexture, removeFloorTexture, setFloorScale, captureThumbnail, screenshot: () => '' }
}
