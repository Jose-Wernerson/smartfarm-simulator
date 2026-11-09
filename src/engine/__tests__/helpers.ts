import { DEFAULT_CONFIG, SOILS } from '../params'
import { createWorld, step } from '../sim'
import type { Config, World } from '../types'

export const cfg = (o: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...o })

/** Avança o mundo `days` dias em passos de 5 min; chama `onStep` após cada passo. */
export function run(w: World, days: number, onStep?: (w: World) => void): World {
  const end = w.t0 + days * 1440
  while (w.t < end) {
    step(w, 5)
    onStep?.(w)
  }
  return w
}

export const world = (o: Partial<Config> = {}) => createWorld(cfg(o))
export const soilOf = (w: World) => SOILS[w.cfg.soil]
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
/** Chuva por mm típica para cada preset nos testes. */
export const rainFor = (preset: string) => (preset === 'heavyRain' ? 16 : preset === 'lightRain' ? 3 : 0)
