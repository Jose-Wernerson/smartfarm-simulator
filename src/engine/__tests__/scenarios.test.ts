import { describe, expect, it } from 'vitest'
import { SCENARIOS, runAll, runScenario, savingVs } from '../scenarios'
import { cfg, rainFor, run, sum, world } from './helpers'
import { weatherAt } from '../climate'

describe('Cinco cenários — estratégias realmente distintas', () => {
  it('cada cenário usa um modo de controle diferente', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(SCENARIOS.map((s) => s.mode)).size).toBe(5)
    expect(SCENARIOS.map((s) => s.mode)).toEqual(['operator', 'timer', 'auto', 'smart', 'optimized'])
  })

  it('o clima é idêntico para todos os cenários no mesmo instante', () => {
    const base = cfg({ preset: 'drought' })
    const ws = SCENARIOS.map((s) => world({ ...base, mode: s.mode }))
    ws.forEach((w) => run(w, 3))
    for (const w of ws) expect(w.wx).toEqual(ws[0].wx)
    expect(weatherAt(5000, base)).toEqual(weatherAt(5000, { ...base, mode: 'manual' }))
  })

  it('sem chuva: convencional e programada irrigam em calendário fixo; sensores só quando a umidade exige', () => {
    const days = 14
    const r = runAll(cfg(), days)
    const timer = r[1]
    // programada: 1 partida por dia (+1 se a partida coincide com o instante final do período)
    expect(timer.irrigations).toBeGreaterThanOrEqual(days)
    expect(timer.irrigations).toBeLessThanOrEqual(days + 1)
    // operador: um evento a cada 2 dias
    expect(r[0].irrigations).toBeGreaterThanOrEqual(Math.ceil(days / 2))
    expect(r[0].irrigations).toBeLessThanOrEqual(Math.ceil(days / 2) + 1)
    for (const i of [2, 3, 4]) expect(r[i].irrigations).toBeLessThan(timer.irrigations)
    for (const x of r) expect(x.withdrawnL).toBeGreaterThan(0)
  })

  it('analítico: programada retira exatamente duração × vazão × dias; operador retira 15 mm × área por evento', () => {
    const days = 10
    const r = runAll(cfg(), days)
    const w = world()
    const area = sum(w.zones.map((z) => z.areaM2))
    expect(r[1].withdrawnL).toBeCloseTo((cfg().timerDurMin / 60) * cfg().pumpLph * days, 0)
    // o operador para ao atingir o volume; a quantização é de no máximo 1 passo (5 min de bomba) por evento
    const stepL = (cfg().pumpLph * 5) / 60
    const nominal = 15 * area * r[0].irrigations
    expect(r[0].withdrawnL).toBeGreaterThanOrEqual(nominal)
    expect(r[0].withdrawnL - nominal).toBeLessThanOrEqual(r[0].irrigations * stepL)
  })

  it('em chuva, só os cenários com sensores deixam de irrigar; convencional e programada irrigam mesmo assim', () => {
    const r = runAll(cfg({ preset: 'lightRain', rainMmH: 3 }), 14)
    expect(r[0].withdrawnL).toBeGreaterThan(0)
    expect(r[1].withdrawnL).toBeGreaterThan(0)
    for (const i of [2, 3, 4]) expect(r[i].withdrawnL).toBe(0)
  })

  it('o parâmetro de duração é respeitado pelo motor (dias, série diária e consumo crescem com ele)', () => {
    const prev = { w: 0 }
    for (const d of [3, 7, 14]) {
      const r = runScenario(SCENARIOS[1], cfg(), d)
      expect(r.days).toBe(d)
      expect(r.daily.length).toBe(d)
      expect(r.series[r.series.length - 1].t).toBeCloseTo(d, 5)
      expect(r.withdrawnL).toBeGreaterThan(prev.w)
      prev.w = r.withdrawnL
    }
  })

  it('economia é calculada dos resultados, nunca fixa', () => {
    const r = runAll(cfg(), 7)
    for (const x of r) {
      expect(savingVs(r[0], x)).toBeCloseTo(((r[0].withdrawnL - x.withdrawnL) / r[0].withdrawnL) * 100, 9)
    }
    expect(savingVs(r[1], r[1])).toBe(0)
    const zero = { ...r[0], withdrawnL: 0 }
    expect(savingVs(zero, r[2])).toBe(0)
  })

  it('perdas e consumo: volume aplicado ao solo + perdas de irrigação ≤ água retirada (sem criar água)', () => {
    for (const preset of ['sunny', 'drought'] as const) {
      const r = runAll(cfg({ preset, rainMmH: rainFor(preset) }), 10)
      for (const x of r) expect(x.appliedL).toBeLessThanOrEqual(x.withdrawnL + 1e-6)
    }
  })

  it('cenários não são alterados por falhas do mundo interativo (execução headless usa mundo novo)', () => {
    const a = runScenario(SCENARIOS[3], cfg(), 5)
    const interactive = world({ mode: 'smart' })
    interactive.faults.pumpFailure = true
    const b = runScenario(SCENARIOS[3], cfg(), 5)
    expect(a).toEqual(b)
  })
})
