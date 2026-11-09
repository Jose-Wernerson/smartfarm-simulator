import type { Config, DailyRec, Faults, Stats, World } from './types'
import { GDD_BASE, GDD_TOTAL, SOILS, STAGES, clamp, mulberry32, stageIndex } from './params'
import { rainForecast, weatherAt } from './climate'
import { buildLayout } from './layout'
import { buildSensors, detectSuspects, updateSensors } from './sensors'
import { decide } from './controller'
import { evalAlerts } from './alerts'

export const emptyStats = (): Stats => ({
  withdrawnL: 0, appliedL: 0, leakL: 0, lossSoilL: 0, lossEffL: 0, pumpMin: 0, irrigations: 0, kWh: 0,
  gridKWh: 0, solarKWh: 0, rainMm: 0, etcMm: 0, stressHours: 0, overwetHours: 0, inRangeHours: 0,
  moistSum: 0, steps: 0, refillL: 0, dryRunMin: 0,
})
export const emptyFaults = (): Faults => ({
  offline: {}, wrong: {}, pumpFailure: false, leak: 0, leakZone: 4, reservoirEmpty: false, power: false, comms: false, clog: [0, 0, 0, 0],
})

export const moistPct = (w: World, zi: number) => (w.zones[zi].theta / SOILS[w.cfg.soil].thetaS) * 100

export function createWorld(cfgIn: Config): World {
  const cfg = { ...cfgIn }
  const layout = buildLayout(cfg)
  const soil = SOILS[cfg.soil]
  const rng = mulberry32(cfg.seed)
  const counts = [0, 0, 0, 0]
  layout.plants.forEach((p) => counts[p.zone]++)
  const t0 = cfg.startHour * 60
  const wx = weatherAt(t0, cfg)
  const w: World = {
    cfg, layout, t: t0, t0, wx, forecastMm: rainForecast(t0, cfg),
    zones: counts.map((c, i) => ({
      index: i, name: 'ABCD'[i], areaM2: cfg.areaM2 / 4, plants: c,
      theta: (cfg.startMoisture / 100) * soil.thetaS, tSoil: cfg.tempC - 1,
      valveCmd: false, valveOpen: false, irrigating: false, flowLph: 0, ks: 1, dev: cfg.startDev, vigor: 85, clog: 0,
      appliedL: 0, stressH: 0, etcMm: 0, drainMm: 0, runoffMm: 0, rainInfilMm: 0,
    })),
    sensors: [],
    reservoir: { L: cfg.reservoirL * 0.8, cap: cfg.reservoirL, refilling: false },
    pump: { cmd: false, want: false, on: false, flowLph: 0, leakLph: 0, pressure: 0, powerKw: 0, dwellMin: 99, runMinToday: 0, lowPressMin: 0, noFlowMin: 0 },
    energy: { loadKw: 0, solarKw: 0, gridKw: 0 },
    faults: emptyFaults(), stats: emptyStats(), daily: [],
    dayStart: { stats: emptyStats(), day: wx.day, alerts: 0, et0: 0, tSum: 0, n: 0 },
    history: [], alerts: [], irrLog: [],
    ctl: { opRemainingL: 0, opDay: -1, leakLockUntil: 0, et0Ema: 0.2 },
    rng, nextAlertId: 1, lastSample: -999,
  }
  w.sensors = buildSensors(w)
  updateSensors(w, 1)
  return w
}

function sample(w: World) {
  const m = w.zones.map((_, i) => moistPct(w, i))
  w.history.push({
    t: w.t, moist: m, moistAvg: m.reduce((a, b) => a + b, 0) / 4, tAir: w.wx.tAir,
    tSoil: w.zones.reduce((a, z) => a + z.tSoil, 0) / 4, rh: w.wx.rh * 100, solar: w.wx.solar, rain: w.wx.rain,
    reservoirL: w.reservoir.L, flow: w.pump.flowLph, pumpOn: w.pump.on ? 1 : 0, kW: w.energy.loadKw,
    kWhCum: w.stats.kWh, waterCumL: w.stats.withdrawnL, dev: w.zones.map((z) => z.dev),
    vigor: w.zones.reduce((a, z) => a + z.vigor, 0) / 4,
  })
  if (w.history.length > 4000) w.history.shift()
  w.lastSample = w.t
}

function rollDay(w: World) {
  const ds = w.dayStart
  const s = w.stats
  const rec: DailyRec = {
    day: ds.day, waterL: s.withdrawnL - ds.stats.withdrawnL, pumpH: (s.pumpMin - ds.stats.pumpMin) / 60,
    irrigations: s.irrigations - ds.stats.irrigations, kWh: s.kWh - ds.stats.kWh, rainMm: s.rainMm - ds.stats.rainMm,
    etcMm: s.etcMm - ds.stats.etcMm, et0Mm: ds.et0, tMean: ds.n ? ds.tSum / ds.n : w.wx.tAir,
    moistAvg: s.steps - ds.stats.steps ? (s.moistSum - ds.stats.moistSum) / (s.steps - ds.stats.steps) : 0,
    alerts: w.nextAlertId - 1 - ds.alerts,
  }
  w.daily.push(rec)
  w.pump.runMinToday = 0
  w.dayStart = { stats: { ...s }, day: w.wx.day, alerts: w.nextAlertId - 1, et0: 0, tSum: 0, n: 0 }
}

export function step(w: World, dtMin: number): void {
  const cfg = w.cfg
  const dtH = dtMin / 60
  const soil = SOILS[cfg.soil]
  const F = w.faults
  w.t += dtMin
  w.wx = weatherAt(w.t, cfg)
  const wx = w.wx
  if (wx.day !== w.dayStart.day) rollDay(w)
  if (Math.floor(w.t / 60) !== Math.floor((w.t - dtMin) / 60)) w.forecastMm = rainForecast(w.t, cfg)
  w.ctl.et0Ema += (wx.et0 - w.ctl.et0Ema) * (1 - Math.exp(-dtH / 24))
  w.dayStart.et0 += wx.et0 * dtH
  w.dayStart.tSum += wx.tAir
  w.dayStart.n++

  const powerOK = !F.power
  updateSensors(w, dtMin)
  detectSuspects(w)

  // ---------- controle ----------
  const d = decide(w)
  let want = d.want
  let open = d.open
  w.pump.want = want
  const auto = cfg.mode === 'auto' || cfg.mode === 'smart' || cfg.mode === 'optimized'
  if (auto && powerOK && want !== w.pump.on && w.pump.dwellMin < 8 && w.reservoir.L > 1) {
    if (w.pump.on) { want = true; open = w.zones.map((z) => z.valveOpen) } else want = false
  }
  w.zones.forEach((z, i) => { z.valveOpen = powerOK && open[i]; z.clog = F.clog[i] })
  const anyOpen = w.zones.some((z) => z.valveOpen)

  // ---------- hidráulica ----------
  const P0 = cfg.pressureBar
  const canRun = want && powerOK && anyOpen && w.reservoir.L > 1
  const runs = canRun && !F.pumpFailure
  let Q = 0, leakLph = 0, pressure = 0, kw = 0
  w.zones.forEach((z) => (z.flowLph = 0))
  if (runs) {
    const totalPl = w.zones.reduce((a, z) => a + z.plants, 0)
    const wz = w.zones.map((z) => (z.valveOpen ? z.plants * (1 - z.clog) : 0))
    const sumW = wz.reduce((a, b) => a + b, 0)
    const effFrac = sumW / totalPl
    const openPl = w.zones.reduce((a, z) => a + (z.valveOpen ? z.plants : 0), 0)
    const clogFrac = openPl ? w.zones.reduce((a, z) => a + (z.valveOpen ? z.plants * z.clog : 0), 0) / openPl : 0
    Q = Math.min(cfg.pumpLph * (0.3 + 0.7 * effFrac), w.reservoir.L / dtH)
    leakLph = Q * F.leak
    const Qd = Q - leakLph
    w.zones.forEach((z, i) => (z.flowLph = sumW > 0 ? (Qd * wz[i]) / sumW : 0))
    pressure = P0 * (1.2 - 0.2 * effFrac) * (1 + 0.6 * clogFrac) * (1 - 1.2 * F.leak)
    const qr = Q / cfg.pumpLph
    const eta = Math.max(0.35, cfg.pumpEta * (1 - 0.8 * (qr - 0.85) ** 2))
    kw = ((Q / 1000) * pressure * 10.2) / (367 * eta)
  }
  const wasOn = w.pump.on
  w.pump.on = runs
  w.pump.flowLph = Q
  w.pump.leakLph = leakLph
  w.pump.pressure = pressure
  w.pump.powerKw = kw
  w.pump.dwellMin = runs !== wasOn ? 0 : w.pump.dwellMin + dtMin
  w.pump.noFlowMin = canRun && F.pumpFailure ? w.pump.noFlowMin + dtMin : 0
  w.pump.lowPressMin = runs && pressure < P0 * 0.78 ? w.pump.lowPressMin + dtMin : 0
  if (cfg.mode === 'optimized' && w.pump.lowPressMin >= 10) { w.ctl.leakLockUntil = w.t + 180; w.pump.lowPressMin = 0 }

  const withdrawn = Q * dtH
  if (cfg.mode === 'operator') w.ctl.opRemainingL = Math.max(0, w.ctl.opRemainingL - withdrawn)
  if (runs && !wasOn) w.irrLog.push({ start: w.t, end: null, volumeL: 0, zones: '' })
  const ev = w.irrLog[w.irrLog.length - 1]
  if (runs && ev && ev.end === null) {
    ev.volumeL += withdrawn
    const names = w.zones.filter((z) => z.valveOpen).map((z) => z.name)
    ev.zones = [...new Set([...ev.zones.split(''), ...names])].sort().join('')
  }
  if (!runs && wasOn && ev && ev.end === null) ev.end = w.t
  if (runs && !wasOn) w.stats.irrigations++

  // ---------- reservatório ----------
  const R = w.reservoir
  const evap = (R.cap / 1000 / 1.8) * wx.et0 * 0.9 * dtH
  let inflow = 0
  if (cfg.refill && !F.reservoirEmpty && powerOK && (R.L < R.cap * 0.3 || (R.refilling && R.L < R.cap * 0.85))) {
    R.refilling = true
    inflow = cfg.refillLph * dtH
  } else R.refilling = false
  R.L = clamp(R.L - withdrawn - evap + inflow, 0, R.cap)
  if (F.reservoirEmpty) R.L = 0
  w.stats.refillL += inflow

  // ---------- solo e plantas ----------
  const Zr = cfg.rootDepthM * 1000
  const thetaCrit = soil.thetaFC - cfg.depletionP * (soil.thetaFC - soil.thetaWP)
  let moistSum = 0
  w.zones.forEach((z) => {
    const kc = STAGES[stageIndex(z.dev)].kc * cfg.kcScale
    let ks = z.theta >= thetaCrit ? 1 : clamp((z.theta - soil.thetaWP) / (thetaCrit - soil.thetaWP), 0, 1)
    if (z.theta / soil.thetaS > 0.9) ks = Math.min(ks, 0.75)
    z.ks = ks
    const etc = wx.et0 * kc * ks * dtH
    const irrMm = (z.flowLph * dtH * cfg.effDrip) / z.areaM2
    const input = irrMm + wx.rain * dtH
    const infil = Math.max(0, Math.min(input, soil.ksat * dtH, (soil.thetaS - z.theta) * Zr))
    const runoff = input - infil
    let W = z.theta * Zr + infil
    const etAct = Math.min(etc, Math.max(0, W - soil.thetaWP * 0.7 * Zr))
    W -= etAct
    const exc = Math.max(0, W - soil.thetaFC * Zr)
    const drain = exc * (1 - Math.exp(-soil.drainK * dtH))
    W -= drain
    z.theta = W / Zr
    const sat = z.areaM2
    z.appliedL += z.flowLph * dtH
    z.etcMm += etAct
    z.drainMm += drain
    z.runoffMm += runoff
    w.stats.appliedL += irrMm * sat
    w.stats.lossSoilL += (drain + runoff) * sat
    w.stats.lossEffL += z.flowLph * dtH * (1 - cfg.effDrip)
    w.stats.etcMm += etAct / 4
    const ratio = z.theta / soil.thetaS
    const tau = 5 + 8 * ratio
    z.tSoil += (wx.tAir + 0.004 * wx.solar - 1.5 - z.tSoil) * (1 - Math.exp(-dtH / tau))
    const gdd = Math.max(0, wx.tAir - GDD_BASE) * (dtH / 24)
    z.dev = Math.min(100, z.dev + ((gdd * cfg.accel) / GDD_TOTAL) * 100 * (0.35 + 0.65 * ks))
    const heat = wx.tAir > 36 ? Math.max(0.4, 1 - 0.06 * (wx.tAir - 36)) : 1
    z.vigor += (100 * ks * heat - z.vigor) * (1 - Math.exp(-dtH / 72))
    if (ks < 0.8) { z.stressH += dtH; w.stats.stressHours += dtH / 4 }
    const pct = ratio * 100
    if (pct >= cfg.blockAbove) w.stats.overwetHours += dtH / 4
    else if (pct >= cfg.threshold) w.stats.inRangeHours += dtH / 4
    moistSum += pct / 4
  })

  // ---------- energia ----------
  const solarKw = cfg.panelsKwp * (wx.solar / 1000) * 0.8
  const active = w.sensors.filter((s) => s.status !== 'offline').length
  const load = powerOK ? 0.015 + 0.01 + 0.04 + 0.0006 * active + 0.004 * w.zones.filter((z) => z.valveOpen).length + kw : 0
  const solarUsed = powerOK ? Math.min(load, solarKw) : 0
  w.energy = { loadKw: load, solarKw, gridKw: load - solarUsed }
  w.stats.kWh += load * dtH
  w.stats.solarKWh += solarUsed * dtH
  w.stats.gridKWh += (load - solarUsed) * dtH

  const S = w.stats
  S.withdrawnL += withdrawn
  S.leakL += leakLph * dtH
  S.pumpMin += runs ? dtMin : 0
  w.pump.runMinToday += runs ? dtMin : 0
  S.rainMm += wx.rain * dtH
  S.moistSum += moistSum
  S.steps++
  if (want && powerOK && w.reservoir.L <= 1) S.dryRunMin += dtMin

  evalAlerts(w)
  if (w.t - w.lastSample >= 15) sample(w)
}

export function advance(w: World, simMin: number): void {
  let left = simMin
  while (left > 1e-6) {
    const dt = Math.min(5, left)
    step(w, dt)
    left -= dt
  }
}
