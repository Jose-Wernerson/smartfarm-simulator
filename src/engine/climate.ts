import type { Config, Weather, WeatherPreset } from './types'
import { clamp } from './params'

export interface PresetDef {
  label: string
  cloud: number
  dT: number
  rh: number // % ao nível da temperatura média
  wind: number
  rainDefault: number
  rainStart: number
  rainDur: number
}

export const PRESETS: Record<WeatherPreset, PresetDef> = {
  sunny: { label: 'Ensolarado', cloud: 0.05, dT: 0, rh: 58, wind: 2, rainDefault: 0, rainStart: 14, rainDur: 2.5 },
  partly: { label: 'Parcialmente nublado', cloud: 0.4, dT: -1, rh: 65, wind: 2, rainDefault: 0, rainStart: 14, rainDur: 2.5 },
  cloudy: { label: 'Nublado', cloud: 0.8, dT: -2.5, rh: 75, wind: 1.6, rainDefault: 0, rainStart: 14, rainDur: 2.5 },
  lightRain: { label: 'Chuva leve', cloud: 0.85, dT: -3, rh: 82, wind: 1.8, rainDefault: 3, rainStart: 13, rainDur: 4 },
  heavyRain: { label: 'Chuva intensa', cloud: 0.95, dT: -5, rh: 90, wind: 3, rainDefault: 16, rainStart: 14, rainDur: 2 },
  drought: { label: 'Período de seca', cloud: 0.0, dT: 3, rh: 34, wind: 3, rainDefault: 0, rainStart: 14, rainDur: 2.5 },
  heatwave: { label: 'Onda de calor', cloud: 0.03, dT: 8, rh: 30, wind: 2.4, rainDefault: 0, rainStart: 14, rainDur: 2.5 },
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Pressão de saturação de vapor (kPa) */
export const satVap = (T: number) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3))

/** Clima determinístico em função do tempo da simulação (mesmas condições p/ todos os cenários). */
export function weatherAt(tMin: number, cfg: Config): Weather {
  const p = PRESETS[cfg.preset]
  const day = Math.floor(tMin / 1440)
  const hour = (tMin % 1440) / 60

  const cloudBase = clamp(p.cloud + (hash(day + 3) - 0.5) * 0.1, 0, 1)
  const start = p.rainStart + (hash(day + 7) - 0.5) * 2
  let rain = 0
  if (cfg.rainMmH > 0 && hour >= start && hour < start + p.rainDur) {
    const shape = Math.min(1, (hour - start) / 0.4, (start + p.rainDur - hour) / 0.4)
    rain = cfg.rainMmH * clamp(shape, 0, 1)
  }
  const raining = rain > 0.05
  const cloud = raining ? Math.max(cloudBase, 0.88) : cloudBase

  const clear = 1000 * Math.pow(Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)), 1.2)
  const solar = clear * (cfg.solarPct / 100) * (1 - 0.75 * Math.pow(cloud, 3.4))

  const tMean = cfg.tempC + p.dT + (hash(day) - 0.5) * 2.4
  let tAir = tMean + (cfg.tempAmp / 2) * Math.sin((2 * Math.PI * (hour - 9)) / 24)
  if (raining) tAir -= 2.5

  const ea0 = (p.rh / 100) * satVap(cfg.tempC + p.dT)
  let rh = clamp(ea0 / satVap(tAir), 0.12, 1)
  if (raining) rh = Math.max(rh, 0.92)
  const wind = Math.max(0.3, p.wind * (0.75 + 0.45 * Math.sin((2 * Math.PI * (hour - 8)) / 24)) + (hash(tMin / 17) - 0.5) * 0.4)

  const w: Weather = { t: tMin, day, hour, tAir, rh, solar, clear, rain, wind, cloud, et0: 0 }
  w.et0 = et0Hourly(w)
  return w
}

/**
 * ET0 horária – FAO-56 Penman-Monteith (eq. 53, passo horário).
 * Simplificações: Rs derivada de curva de céu limpo × fator de nebulosidade,
 * Rso ≈ curva de céu limpo, sem correção de altitude, G = 0,1·Rn (dia) / 0,5·Rn (noite).
 */
export function et0Hourly(w: Weather): number {
  const T = w.tAir
  const es = satVap(T)
  const ea = es * w.rh
  const delta = (4098 * es) / Math.pow(T + 237.3, 2)
  const gamma = 0.0665
  const Rs = w.solar * 0.0036 // MJ/m²/h
  const Rns = 0.77 * Rs
  const ratio = clamp(1 - 0.75 * Math.pow(w.cloud, 3.4), 0.3, 1)
  const sigma = 2.043e-10
  const Rnl = sigma * Math.pow(T + 273.16, 4) * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * ratio - 0.35)
  const Rn = Rns - Rnl
  const G = w.solar > 5 ? 0.1 * Rn : 0.5 * Rn
  const u2 = w.wind
  const num = 0.408 * delta * (Rn - G) + gamma * (37 / (T + 273)) * u2 * (es - ea)
  const den = delta + gamma * (1 + 0.34 * u2)
  return Math.max(0, num / den)
}

/** Previsão simulada: chuva acumulada (mm) nas próximas `hours` horas. */
export function rainForecast(tMin: number, cfg: Config, hours = 6): number {
  let sum = 0
  for (let h = 0.5; h <= hours; h += 0.5) sum += weatherAt(tMin + h * 60, cfg).rain * 0.5
  return sum
}

export function formatClock(tMin: number, startHour = 0): string {
  const total = tMin + startHour * 60
  const day = Math.floor(total / 1440) + 1
  const h = Math.floor((total % 1440) / 60)
  const m = Math.floor(total % 60)
  return `Dia ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
