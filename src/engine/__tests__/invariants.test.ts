import { describe, expect, it } from 'vitest'
import { SOILS } from '../params'
import { rainFor, run, world } from './helpers'
import type { ControlMode, SoilType, WeatherPreset } from '../types'

const soils: SoilType[] = ['arenoso', 'franco', 'argiloso']
const presets: WeatherPreset[] = ['sunny', 'drought', 'heavyRain', 'heatwave', 'lightRain']
const modes: ControlMode[] = ['manual', 'timer', 'auto', 'smart', 'optimized', 'operator']

describe('Invariantes físicos do motor (10 dias × solos × climas × modos)', () => {
  for (const mode of modes) {
    it(`modo ${mode}: nenhum limite físico é violado`, () => {
      for (const soil of soils) {
        for (const preset of presets) {
          const w = world({ soil, preset, mode, rainMmH: rainFor(preset) })
          if (mode === 'manual') {
            w.pump.cmd = true
            w.zones.forEach((z) => (z.valveCmd = true))
          }
          const s = SOILS[soil]
          const tag = `${soil}/${preset}/${mode}`
          const bad = new Set<string>()
          let prevKwh = 0
          let prevWith = 0
          run(w, 10, () => {
            for (const z of w.zones) {
              if (!Number.isFinite(z.theta)) bad.add('theta não finito')
              if (z.theta < 0 || z.theta > s.thetaS + 1e-9) bad.add('umidade fora de [0, θs]')
              if (z.ks < 0 || z.ks > 1) bad.add('Ks fora de [0,1]')
              if (z.flowLph < 0) bad.add('vazão negativa')
              if (z.dev < 0 || z.dev > 100) bad.add('desenvolvimento fora de [0,100]')
              if (z.tSoil < -5 || z.tSoil > 60) bad.add('temperatura do solo absurda')
            }
            if (w.reservoir.L < 0 || w.reservoir.L > w.reservoir.cap + 1e-6) bad.add('reservatório fora de [0, capacidade]')
            if (w.reservoir.L <= 0 && w.pump.on) bad.add('bomba ligada com reservatório vazio')
            if (w.pump.flowLph < 0 || w.pump.powerKw < 0 || w.energy.loadKw < 0) bad.add('vazão/energia negativa')
            if (w.stats.kWh < prevKwh) bad.add('kWh decresce')
            if (w.stats.withdrawnL < prevWith) bad.add('consumo de água decresce')
            prevKwh = w.stats.kWh
            prevWith = w.stats.withdrawnL
            if (w.zones.some((z) => z.flowLph > 0) && !w.pump.on) bad.add('irrigação sem bomba ligada')
            if (w.sensors.some((sen) => sen.value !== null && !Number.isFinite(sen.value))) bad.add('sensor não finito')
          })
          expect([...bad], tag).toEqual([])
        }
      }
    })
  }

  it('plantas contabilizadas: soma por setor = total desenhado = total usado pela hidráulica', () => {
    const w = world()
    const perZone = w.zones.map((z) => z.plants)
    expect(perZone.reduce((a, b) => a + b, 0)).toBe(w.layout.plants.length)
    expect(w.layout.emitters.length).toBe(w.layout.plants.length)
    for (let z = 0; z < 4; z++) expect(w.layout.plants.filter((p) => p.zone === z).length).toBe(perZone[z])
  })

  it('histórico e diário usam as mesmas fontes: consumo diário soma o consumo acumulado', () => {
    const w = world({ mode: 'timer' })
    run(w, 5)
    const dailySum = w.daily.reduce((a, d) => a + d.waterL, 0)
    const today = w.stats.withdrawnL - w.dayStart.stats.withdrawnL
    expect(dailySum + today).toBeCloseTo(w.stats.withdrawnL, 6)
    const lastSample = w.history[w.history.length - 1]
    expect(lastSample.waterCumL).toBeLessThanOrEqual(w.stats.withdrawnL + 1e-6)
    expect(w.stats.withdrawnL - lastSample.waterCumL).toBeLessThan(w.cfg.pumpLph * (15 / 60) + 1)
  })
})
