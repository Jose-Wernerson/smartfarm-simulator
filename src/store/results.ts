import { create } from 'zustand'
import type { ScenarioResult } from '../engine/scenarios'
import { runAll } from '../engine/scenarios'
import type { Config } from '../engine/types'

interface R {
  results: ScenarioResult[]
  days: number
  label: string
  running: boolean
  run: (cfg: Config, days: number, label: string) => void
}

export const useResults = create<R>((set) => ({
  results: [],
  days: 14,
  label: '',
  running: false,
  run: (cfg, days, label) => {
    set({ running: true })
    setTimeout(() => {
      try {
        set({ results: runAll(cfg, days), days, label, running: false })
      } catch {
        set({ running: false })
      }
    }, 30)
  },
}))
