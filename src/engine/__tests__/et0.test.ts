import { describe, expect, it } from 'vitest'
import { et0Hourly, satVap, weatherAt, rainForecast } from '../climate'
import type { Weather } from '../types'
import { cfg } from './helpers'

const base: Weather = { t: 0, day: 0, hour: 14.5, tAir: 38, rh: 0.52, solar: 680.6, clear: 900, rain: 0, wind: 3.3, cloud: 0.505, et0: 0 }

describe('ET₀ — FAO-56 Penman-Monteith horário', () => {
  it('pressão de vapor e declividade batem com o Exemplo 19 da FAO-56 (38 °C)', () => {
    const es = satVap(38)
    const delta = (4098 * es) / (38 + 237.3) ** 2
    expect(es).toBeCloseTo(6.625, 2)
    expect(delta).toBeCloseTo(0.358, 3)
  })

  it('reproduz o Exemplo 19 da FAO-56 (14–15 h: 38 °C, UR 52%, u2 3,3 m/s) → 0,63 mm/h', () => {
    // Rs = 2,45 MJ/m²/h = 680,6 W/m². A nebulosidade 0,505 reproduz o Rnl do exemplo (Rn ≈ 1,75 MJ/m²/h).
    expect(et0Hourly(base)).toBeCloseTo(0.63, 1)
    expect(Math.abs(et0Hourly(base) - 0.63)).toBeLessThan(0.02)
  })

  it('nunca é negativa e a fração noturna do total diário é pequena (<15%)', () => {
    for (const preset of ['sunny', 'drought', 'cloudy', 'lightRain', 'heatwave'] as const) {
      let night = 0
      let total = 0
      for (let m = 0; m < 1440; m += 5) {
        const w = weatherAt(m, cfg({ preset, rainMmH: preset === 'lightRain' ? 3 : 0 }))
        expect(w.et0).toBeGreaterThanOrEqual(0)
        total += w.et0 / 12
        if (w.solar <= 0) night += w.et0 / 12
      }
      expect(night / total).toBeLessThan(0.15)
    }
  })

  it('responde fisicamente: cresce com radiação e vento, diminui com umidade relativa', () => {
    const e0 = et0Hourly(base)
    expect(et0Hourly({ ...base, solar: base.solar * 1.3 })).toBeGreaterThan(e0)
    expect(et0Hourly({ ...base, wind: base.wind * 2 })).toBeGreaterThan(e0)
    expect(et0Hourly({ ...base, rh: 0.8 })).toBeLessThan(e0)
    expect(et0Hourly({ ...base, tAir: 30 })).toBeLessThan(e0)
  })

  it('totais diários ficam em faixas plausíveis por condição climática', () => {
    const daily = (o: Parameters<typeof cfg>[0]) => {
      let s = 0
      for (let m = 0; m < 1440; m += 5) s += weatherAt(m, cfg(o)).et0 * (5 / 60)
      return s
    }
    const sunny = daily({ preset: 'sunny' })
    const drought = daily({ preset: 'drought', tempC: 28 })
    const cloudy = daily({ preset: 'cloudy' })
    const rain = daily({ preset: 'lightRain', rainMmH: 3 })
    expect(sunny).toBeGreaterThan(4)
    expect(sunny).toBeLessThan(7)
    expect(drought).toBeGreaterThan(sunny)
    expect(cloudy).toBeLessThan(sunny)
    expect(rain).toBeLessThan(cloudy + 1)
    expect(drought).toBeLessThan(10)
  })

  it('clima é função pura e determinística do tempo e da configuração', () => {
    const c = cfg({ preset: 'drought' })
    expect(weatherAt(1234, c)).toEqual(weatherAt(1234, c))
    expect(weatherAt(1234, c)).not.toEqual(weatherAt(1234 + 360, c))
  })

  it('a previsão simulada de chuva hoje é o clima futuro exato (limitação documentada: sem erro de previsão)', () => {
    const c = cfg({ preset: 'lightRain', rainMmH: 3 })
    // integração em passo de 30 min é aproximação do mesmo gerador de clima
    let real = 0
    for (let m = 0; m < 360; m += 1) real += weatherAt(13 * 60 + m, c).rain / 60
    expect(Math.abs(rainForecast(13 * 60 - 0, c, 6) - real)).toBeLessThan(1.0)
  })
})
