import { create } from 'zustand'
import type { Config, World } from '../engine/types'
import { DEFAULT_CONFIG, SOILS } from '../engine/params'
import { PRESETS } from '../engine/climate'
import { advance, createWorld } from '../engine/sim'
import type { WeatherPreset } from '../engine/types'

export type Tab = '3d' | 'charts' | 'alerts' | 'scenarios' | 'faults' | 'reports' | 'phone' | 'demo'
export type Selected = { kind: 'sensor' | 'plant' | 'zone' | 'tank' | 'pump'; id: string } | null
export type ViewMode = 'persp' | 'top'

/** Parâmetros que alteram a geometria → reinício da simulação. */
const STRUCTURAL: (keyof Config)[] = ['areaM2', 'plants', 'spacing', 'startDev', 'startMoisture', 'seed', 'startHour']

let world: World = createWorld(DEFAULT_CONFIG)
export const getWorld = () => world

interface Store {
  rev: number
  running: boolean
  speed: number // segundos simulados por segundo real
  tab: Tab
  selected: Selected
  view: ViewMode
  layers: { zones: boolean; flow: boolean; sensors: boolean }
  leftOpen: boolean
  rightOpen: boolean
  error: string | null
  loading: boolean
  setTab: (t: Tab) => void
  select: (s: Selected) => void
  setView: (v: ViewMode) => void
  toggleLayer: (k: 'zones' | 'flow' | 'sensors') => void
  setPanel: (side: 'left' | 'right', open: boolean) => void
  setRunning: (r: boolean) => void
  setSpeed: (s: number) => void
  setConfig: (p: Partial<Config>) => void
  setPreset: (p: WeatherPreset) => void
  reset: () => void
  bump: () => void
  tick: (realDtSec: number) => void
  setLoading: (b: boolean) => void
  setError: (e: string | null) => void
}

export const useSim = create<Store>((set, get) => ({
  rev: 0,
  running: false,
  speed: 900,
  tab: '3d',
  selected: null,
  view: 'persp',
  layers: { zones: true, flow: true, sensors: true },
  leftOpen: false,
  rightOpen: false,
  error: null,
  loading: true,
  setTab: (tab) => set({ tab }),
  select: (selected) => set({ selected }),
  setView: (view) => set({ view }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setPanel: (side, open) => set(side === 'left' ? { leftOpen: open } : { rightOpen: open }),
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  bump: () => set((s) => ({ rev: s.rev + 1 })),
  setConfig: (p) => {
    const cfg = world.cfg
    const structural = Object.keys(p).some((k) => STRUCTURAL.includes(k as keyof Config)) || (p.reservoirL !== undefined && false)
    if (p.soil && p.soil !== cfg.soil && p.threshold === undefined) p = { ...p, threshold: SOILS[p.soil].suggestedThreshold }
    Object.assign(cfg, p)
    if (p.reservoirL !== undefined) {
      const frac = world.reservoir.L / world.reservoir.cap
      world.reservoir.cap = p.reservoirL
      world.reservoir.L = frac * p.reservoirL
    }
    if (structural) {
      world = createWorld({ ...cfg })
      set({ selected: null })
    }
    get().bump()
  },
  setPreset: (preset) => {
    Object.assign(world.cfg, { preset, rainMmH: PRESETS[preset].rainDefault })
    get().bump()
  },
  reset: () => {
    world = createWorld({ ...world.cfg })
    set({ selected: null, running: false })
    get().bump()
  },
  tick: (dt) => {
    try {
      const simMin = Math.min((get().speed * dt) / 60, 180)
      advance(world, simMin)
      get().bump()
    } catch (e) {
      set({ running: false, error: e instanceof Error ? e.message : String(e) })
    }
  },
}))

/** Substitui o mundo (usado pelo modo demonstração/restauração). */
export function replaceWorld(cfg: Config) {
  world = createWorld(cfg)
  useSim.getState().bump()
}
