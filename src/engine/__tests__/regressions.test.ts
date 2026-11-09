import { describe, expect, it } from 'vitest'
import { buildLayout } from '../layout'
import { cfg, run, sum, world } from './helpers'
import { createWorld, step } from '../sim'

describe('Regressão A1 — falsos alertas de vazamento', () => {
  it('nenhum alerta de vazamento em operação normal, em qualquer modo/clima (10 dias)', () => {
    for (const mode of ['timer', 'auto', 'smart', 'optimized', 'operator'] as const) {
      for (const preset of ['sunny', 'drought', 'heatwave'] as const) {
        const w = world({ mode, preset })
        run(w, 10)
        expect(w.alerts.filter((a) => a.key === 'leak').length, `${mode}/${preset}`).toBe(0)
      }
    }
  })

  it('o sensor de pressão reflete o estado do mesmo passo (sem defasagem na partida da bomba)', () => {
    const w = world({ mode: 'manual' })
    w.pump.cmd = true
    w.zones.forEach((z) => (z.valveCmd = true))
    step(w, 5) // exatamente 1 passo
    expect(w.pump.on).toBe(true)
    const p = w.sensors.find((s) => s.type === 'pressure')!.value!
    expect(p).toBeGreaterThan(w.cfg.pressureBar * 0.8)
  })

  it('vazamento real continua sendo detectado em até 15 min', () => {
    const w = world({ mode: 'manual' })
    w.faults.leak = 0.25
    w.pump.cmd = true
    w.zones.forEach((z) => (z.valveCmd = true))
    run(w, 15 / 1440)
    expect(w.alerts.some((a) => a.key === 'leak' && a.severity === 'critical')).toBe(true)
  })
})

describe('Regressão M2 — plantas e área configuradas × desenhadas', () => {
  const cases: [number, number, number][] = [
    [800, 2, 5000], [400, 2, 3000], [1200, 2, 8000], [2000, 2, 12000], [1000, 2.5, 10000], [600, 3, 9000], [1500, 1.5, 6000],
  ]
  for (const [plants, spacing, area] of cases) {
    it(`${plants} plantas, ${spacing} m, ${area} m²: desenho = configuração = motor`, () => {
      const w = createWorld(cfg({ plants, spacing, areaM2: area }))
      expect(w.layout.plants.length).toBe(w.cfg.plants) // configuração normalizada para o que é desenhado
      expect(Math.abs(w.cfg.plants - plants) / plants).toBeLessThan(0.03)
      expect(w.layout.W * w.layout.L).toBeCloseTo(area, 6) // área desenhada = área configurada
      expect(sum(w.zones.map((z) => z.plants))).toBe(w.layout.plants.length)
      // lâmina por setor usa a área cultivada real do setor
      for (const z of w.zones) expect(z.areaM2).toBeCloseTo(z.plants * w.layout.rowSp * w.cfg.spacing, 6)
      expect(sum(w.zones.map((z) => z.areaM2))).toBeLessThanOrEqual(area + 1e-6)
    })
  }
  it('o layout é determinístico e sem sobreposição de plantas', () => {
    const l = buildLayout(cfg())
    const keys = new Set(l.plants.map((p) => `${p.x.toFixed(3)}|${p.z.toFixed(3)}`))
    expect(keys.size).toBe(l.plants.length)
    expect(l.rowSp).toBeGreaterThanOrEqual(2)
    expect(l.rowSp).toBeLessThanOrEqual(6)
  })
})
