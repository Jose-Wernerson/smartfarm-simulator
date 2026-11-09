import { describe, expect, it } from 'vitest'
import { run, world } from './helpers'
import { runScenario, SCENARIOS } from '../scenarios'
import { cfg } from './helpers'

describe('Determinismo', () => {
  it('mesma configuração e semente produzem estado idêntico', () => {
    const a = run(world({ mode: 'smart', preset: 'drought' }), 8)
    const b = run(world({ mode: 'smart', preset: 'drought' }), 8)
    expect(a.stats).toEqual(b.stats)
    expect(a.zones.map((z) => z.theta)).toEqual(b.zones.map((z) => z.theta))
    expect(a.sensors.map((s) => s.value)).toEqual(b.sensors.map((s) => s.value))
    expect(a.alerts.map((x) => x.key)).toEqual(b.alerts.map((x) => x.key))
  })

  it('sementes diferentes alteram apenas ruído de sensores/bateria, não a física do clima', () => {
    const a = run(world({ mode: 'timer', seed: 1 }), 3)
    const b = run(world({ mode: 'timer', seed: 2 }), 3)
    expect(a.wx).toEqual(b.wx)
    expect(a.stats.withdrawnL).toBeCloseTo(b.stats.withdrawnL, 6) // timer não usa sensores
  })

  it('cenários repetidos reproduzem os mesmos resultados', () => {
    const r1 = runScenario(SCENARIOS[3], cfg(), 7)
    const r2 = runScenario(SCENARIOS[3], cfg(), 7)
    expect(r1).toEqual(r2)
  })
})
