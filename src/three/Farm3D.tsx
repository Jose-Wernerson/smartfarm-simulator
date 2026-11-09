import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { getWorld, useSim } from '../store/sim'
import { STAGES, SOILS, clamp, stageIndex } from '../engine/params'
import type { SensorState } from '../engine/types'

const dummy = new THREE.Object3D()
const col = new THREE.Color()

/* ---------------- Céu, luz e clima ---------------- */
function Environment() {
  const { scene } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const bg = useMemo(() => new THREE.Color('#87b8e8'), [])
  useFrame(() => {
    const w = getWorld()
    const h = w.wx.hour
    const a = (Math.PI * (h - 6)) / 12
    const elev = Math.sin(a)
    const day = clamp(elev * 2.2 + 0.1, 0, 1)
    const cloud = w.wx.cloud
    if (sun.current) {
      sun.current.position.set(-Math.cos(a) * 90, Math.max(8, elev * 100), 40)
      sun.current.intensity = day * (1.7 - cloud * 1.0)
      sun.current.color.set(elev < 0.25 ? '#ffc58a' : '#fff3dc')
    }
    if (hemi.current) hemi.current.intensity = 0.5 + day * (0.75 - cloud * 0.25)
    const dayCol = col.set('#7fb4e6').lerp(new THREE.Color('#9aa7b3'), cloud * 0.7)
    bg.set('#0b1630').lerp(dayCol, day)
    if (elev > -0.1 && elev < 0.25) bg.lerp(new THREE.Color('#f0a070'), 0.35 * (1 - Math.abs(elev - 0.07) / 0.2))
    scene.background = bg
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(bg)
  })
  return (
    <>
      <fog attach="fog" args={['#87b8e8', 140, 340]} />
      <hemisphereLight ref={hemi} args={['#cfe6ff', '#4a3a2a', 0.8]} />
      <directionalLight ref={sun} castShadow intensity={1.5} shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} shadow-camera-far={300} shadow-bias={-0.0004} />
    </>
  )
}

function Clouds() {
  const g = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const items = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 70 - 70 + Math.sin(i) * 20, z: Math.floor(i / 3) * 60 - 60, y: 55 + (i % 4) * 4, s: 14 + (i % 3) * 5 })), [])
  useFrame((st) => {
    const w = getWorld()
    if (g.current) g.current.position.x = Math.sin(st.clock.elapsedTime * 0.03) * 30
    const op = clamp(w.wx.cloud * 0.95, 0, 0.9)
    mats.current.forEach((m) => {
      if (!m) return
      m.opacity = op
      m.color.set(w.wx.rain > 0.1 ? '#6d7580' : '#ffffff')
    })
  })
  return (
    <group ref={g}>
      {items.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.3, c.s * 0.7]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m }} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function Rain() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 900
  const seeds = useMemo(() => Array.from({ length: N }, () => [Math.random() * 160 - 80, Math.random(), Math.random() * 120 - 60]), [])
  useFrame((st) => {
    const m = ref.current
    if (!m) return
    const r = getWorld().wx.rain
    const n = r > 0.05 ? Math.min(N, Math.floor(150 + r * 45)) : 0
    m.count = n
    const t = st.clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const s = seeds[i]
      dummy.position.set(s[0], 40 - (((s[1] + t * 1.3) % 1) * 40), s[2])
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[0.04, 1.3, 0.04]} />
      <meshBasicMaterial color="#aecbf0" transparent opacity={0.55} />
    </instancedMesh>
  )
}

/* ---------------- Terreno e zonas ---------------- */
function Ground() {
  const w0 = getWorld()
  const { W, L, zoneRects } = w0.layout
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const rev = useSim((s) => s.rev)
  void rev
  const layers = useSim((s) => s.layers)
  const select = useSim((s) => s.select)
  const dry = useMemo(() => new THREE.Color('#9a6b3f'), [])
  const wet = useMemo(() => new THREE.Color('#3b2616'), [])
  useFrame(() => {
    const w = getWorld()
    const soil = SOILS[w.cfg.soil]
    w.zones.forEach((z, i) => {
      const m = mats.current[i]
      if (!m) return
      const pct = clamp((z.theta - soil.thetaWP) / (soil.thetaS - soil.thetaWP), 0, 1)
      m.color.copy(dry).lerp(wet, pct)
    })
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[-8, -0.06, 0]} receiveShadow>
        <planeGeometry args={[W + 140, L + 120]} />
        <meshStandardMaterial color="#5f8f45" roughness={1} />
      </mesh>
      {zoneRects.map((r, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[(r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2]} receiveShadow onClick={(e) => { e.stopPropagation(); select({ kind: 'zone', id: String(i) }) }}>
          <planeGeometry args={[r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2]} />
          <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m }} color="#7a5230" roughness={1} />
        </mesh>
      ))}
      {/* carreador central */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, 0]} receiveShadow>
        <planeGeometry args={[W, 3]} />
        <meshStandardMaterial color="#a89572" roughness={1} />
      </mesh>
      {layers.zones && <ZoneOverlay />}
    </group>
  )
}

function ZoneOverlay() {
  const { zoneRects } = getWorld().layout
  const rev = useSim((s) => s.rev)
  void rev
  const w = getWorld()
  const soil = SOILS[w.cfg.soil]
  const colors = ['#4aa3ff', '#4ad2a0', '#ffc84a', '#ff8a5a']
  return (
    <>
      {zoneRects.map((r, i) => {
        const pct = (w.zones[i].theta / soil.thetaS) * 100
        const c = pct < w.cfg.threshold ? '#ff5a4a' : pct < 60 ? '#ffc84a' : pct < w.cfg.blockAbove ? '#4ad27a' : '#4a8cff'
        return (
          <group key={i} position={[(r.x0 + r.x1) / 2, 0.06, (r.z0 + r.z1) / 2]}>
            <mesh rotation-x={-Math.PI / 2}>
              <planeGeometry args={[r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2]} />
              <meshBasicMaterial color={c} transparent opacity={0.22} depthWrite={false} />
            </mesh>
            <lineSegments rotation-x={-Math.PI / 2}>
              <edgesGeometry args={[new THREE.PlaneGeometry(r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2)]} />
              <lineBasicMaterial color={colors[i]} />
            </lineSegments>
            <Html center distanceFactor={110} position={[0, 0.5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="zone-tag" style={{ borderColor: colors[i] }}>
                Setor {w.zones[i].name} · {pct.toFixed(0)}%
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

/* ---------------- Plantas e treliças ---------------- */
function Plants() {
  const w0 = getWorld()
  const sites = w0.layout.plants
  const N = sites.length
  const leaf = useRef<THREE.InstancedMesh>(null)
  const stem = useRef<THREE.InstancedMesh>(null)
  const fruit = useRef<THREE.InstancedMesh>(null)
  const flower = useRef<THREE.InstancedMesh>(null)
  const select = useSim((s) => s.select)
  const timer = useRef(0)

  useFrame((_, dt) => {
    timer.current -= dt
    if (timer.current > 0) return
    timer.current = 0.5
    const w = getWorld()
    const L = leaf.current, S = stem.current, F = fruit.current, Fl = flower.current
    if (!L || !S || !F || !Fl) return
    for (let i = 0; i < N; i++) {
      const p = sites[i]
      const z = w.zones[p.zone]
      const dev = clamp(z.dev + p.off, 0, 100)
      const si = stageIndex(dev)
      const g = clamp(0.18 + dev / 45, 0.18, 1)
      // haste
      dummy.position.set(p.x, 0.55 * g, p.z)
      dummy.scale.set(1, g, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      S.setMatrixAt(i, dummy.matrix)
      // folhagem: 3 blocos por planta
      for (let k = 0; k < 3; k++) {
        const hk = 0.45 + k * 0.5
        dummy.position.set(p.x + (k - 1) * 0.1, hk * g + 0.15, p.z)
        const sc = g * (0.55 + 0.25 * (k === 1 ? 1 : 0.7))
        dummy.scale.set(sc * 0.9, sc * 0.55, sc * 1.05)
        dummy.rotation.set(0, p.off + k, 0)
        dummy.updateMatrix()
        L.setMatrixAt(i * 3 + k, dummy.matrix)
        const ks = z.ks
        const base = col.set(STAGES[si].color)
        if (ks < 0.9) base.lerp(col.clone().set(ks < 0.5 ? '#8a5a2b' : '#c8c04a'), clamp((0.9 - ks) * 1.6, 0, 1))
        if (z.theta / SOILS[w.cfg.soil].thetaS > 0.9) base.lerp(new THREE.Color('#9aa84a'), 0.5)
        L.setColorAt(i * 3 + k, base)
      }
      // frutos / flores
      const fr = si >= 4 ? 0.13 + (si === 5 ? 0.04 : 0) : 0
      const fl = si === 3 ? 0.1 : 0
      for (let k = 0; k < 2; k++) {
        dummy.rotation.set(0, 0, 0)
        dummy.position.set(p.x + (k ? 0.25 : -0.25), 1.05 * g, p.z + (k ? 0.2 : -0.2))
        dummy.scale.setScalar(Math.max(0.0001, fr))
        dummy.updateMatrix()
        F.setMatrixAt(i * 2 + k, dummy.matrix)
        F.setColorAt(i * 2 + k, col.set(si === 5 ? '#e3b21a' : '#6aa83a'))
        dummy.position.set(p.x + (k ? 0.3 : -0.3), 1.45 * g, p.z)
        dummy.scale.setScalar(Math.max(0.0001, fl))
        dummy.updateMatrix()
        Fl.setMatrixAt(i * 2 + k, dummy.matrix)
      }
    }
    for (const m of [L, S, F, Fl]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh ref={stem} args={[undefined, undefined, N]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.4, 6]} />
        <meshStandardMaterial color="#6b4a2a" />
      </instancedMesh>
      <instancedMesh ref={leaf} args={[undefined, undefined, N * 3]} frustumCulled={false} castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) select({ kind: 'plant', id: String(Math.floor(e.instanceId / 3)) }) }}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={fruit} args={[undefined, undefined, N * 2]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={flower} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial color="#c9a0ec" emissive="#6a3a9a" emissiveIntensity={0.3} />
      </instancedMesh>
    </group>
  )
}

function Trellis() {
  const { posts, rowX, L, ppr } = getWorld().layout
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const pts: number[] = []
    const half = L / 2 - 0.5
    for (const x of rowX) for (const y of [2.1, 1.7]) pts.push(x, y, -half, x, y, half)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [rowX, L])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    posts.forEach((p, i) => {
      dummy.position.set(p.x, 1.15, p.z)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [posts])
  void ppr
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 2.3, 6]} />
        <meshStandardMaterial color="#8d6b45" />
      </instancedMesh>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color="#d8dde2" />
      </lineSegments>
    </group>
  )
}

/* ---------------- Hidráulica ---------------- */
function Pipes() {
  const { pipes } = getWorld().layout
  return (
    <group>
      {pipes.map((p) => {
        const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1]
        const len = Math.hypot(dx, dz)
        const r = p.kind === 'main' || p.kind === 'trunk' ? 0.16 : p.kind === 'lateral' ? 0.035 : 0.09
        return (
          <mesh key={p.id} position={[(p.a[0] + p.b[0]) / 2, p.y, (p.a[1] + p.b[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), Math.PI / 2]} castShadow>
            <cylinderGeometry args={[r, r, len, 8]} />
            <meshStandardMaterial color={p.kind === 'lateral' ? '#222' : '#2d4b66'} roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

function FlowPackets() {
  const { pipes } = getWorld().layout
  const ref = useRef<THREE.InstancedMesh>(null)
  const layers = useSim((s) => s.layers)
  const packets = useMemo(() => {
    const out: { seg: number; k: number; n: number }[] = []
    pipes.forEach((p, si) => {
      const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])
      const n = Math.max(1, Math.ceil(len / (p.kind === 'lateral' ? 3.5 : 2.2)))
      for (let k = 0; k < n; k++) out.push({ seg: si, k, n })
    })
    return out
  }, [pipes])
  useFrame((st) => {
    const m = ref.current
    if (!m) return
    const w = getWorld()
    const t = st.clock.elapsedTime
    const active = pipes.map((p) => w.pump.on && p.zones.some((zi) => w.zones[zi].flowLph > 1))
    packets.forEach((pk, i) => {
      const p = pipes[pk.seg]
      if (!active[pk.seg] || !layers.flow) {
        dummy.scale.setScalar(0)
      } else {
        const f = (pk.k / pk.n + t * 0.35) % 1
        const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1]
        dummy.position.set(p.a[0] + dx * f, p.y + 0.02, p.a[1] + dz * f)
        const big = p.kind === 'main' || p.kind === 'trunk'
        dummy.scale.set(big ? 0.34 : 0.14, big ? 0.34 : 0.14, big ? 0.34 : 0.14)
        dummy.rotation.set(0, 0, 0)
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, packets.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#5cc8ff" />
    </instancedMesh>
  )
}

function Emitters() {
  const { emitters } = getWorld().layout
  const base = useRef<THREE.InstancedMesh>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  const N = emitters.length
  useEffect(() => {
    const m = base.current
    if (!m) return
    emitters.forEach((e, i) => {
      dummy.position.set(e.x, 0.14, e.z)
      dummy.scale.setScalar(1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [emitters])
  useFrame((st) => {
    const m = drops.current
    if (!m) return
    const w = getWorld()
    const t = st.clock.elapsedTime
    emitters.forEach((e, i) => {
      const z = w.zones[e.zone]
      const on = w.pump.on && z.flowLph > 1
      if (!on) dummy.scale.setScalar(0)
      else {
        const f = (t * 1.6 + (i % 7) * 0.31) % 1
        dummy.position.set(e.x, 0.45 - f * 0.4, e.z)
        dummy.scale.setScalar(0.05 * (1 - f * 0.4))
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={base} args={[undefined, undefined, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 6]} />
        <meshStandardMaterial color="#111" />
      </instancedMesh>
      <instancedMesh ref={drops} args={[undefined, undefined, N]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial color="#7fd4ff" />
      </instancedMesh>
    </>
  )
}

function Valves() {
  const { valves } = getWorld().layout
  const refs = useRef<THREE.MeshStandardMaterial[]>([])
  useFrame(() => {
    const w = getWorld()
    valves.forEach((v, i) => {
      const m = refs.current[i]
      if (!m) return
      m.color.set(w.zones[v.zone].valveOpen ? '#24c55a' : '#d23a3a')
      m.emissive.set(w.zones[v.zone].valveOpen ? '#0a4a20' : '#3a0a0a')
    })
  })
  return (
    <>
      {valves.map((v, i) => (
        <mesh key={i} position={[v.x, 0.35, v.z]} castShadow>
          <boxGeometry args={[0.55, 0.5, 0.55]} />
          <meshStandardMaterial ref={(m) => { if (m) refs.current[i] = m }} color="#d23a3a" />
        </mesh>
      ))}
    </>
  )
}

function TankAndPump() {
  const { tank, pump } = getWorld().layout
  const water = useRef<THREE.Mesh>(null)
  const led = useRef<THREE.MeshStandardMaterial>(null)
  const fan = useRef<THREE.Mesh>(null)
  const select = useSim((s) => s.select)
  useFrame((_, dt) => {
    const w = getWorld()
    const f = clamp(w.reservoir.L / w.reservoir.cap, 0.001, 1)
    if (water.current) {
      water.current.scale.y = f
      water.current.position.y = (tank.h * f) / 2 + 0.05
    }
    if (led.current) {
      const c = w.faults.pumpFailure ? '#ff3030' : w.pump.on ? '#22e060' : w.faults.power ? '#444' : '#e6b422'
      led.current.color.set(c)
      led.current.emissive.set(c)
    }
    if (fan.current && w.pump.on) fan.current.rotation.x += dt * 14
  })
  return (
    <group>
      <group position={[tank.x, 0, tank.z]} onClick={(e) => { e.stopPropagation(); select({ kind: 'tank', id: 'tank' }) }}>
        <mesh position={[0, tank.h / 2, 0]} castShadow>
          <cylinderGeometry args={[tank.r, tank.r, tank.h, 32, 1, true]} />
          <meshStandardMaterial color="#cfd8df" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={water} position={[0, tank.h / 2, 0]}>
          <cylinderGeometry args={[tank.r - 0.08, tank.r - 0.08, tank.h - 0.1, 32]} />
          <meshStandardMaterial color="#2f8fe0" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[tank.r + 0.1, tank.r + 0.1, 0.12, 32]} />
          <meshStandardMaterial color="#6b7077" />
        </mesh>
        <mesh position={[0, tank.h + 0.05, 0]}>
          <cylinderGeometry args={[tank.r + 0.08, tank.r + 0.08, 0.1, 32]} />
          <meshStandardMaterial color="#8a9199" />
        </mesh>
      </group>
      <group position={[pump.x, 0, pump.z]} onClick={(e) => { e.stopPropagation(); select({ kind: 'pump', id: 'pump' }) }}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[2.2, 1.4, 1.8]} />
          <meshStandardMaterial color="#3d6fa8" />
        </mesh>
        <mesh ref={fan} position={[0, 0.8, 1.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.1, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0.6, 1.6, 0]}>
          <sphereGeometry args={[0.18, 12, 8]} />
          <meshStandardMaterial ref={led} color="#e6b422" emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  )
}

function Station() {
  const { station, panels } = getWorld().layout
  const cups = useRef<THREE.Group>(null)
  const rev = useSim((s) => s.rev)
  void rev
  const kwp = getWorld().cfg.panelsKwp
  useFrame((_, dt) => {
    if (cups.current) cups.current.rotation.y += dt * (1 + getWorld().wx.wind * 2)
  })
  const nPanels = Math.min(12, Math.ceil(kwp / 0.4))
  return (
    <group>
      <group position={[station.x, 0, station.z]}>
        <mesh position={[0, 2, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 4, 8]} />
          <meshStandardMaterial color="#c9ced3" />
        </mesh>
        <group ref={cups} position={[0, 4.1, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.45, 0, Math.sin((i * Math.PI * 2) / 3) * 0.45]}>
              <sphereGeometry args={[0.13, 8, 6]} />
              <meshStandardMaterial color="#f0f0f0" />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 1.3, 0.3]} castShadow>
          <boxGeometry args={[0.5, 0.6, 0.3]} />
          <meshStandardMaterial color="#e8eaec" />
        </mesh>
        <mesh position={[0.9, 0.5, 0.6]}>
          <cylinderGeometry args={[0.2, 0.15, 0.7, 10]} />
          <meshStandardMaterial color="#9fb4c4" transparent opacity={0.7} />
        </mesh>
      </group>
      {Array.from({ length: nPanels }, (_, i) => (
        <mesh key={i} position={[panels.x + (i % 4) * 2.2, 0.9, panels.z + Math.floor(i / 4) * 1.6]} rotation={[-0.6, 0, 0]} castShadow>
          <boxGeometry args={[2, 0.06, 1.3]} />
          <meshStandardMaterial color="#1b2f5e" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- Sensores ---------------- */
function SensorMarker({ s }: { s: SensorState }) {
  const sel = useSim((st) => st.selected)
  const select = useSim((st) => st.select)
  const showLabels = useSim((st) => st.layers.sensors)
  const rev = useSim((st) => st.rev)
  void rev
  const selected = sel?.kind === 'sensor' && sel.id === s.id
  const c = s.status === 'offline' ? '#8a8f95' : s.suspect ? '#ff9a2a' : s.status === 'lowbat' ? '#e6d02a' : '#2ee6a0'
  if (!showLabels && !selected) return null
  const y = s.type === 'soilMoisture' || s.type === 'soilTemp' ? 0 : 0
  return (
    <group position={[s.pos[0], y, s.pos[1]]} onClick={(e) => { e.stopPropagation(); select({ kind: 'sensor', id: s.id }) }}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[selected ? 0.34 : 0.24, 12, 10]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={selected ? 1.6 : 0.8} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.8, 1, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      <Html center distanceFactor={70} position={[0, 1.8, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`sensor-tag ${selected ? 'sel' : ''}`}>
          {s.id} · {s.value === null ? '—' : s.value.toFixed(s.type === 'flow' ? 0 : 1)}
          <small>{s.unit}</small>
        </div>
      </Html>
    </group>
  )
}

function Sensors() {
  const sensors = getWorld().sensors
  return <>{sensors.map((s) => <SensorMarker key={s.id} s={s} />)}</>
}

function SelectedPlantRing() {
  const sel = useSim((s) => s.selected)
  const ref = useRef<THREE.Mesh>(null)
  useFrame((st) => {
    if (!ref.current || sel?.kind !== 'plant') return
    const p = getWorld().layout.plants[Number(sel.id)]
    if (!p) return
    ref.current.position.set(p.x, 0.08, p.z)
    ref.current.scale.setScalar(1 + Math.sin(st.clock.elapsedTime * 4) * 0.08)
  })
  if (sel?.kind !== 'plant') return null
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.9, 1.1, 24]} />
      <meshBasicMaterial color="#fff36a" />
    </mesh>
  )
}

/* ---------------- Câmera ---------------- */
function CameraRig() {
  const view = useSim((s) => s.view)
  const ctl = useRef<OrbitImpl>(null)
  const { camera } = useThree()
  const target = useRef<THREE.Vector3 | null>(null)
  useEffect(() => {
    const { W, L } = getWorld().layout
    const R = Math.max(W, L)
    target.current = view === 'top' ? new THREE.Vector3(-6, R * 1.25, 0.01) : new THREE.Vector3(-W * 0.7, R * 0.85, L * 0.95)
  }, [view])
  useFrame(() => {
    if (!target.current) return
    camera.position.lerp(target.current, 0.08)
    if (ctl.current) ctl.current.target.lerp(new THREE.Vector3(-6, 0, 0), 0.1)
    if (camera.position.distanceTo(target.current) < 0.3) target.current = null
  })
  return <OrbitControls ref={ctl as never} makeDefault maxPolarAngle={Math.PI / 2.05} minDistance={10} maxDistance={220} />
}

export default function Farm3D() {
  const layoutKey = useSim((s) => {
    const w = getWorld()
    return `${w.layout.rows}-${w.layout.ppr}-${w.cfg.areaM2}-${w.cfg.spacing}-${w.t0}-${s.running && 0}`
  })
  const reset = useSim((s) => s.reset)
  void reset
  const setLoading = useSim((s) => s.setLoading)
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [-60, 55, 90], fov: 45, near: 0.5, far: 600 }}
      onCreated={() => setLoading(false)}
      onPointerMissed={() => useSim.getState().select(null)}
    >
      <Environment />
      <Clouds />
      <Rain />
      <group key={layoutKey}>
        <Ground />
        <Trellis />
        <Plants />
        <Pipes />
        <FlowPackets />
        <Emitters />
        <Valves />
        <TankAndPump />
        <Station />
        <Sensors />
        <SelectedPlantRing />
      </group>
      <CameraRig />
    </Canvas>
  )
}
