import { describe, expect, it } from 'vitest'
import { createWorld, step } from '../sim'
import { run, soilOf, sum, world, cfg, rainFor } from './helpers'
import type { ControlMode, SoilType, WeatherPreset } from '../types'

const TOL_MM = 1e-6 // tolerância numérica do balanço por passo (mm)

/** Balanço hídrico do solo por passo: ΔW = chuva + irrigação aplicada − escoamento − ETc real − drenagem. */
function soilResiduals(c: ReturnType<typeof cfg>, days: number) {
  const w = createWorld(c)
  const Zr = c.rootDepthM * 1000
  const prev = w.zones.map((z) => ({ W: z.theta * Zr, d: z.drainMm, r: z.runoffMm, e: z.etcMm }))
  const W0 = sum(w.zones.map((z) => z.theta * Zr))
  let maxRes = 0
  let inTot = 0, etTot = 0, drTot = 0, roTot = 0
  run(w, days, () => {
    w.zones.forEach((z, i) => {
      const dtH = 5 / 60
      const irr = (z.flowLph * dtH * c.effDrip) / z.areaM2
      const rain = w.wx.rain * dtH
      const dW = z.theta * Zr - prev[i].W
      const expected = rain + irr - (z.runoffMm - prev[i].r) - (z.etcMm - prev[i].e) - (z.drainMm - prev[i].d)
      maxRes = Math.max(maxRes, Math.abs(dW - expected))
      inTot += rain + irr
      etTot += z.etcMm - prev[i].e
      drTot += z.drainMm - prev[i].d
      roTot += z.runoffMm - prev[i].r
      prev[i] = { W: z.theta * Zr, d: z.drainMm, r: z.runoffMm, e: z.etcMm }
    })
  })
  const W1 = sum(w.zones.map((z) => z.theta * Zr))
  return { maxRes, global: W1 - W0 - (inTot - etTot - drTot - roTot), W0, W1, inTot, etTot, drTot, roTot, w }
}

describe('Balanço hídrico do solo (conservação de massa)', () => {
  const presets: WeatherPreset[] = ['sunny', 'drought', 'heavyRain', 'heatwave', 'lightRain']
  const modes: ControlMode[] = ['timer', 'smart', 'operator']
  for (const preset of presets) {
    for (const mode of modes) {
      it(`fecha por passo e no total — ${preset}/${mode}`, () => {
        const r = soilResiduals(cfg({ preset, mode, rainMmH: rainFor(preset) }), 20)
        expect(r.maxRes).toBeLessThan(TOL_MM)
        expect(Math.abs(r.global)).toBeLessThan(TOL_MM)
      })
    }
  }
  for (const soil of ['arenoso', 'franco', 'argiloso'] as SoilType[]) {
    it(`fecha em solo ${soil} com chuva intensa e irrigação do operador`, () => {
      const r = soilResiduals(cfg({ soil, preset: 'heavyRain', rainMmH: 16, mode: 'operator' }), 15)
      expect(r.maxRes).toBeLessThan(TOL_MM)
      expect(Math.abs(r.global)).toBeLessThan(TOL_MM)
    })
  }

  it('argila com chuva intensa gera escoamento superficial; areia gera drenagem profunda', () => {
    const clay = soilResiduals(cfg({ soil: 'argiloso', preset: 'heavyRain', rainMmH: 16, mode: 'timer' }), 10)
    const sand = soilResiduals(cfg({ soil: 'arenoso', preset: 'heavyRain', rainMmH: 16, mode: 'timer' }), 10)
    expect(clay.roTot).toBeGreaterThan(sand.roTot)
    expect(sand.drTot).toBeGreaterThan(0)
  })

  it('sem chuva e sem irrigação a água do solo só diminui, e exatamente pela ETc real', () => {
    const c = cfg({ mode: 'manual', preset: 'drought' })
    const r = soilResiduals(c, 5)
    expect(r.W1).toBeLessThan(r.W0)
    expect(r.inTot).toBe(0)
    expect(r.W0 - r.W1).toBeCloseTo(r.etTot + r.drTot + r.roTot, 6)
  })
})

describe('Conservação de água no sistema hidráulico', () => {
  it('água retirada do reservatório = soma aplicada aos setores + vazamento', () => {
    for (const leak of [0, 0.3]) {
      const w = world({ mode: 'timer' })
      w.faults.leak = leak
      run(w, 10)
      const applied = sum(w.zones.map((z) => z.appliedL))
      expect(w.stats.withdrawnL).toBeGreaterThan(0)
      expect(Math.abs(w.stats.withdrawnL - (applied + w.stats.leakL))).toBeLessThan(1e-6 * w.stats.withdrawnL)
      if (leak > 0) expect(w.stats.leakL / w.stats.withdrawnL).toBeCloseTo(leak, 6)
    }
  })

  it('perda por eficiência de aplicação = (1 − eficiência) × água aplicada aos setores', () => {
    const w = world({ mode: 'timer', effDrip: 0.8 })
    run(w, 7)
    const applied = sum(w.zones.map((z) => z.appliedL))
    expect(w.stats.lossEffL).toBeCloseTo(applied * 0.2, 4)
  })

  it('reservatório: ΔV = entradas − retirada − evaporação (sem saturar nos limites)', () => {
    const w = world({ mode: 'smart', preset: 'drought' })
    const V0 = w.reservoir.L
    let evap = 0
    let minL = Infinity, maxL = -Infinity
    run(w, 14, () => {
      evap += (w.reservoir.cap / 1000 / 1.8) * w.wx.et0 * 0.9 * (5 / 60)
      minL = Math.min(minL, w.reservoir.L)
      maxL = Math.max(maxL, w.reservoir.L)
    })
    expect(minL).toBeGreaterThan(0)
    expect(maxL).toBeLessThan(w.reservoir.cap)
    expect(w.reservoir.L).toBeCloseTo(V0 - w.stats.withdrawnL - evap + w.stats.refillL, 3)
  })

  it('sem reposição o reservatório esvazia, a bomba para e nunca há volume negativo', () => {
    const w = world({ mode: 'timer', refill: false, reservoirL: 30000 })
    let minL = Infinity
    let prevL = w.reservoir.L
    run(w, 14, () => {
      minL = Math.min(minL, w.reservoir.L)
      if (prevL <= 1) expect(w.pump.on).toBe(false) // tanque vazio no início do passo → bomba protegida
      prevL = w.reservoir.L
    })
    expect(minL).toBeGreaterThanOrEqual(0)
    expect(w.stats.withdrawnL).toBeLessThanOrEqual(24000 + 1e-6)
  })

  it('volume do solo × área: ETc diária do franco no clima ensolarado fica em faixa física (2–8 mm/dia)', () => {
    const w = world({ mode: 'timer' })
    run(w, 10)
    const etcDay = sum(w.zones.map((z) => z.etcMm)) / 4 / 10
    expect(etcDay).toBeGreaterThan(2)
    expect(etcDay).toBeLessThan(8)
    expect(soilOf(w).thetaS).toBeGreaterThan(soilOf(w).thetaFC)
  })
})

void step
