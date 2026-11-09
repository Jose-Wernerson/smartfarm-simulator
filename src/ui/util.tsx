import { useEffect, useState, type ReactNode } from 'react'
import { getWorld, useSim } from '../store/sim'
import type { DailyRec, World } from '../engine/types'
import { formatClock } from '../engine/climate'

/** Mundo + re-render limitado a `ms`. */
export function useWorld(ms = 250): World {
  const rev = useSim((s) => s.rev)
  const [snap, setSnap] = useState(rev)
  useEffect(() => {
    const id = window.setTimeout(() => setSnap(rev), ms)
    return () => clearTimeout(id)
  }, [rev, ms])
  void snap
  return getWorld()
}

export const clock = (w: World) => formatClock(w.t)
export const dayHour = (t: number) => `D${Math.floor(t / 1440) + 1} ${String(Math.floor((t % 1440) / 60)).padStart(2, '0')}h`

export function dailyWithCurrent(w: World): DailyRec[] {
  const ds = w.dayStart
  const s = w.stats
  const cur: DailyRec = {
    day: ds.day, waterL: s.withdrawnL - ds.stats.withdrawnL, pumpH: (s.pumpMin - ds.stats.pumpMin) / 60,
    irrigations: s.irrigations - ds.stats.irrigations, kWh: s.kWh - ds.stats.kWh, rainMm: s.rainMm - ds.stats.rainMm,
    etcMm: s.etcMm - ds.stats.etcMm, et0Mm: ds.et0, tMean: ds.n ? ds.tSum / ds.n : w.wx.tAir,
    moistAvg: s.steps - ds.stats.steps ? (s.moistSum - ds.stats.moistSum) / (s.steps - ds.stats.steps) : 0,
    alerts: w.nextAlertId - 1 - ds.alerts,
  }
  return [...w.daily, cur]
}

export function Ctl(p: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="ctl">
      <label>
        <span>{p.label}</span>
        <b>{p.value}</b>
      </label>
      {p.children}
    </div>
  )
}

export function Slider(p: { label: string; unit?: string; v: number; min: number; max: number; step: number; on: (v: number) => void; dec?: number; hint?: string }) {
  return (
    <Ctl label={p.label + (p.hint ? ` ${p.hint}` : '')} value={`${p.v.toFixed(p.dec ?? (p.step < 1 ? 1 : 0))}${p.unit ?? ''}`}>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.v} onChange={(e) => p.on(Number(e.target.value))} />
    </Ctl>
  )
}

export function Kpi(p: { label: string; value: string; unit?: string; state?: 'ok' | 'warn' | 'crit' | 'info' | 'off'; pct?: number; sub?: string }) {
  return (
    <div className={`kpi ${p.state ?? 'ok'}`}>
      <small>{p.label}</small>
      <strong>
        {p.value}
        {p.unit && <em>{p.unit}</em>}
      </strong>
      {p.sub && <small>{p.sub}</small>}
      {p.pct !== undefined && (
        <div className="bar">
          <i style={{ width: `${Math.max(0, Math.min(100, p.pct))}%`, background: p.state === 'crit' ? 'var(--crit)' : p.state === 'warn' ? 'var(--warn)' : p.state === 'info' ? 'var(--info)' : 'var(--ok)' }} />
        </div>
      )}
    </div>
  )
}
