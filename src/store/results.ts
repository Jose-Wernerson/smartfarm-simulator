import { create } from 'zustand'
import type { ScenarioResult } from '../engine/scenarios'
import { runAll, scenarioSignature } from '../engine/scenarios'
import type { Config } from '../engine/types'

interface R {
  results: ScenarioResult[]
  /** Duração escolhida (dias): vive no store para sobreviver à troca de abas. */
  days: number
  /** Duração dos resultados exibidos (pode diferir de `days` até nova execução). */
  resultDays: number
  label: string
  signature: string | null
  running: boolean
  token: number
  setDays: (d: number) => void
  run: (cfg: Config, days: number, label: string) => void
  runNow: (cfg: Config, days: number, label: string) => void
  /** Limpa resultados se a configuração atual difere da usada para gerá-los. */
  invalidateIfStale: (cfg: Config) => void
  clear: () => void
}

export const useResults = create<R>((set, get) => ({
  results: [],
  days: 14,
  resultDays: 0,
  label: '',
  signature: null,
  running: false,
  token: 0,
  setDays: (days) => set({ days }),
  runNow: (cfg, days, label) => {
    set({ results: runAll(cfg, days), days, resultDays: days, label, signature: scenarioSignature(cfg), running: false })
  },
  run: (cfg, days, label) => {
    const token = get().token + 1
    set({ running: true, token, days })
    const snapshot = { ...cfg }
    setTimeout(() => {
      if (get().token !== token) return // configuração mudou durante o cálculo → descarta
      try {
        get().runNow(snapshot, days, label)
      } catch {
        set({ running: false })
      }
    }, 30)
  },
  invalidateIfStale: (cfg) => {
    const s = get()
    const stale = s.signature !== null && s.signature !== scenarioSignature(cfg)
    if (stale || s.running) set({ results: stale ? [] : s.results, signature: stale ? null : s.signature, resultDays: stale ? 0 : s.resultDays, running: false, token: s.token + 1 })
  },
  clear: () => set({ results: [], signature: null, resultDays: 0, running: false, token: get().token + 1 }),
}))
