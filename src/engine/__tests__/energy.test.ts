import { describe, expect, it } from 'vitest'
import { step } from '../sim'
import { run, sum, world } from './helpers'

describe('Energia', () => {
  it('kWh acumulado = integral da potência de carga no tempo', () => {
    const w = world({ mode: 'timer' })
    let integral = 0
    run(w, 10, () => (integral += w.energy.loadKw * (5 / 60)))
    expect(w.stats.kWh).toBeCloseTo(integral, 6)
  })

  it('potência da bomba segue Q·H/(367·η) com H = pressão × 10,2 m', () => {
    const w = world({ mode: 'manual' })
    w.pump.cmd = true
    w.zones.forEach((z) => (z.valveCmd = true))
    step(w, 5)
    expect(w.pump.on).toBe(true)
    const Q = w.pump.flowLph / 1000 // m³/h
    const H = w.pump.pressure * 10.2
    const qr = w.pump.flowLph / w.cfg.pumpLph
    const eta = Math.max(0.35, w.cfg.pumpEta * (1 - 0.8 * (qr - 0.85) ** 2))
    expect(w.pump.powerKw).toBeCloseTo((Q * H) / (367 * eta), 9)
    expect(w.pump.powerKw).toBeGreaterThan(0)
  })

  it('energia da bomba = integral(potência) e é consistente com as horas de funcionamento', () => {
    const w = world({ mode: 'timer' })
    let pumpKwh = 0
    run(w, 10, () => (pumpKwh += w.pump.powerKw * (5 / 60)))
    const hours = w.stats.pumpMin / 60
    expect(hours).toBeCloseTo((10 * w.cfg.timerDurMin) / 60, 0)
    const avgKw = pumpKwh / hours
    expect(avgKw).toBeGreaterThan(0.5)
    expect(avgKw).toBeLessThan(6)
    expect(w.stats.kWh).toBeGreaterThan(pumpKwh) // carga base (controlador, gateway, sensores) soma
  })

  it('sem bomba funcionando o consumo é apenas a carga base, constante e pequena', () => {
    const w = world({ mode: 'manual' })
    run(w, 2)
    expect(w.pump.powerKw).toBe(0)
    expect(w.energy.loadKw).toBeGreaterThan(0.05)
    expect(w.energy.loadKw).toBeLessThan(0.15)
    expect(w.stats.kWh).toBeCloseTo(w.energy.loadKw * 48, 0)
  })

  it('solar + rede = total consumido; solar não excede geração nem carga', () => {
    const w = world({ mode: 'timer', panelsKwp: 3, timerStartH: 11 })
    run(w, 3, () => {
      expect(w.energy.gridKw).toBeGreaterThanOrEqual(-1e-12)
      expect(w.energy.loadKw - w.energy.gridKw).toBeLessThanOrEqual(w.energy.solarKw + 1e-12)
    })
    expect(w.stats.solarKWh + w.stats.gridKWh).toBeCloseTo(w.stats.kWh, 6)
    expect(w.stats.solarKWh).toBeGreaterThan(0)
  })

  it('falha elétrica zera carga e bomba', () => {
    const w = world({ mode: 'timer', panelsKwp: 3 })
    w.faults.power = true
    run(w, 1)
    expect(w.stats.kWh).toBe(0)
    expect(w.stats.pumpMin).toBe(0)
    expect(sum(w.zones.map((z) => z.appliedL))).toBe(0)
  })
})
