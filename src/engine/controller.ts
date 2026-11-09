import type { World } from './types'
import { SOILS, clamp } from './params'

export interface Decision {
  want: boolean
  open: boolean[]
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

/** Leitura do sensor de umidade de um setor. */
export function soilReading(w: World, zi: number) {
  const s = w.sensors.find((x) => x.type === 'soilMoisture' && x.zone === zi)
  if (!s) return { v: 50, valid: false, suspect: false }
  return { v: s.value ?? s.lastGood, valid: s.value !== null, suspect: s.suspect }
}

/** Meta de umidade ao final do ciclo (modos inteligentes): repõe ~2 dias de ETc, descontando chuva prevista. */
export function smartTarget(w: World): number {
  const cfg = w.cfg
  const soil = SOILS[cfg.soil]
  const etDay = w.ctl.et0Ema * 24 * 0.9 * cfg.kcScale
  const need = Math.max(0, etDay * 2 - w.forecastMm * 0.8)
  const band = (need / (cfg.rootDepthM * 1000 * soil.thetaS)) * 100
  return clamp(cfg.threshold + clamp(band, 3, 30), cfg.threshold + 3, cfg.blockAbove - 5)
}

export function decide(w: World): Decision {
  const cfg = w.cfg
  const n = w.zones.length
  const none: Decision = { want: false, open: new Array(n).fill(false) }
  if (w.faults.power) return none
  const wx = w.wx
  const allOpen = new Array(n).fill(true)

  switch (cfg.mode) {
    case 'manual':
      return { want: w.pump.cmd, open: w.zones.map((z) => z.valveCmd) }

    case 'operator': {
      if (w.ctl.opRemainingL <= 0 && wx.day % 2 === 0 && w.ctl.opDay !== wx.day && wx.hour >= 10) {
        w.ctl.opRemainingL = 15 * cfg.areaM2 // 15 mm nominais, sem considerar clima
        w.ctl.opDay = wx.day
      }
      return w.ctl.opRemainingL > 0 ? { want: true, open: allOpen } : none
    }

    case 'timer': {
      const m = ((w.t % 1440) - cfg.timerStartH * 60 + 1440) % 1440
      return m < cfg.timerDurMin ? { want: true, open: allOpen } : none
    }

    default:
      break
  }

  // ---- automático / inteligente / otimizado ----
  const mode = cfg.mode
  const thr = cfg.threshold
  const crit = thr - 8
  const night = wx.hour >= 19 || wx.hour < 8
  const resOk = w.reservoir.L > w.reservoir.cap * 0.05
  const smartLike = mode === 'smart' || mode === 'optimized'
  const tgt = smartLike ? smartTarget(w) : thr + cfg.band

  if (mode === 'optimized' && w.t < w.ctl.leakLockUntil) {
    w.zones.forEach((z) => (z.irrigating = false))
    return none
  }

  // leituras (otimizado: valida sensores com verificação cruzada)
  const raw = w.zones.map((_, i) => soilReading(w, i))
  const vals = raw.map((r) => r.v)
  const usable = raw.map((r) => r.valid && !r.suspect)
  if (mode === 'optimized') {
    for (let i = 0; i < n; i++) {
      if (!usable[i]) {
        const others = vals.filter((_, j) => j !== i && usable[j])
        vals[i] = others.length ? median(others) : NaN
      }
    }
  }

  const candidates: { i: number; v: number }[] = []
  let running = w.zones.filter((z) => z.irrigating).length
  w.zones.forEach((z, i) => {
    const v = vals[i]
    if (Number.isNaN(v)) {
      z.irrigating = false
      return
    }
    const critical = v < crit
    if (z.irrigating) {
      let stop = v >= tgt || v >= cfg.blockAbove || !resOk
      if (smartLike) {
        if (wx.rain > 1 && !critical) stop = true
        if (!night && !critical && v >= thr + (tgt - thr) * 0.5) stop = true
      }
      if (stop) {
        z.irrigating = false
        running--
      }
    } else if (v < thr && v < cfg.blockAbove && resOk) {
      let ok = true
      if (smartLike) {
        const rainSoon = w.forecastMm >= cfg.rainSkipMm
        ok = (night || critical) && !(rainSoon && !critical) && wx.rain <= 1
      }
      if (ok) candidates.push({ i, v })
    }
  })
  candidates.sort((a, b) => a.v - b.v)
  const maxConc = mode === 'optimized' ? 2 : n
  for (const c of candidates) {
    if (running >= maxConc) break
    w.zones[c.i].irrigating = true
    running++
  }

  const open = w.zones.map((z) => z.irrigating)
  return { want: open.some(Boolean), open }
}
