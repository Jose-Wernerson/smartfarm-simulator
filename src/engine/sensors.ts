import type { SensorState, SensorType, World } from './types'
import { SOILS, clamp } from './params'

export const SENSOR_META: Record<SensorType, { label: string; unit: string; sigma: number; decimals: number }> = {
  soilMoisture: { label: 'Umidade do solo', unit: '%', sigma: 0.6, decimals: 1 },
  soilTemp: { label: 'Temperatura do solo', unit: '°C', sigma: 0.2, decimals: 1 },
  airTemp: { label: 'Temperatura ambiente', unit: '°C', sigma: 0.2, decimals: 1 },
  airHumidity: { label: 'Umidade do ar', unit: '%', sigma: 1, decimals: 0 },
  light: { label: 'Luminosidade', unit: 'klux', sigma: 1.2, decimals: 1 },
  rain: { label: 'Chuva', unit: 'mm/h', sigma: 0.05, decimals: 1 },
  level: { label: 'Nível do reservatório', unit: '%', sigma: 0.3, decimals: 1 },
  flow: { label: 'Fluxo de água', unit: 'L/h', sigma: 60, decimals: 0 },
  pressure: { label: 'Pressão da tubulação', unit: 'bar', sigma: 0.03, decimals: 2 },
}

const ZN = ['A', 'B', 'C', 'D']

export function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng())
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function buildSensors(w: Pick<World, 'layout' | 'rng'>): SensorState[] {
  const { layout, rng } = w
  const out: SensorState[] = []
  const add = (id: string, type: SensorType, zone: number, pos: [number, number], label?: string) => {
    const m = SENSOR_META[type]
    out.push({
      id,
      label: label ?? `${m.label}${zone >= 0 ? ' – Setor ' + ZN[zone] : ''}`,
      type,
      zone,
      pos,
      unit: m.unit,
      value: null,
      lastGood: 0,
      history: [],
      status: 'ok',
      battery: 62 + rng() * 38,
      signal: 90,
      suspect: false,
    })
  }
  layout.zoneRects.forEach((r, i) => {
    const cx = (r.x0 + r.x1) / 2 + layout.rowSp * 0.5
    const cz = (r.z0 + r.z1) / 2
    add(`SM-${ZN[i]}`, 'soilMoisture', i, [cx, cz])
  })
  ;[0, 3].forEach((i) => {
    const r = layout.zoneRects[i]
    add(`ST-${ZN[i]}`, 'soilTemp', i, [(r.x0 + r.x1) / 2 - layout.rowSp * 0.5, (r.z0 + r.z1) / 2 + 4])
  })
  const st = layout.station
  add('TA-01', 'airTemp', -1, [st.x, st.z - 2], 'Temperatura ambiente – Estação')
  add('UA-01', 'airHumidity', -1, [st.x, st.z + 0.5], 'Umidade do ar – Estação')
  add('LX-01', 'light', -1, [st.x + 1.2, st.z], 'Luminosidade – Estação')
  add('RN-01', 'rain', -1, [st.x + 1.8, st.z + 2], 'Pluviômetro – Estação')
  add('NV-01', 'level', -1, [layout.tank.x, layout.tank.z + layout.tank.r + 0.6], 'Nível – Reservatório')
  add('FL-01', 'flow', -1, [layout.pump.x + 2.6, 1.4], 'Fluxo – Saída da bomba')
  add('PR-01', 'pressure', -1, [layout.pump.x + 3.8, -1.4], 'Pressão – Tubulação principal')
  return out
}

function trueValue(w: World, s: SensorState): number {
  const soil = SOILS[w.cfg.soil]
  switch (s.type) {
    case 'soilMoisture':
      return (w.zones[s.zone].theta / soil.thetaS) * 100
    case 'soilTemp':
      return w.zones[s.zone].tSoil
    case 'airTemp':
      return w.wx.tAir
    case 'airHumidity':
      return w.wx.rh * 100
    case 'light':
      return w.wx.solar * 0.12
    case 'rain':
      return w.wx.rain
    case 'level':
      return (w.reservoir.L / w.reservoir.cap) * 100
    case 'flow':
      return w.pump.flowLph
    case 'pressure':
      return w.pump.pressure
  }
}

function wrongValue(s: SensorState): number {
  switch (s.type) {
    case 'soilMoisture':
      return 7
    case 'soilTemp':
      return 41
    case 'airTemp':
      return 48
    case 'airHumidity':
      return 12
    case 'light':
      return 0.4
    case 'rain':
      return 0
    case 'level':
      return 96
    case 'flow':
      return 0
    case 'pressure':
      return 0.1
  }
}

export function updateSensors(w: World, dtMin: number): void {
  const dtH = dtMin / 60
  const f = w.faults
  const sampleNow = w.t - w.lastSample >= 15
  w.sensors.forEach((s, idx) => {
    const m = SENSOR_META[s.type]
    const dist = Math.hypot(s.pos[0] - w.layout.pump.x, s.pos[1] - w.layout.pump.z)
    s.signal = clamp(97 - dist * 0.32 + 3 * Math.sin(w.t / 53 + idx) - w.wx.rain * 0.6, 15, 100)
    const dead = f.comms || f.power || f.offline[s.id] || s.battery <= 0
    if (dead) {
      s.value = null
      s.status = 'offline'
      s.signal = f.comms || f.offline[s.id] ? 0 : s.signal
    } else {
      let v = trueValue(w, s) + gauss(w.rng) * m.sigma * w.cfg.noiseLevel * (s.type === 'light' ? 1 : 1)
      if (f.wrong[s.id]) v = wrongValue(s) + gauss(w.rng) * m.sigma * 0.3
      if (s.type === 'soilMoisture' || s.type === 'airHumidity' || s.type === 'level') v = clamp(v, 0, 100)
      if (s.type === 'rain' || s.type === 'flow' || s.type === 'pressure' || s.type === 'light') v = Math.max(0, v)
      s.value = v
      s.lastGood = v
      s.battery = Math.max(0, s.battery - 0.04 * dtH)
      s.status = s.battery < 20 ? 'lowbat' : 'ok'
    }
    if (sampleNow && s.value !== null) {
      s.history.push({ t: w.t, v: s.value })
      if (s.history.length > 192) s.history.shift()
    }
  })
}

/** Detecção de leituras suspeitas: limites físicos e comparação com sensores vizinhos. */
export function detectSuspects(w: World): void {
  const moist = w.sensors.filter((s) => s.type === 'soilMoisture' && s.value !== null)
  const vals = moist.map((s) => s.value as number)
  for (const s of w.sensors) s.suspect = false
  if (vals.length >= 3) {
    for (const s of moist) {
      const others = moist.filter((o) => o !== s).map((o) => o.value as number).sort((a, b) => a - b)
      const med = others[Math.floor(others.length / 2)]
      const spread = others[others.length - 1] - others[0]
      if (Math.abs((s.value as number) - med) > 22 && spread < 30) s.suspect = true
    }
  }
  for (const s of w.sensors) {
    if (s.value === null) continue
    if (s.type === 'soilMoisture' && (s.value < 3 || s.value > 99)) s.suspect = true
    if (s.type === 'airTemp' && (s.value > 46)) s.suspect = true
  }
}
