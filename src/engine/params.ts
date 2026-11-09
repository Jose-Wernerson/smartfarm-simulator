import type { Config, SoilType } from './types'

/**
 * Parâmetros HIPOTÉTICOS de solo (valores típicos de literatura, simplificados).
 * "Umidade do solo (%)" no simulador = grau de saturação = θ / θs × 100.
 */
export interface SoilParams {
  label: string
  thetaS: number // saturação (m³/m³)
  thetaFC: number // capacidade de campo
  thetaWP: number // ponto de murcha
  ksat: number // taxa máx. de infiltração (mm/h)
  drainK: number // coef. de drenagem do excedente acima da CC (1/h)
  suggestedThreshold: number
}

export const SOILS: Record<SoilType, SoilParams> = {
  arenoso: { label: 'Arenoso', thetaS: 0.4, thetaFC: 0.16, thetaWP: 0.06, ksat: 40, drainK: 0.35, suggestedThreshold: 28 },
  franco: { label: 'Franco (médio)', thetaS: 0.45, thetaFC: 0.31, thetaWP: 0.11, ksat: 14, drainK: 0.12, suggestedThreshold: 40 },
  argiloso: { label: 'Argiloso', thetaS: 0.5, thetaFC: 0.38, thetaWP: 0.22, ksat: 4, drainK: 0.04, suggestedThreshold: 55 },
}

export const STAGES = [
  { name: 'Muda', from: 0, kc: 0.5, color: '#9be37a' },
  { name: 'Crescimento vegetativo', from: 12, kc: 0.7, color: '#6fcf5a' },
  { name: 'Desenvolvimento', from: 35, kc: 0.9, color: '#3fb34a' },
  { name: 'Floração', from: 55, kc: 1.0, color: '#b57edc' },
  { name: 'Frutificação', from: 72, kc: 1.05, color: '#e8c23a' },
  { name: 'Produção', from: 88, kc: 0.95, color: '#f0a020' },
] as const

export function stageIndex(dev: number): number {
  let idx = 0
  for (let i = 0; i < STAGES.length; i++) if (dev >= STAGES[i].from) idx = i
  return idx
}

export const GDD_BASE = 15 // °C (hipótese)
export const GDD_TOTAL = 1700 // °C·dia até a produção (hipótese)

export const DEFAULT_CONFIG: Config = {
  areaM2: 5000,
  plants: 800,
  spacing: 2,
  soil: 'franco',
  reservoirL: 80000,
  pumpLph: 18000,
  threshold: 40,
  preset: 'sunny',
  rainMmH: 0,
  tempC: 26,
  tempAmp: 10,
  solarPct: 100,
  kcScale: 1,
  rootDepthM: 0.3,
  depletionP: 0.65,
  effDrip: 0.9,
  band: 8,
  blockAbove: 85,
  noiseLevel: 1,
  accel: 12,
  startDev: 30,
  startMoisture: 62,
  pressureBar: 2.5,
  pumpEta: 0.6,
  refill: true,
  refillLph: 12000,
  panelsKwp: 0,
  timerStartH: 6,
  timerDurMin: 90,
  rainSkipMm: 3,
  startHour: 6,
  seed: 42,
  mode: 'smart',
}

export const MODE_LABEL: Record<string, string> = {
  manual: 'Manual',
  timer: 'Programado (temporizador)',
  auto: 'Automático (sensores)',
  smart: 'Inteligente',
  optimized: 'Otimizado por zonas',
  operator: 'Convencional (operador)',
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
