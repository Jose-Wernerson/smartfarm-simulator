import { useState } from 'react'
import { Area, AreaChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getWorld, useSim } from '../../store/sim'
import { MODE_LABEL } from '../../engine/params'
import { moistPct } from '../../engine/sim'
import { clock, Kpi, useWorld } from '../util'
import Alerts from './Alerts'
import type { ControlMode } from '../../engine/types'

type P = 'home' | 'sensors' | 'irrig' | 'alerts' | 'graphs'

export default function Phone() {
  const w = useWorld(300)
  const bump = useSim((s) => s.bump)
  const [p, setP] = useState<P>('home')
  const c = w.cfg
  const lvl = (w.reservoir.L / w.reservoir.cap) * 100
  const act = w.alerts.filter((a) => a.active)
  const setMode = (m: ControlMode) => { getWorld().cfg.mode = m; bump() }
  const manualToggle = () => {
    const x = getWorld()
    x.cfg.mode = 'manual'
    x.pump.cmd = !x.pump.cmd
    if (x.pump.cmd && !x.zones.some((z) => z.valveCmd)) x.zones.forEach((z) => (z.valveCmd = true))
    bump()
  }
  const data = w.history.slice(-96).map((h) => ({ t: h.t, m: h.moistAvg, r: h.reservoirL / 1000 }))
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="sb"><span>{clock(w).split(' · ')[1]}</span><span>SmartFarm · 4G ▂▄▆</span></div>
        <div className="body">
          {p === 'home' && (
            <>
              <div className="hero"><b>Maracujá · {(c.areaM2 / 10000).toFixed(2)} ha</b><br /><small>{act.length ? `${act.length} alerta(s) ativo(s)` : 'Tudo normal'} · {clock(w)}</small></div>
              <div className="grid2">
                <Kpi label="Umidade média" value={(w.zones.reduce((a, _, i) => a + moistPct(w, i), 0) / 4).toFixed(0)} unit="%" state="info" />
                <Kpi label="Reservatório" value={lvl.toFixed(0)} unit="%" state={lvl < 20 ? 'warn' : 'ok'} pct={lvl} />
                <Kpi label="Temp. ar" value={w.wx.tAir.toFixed(1)} unit="°C" state="info" />
                <Kpi label="Bomba" value={w.pump.on ? 'LIGADA' : 'Desligada'} state={w.pump.on ? 'ok' : 'off'} />
              </div>
              <button className={`bigbtn ${w.pump.on ? 'on' : ''}`} style={{ marginTop: 12 }} onClick={manualToggle}>{w.pump.cmd && c.mode === 'manual' ? '⏻ Desligar irrigação' : '⏻ Ligar irrigação (manual)'}</button>
              <p className="note">Comandos simulados — nenhum hardware real é controlado.</p>
            </>
          )}
          {p === 'sensors' && w.sensors.map((s) => (
            <div key={s.id} className="row" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
              <span>{s.label}<br /><small className="note">🔋{s.battery.toFixed(0)}% · 📶{s.signal.toFixed(0)}%</small></span>
              <b style={{ color: s.status === 'offline' ? 'var(--mut)' : s.suspect ? 'var(--warn)' : undefined }}>{s.value === null ? 'offline' : `${s.value.toFixed(1)} ${s.unit}`}</b>
            </div>
          ))}
          {p === 'irrig' && (
            <>
              <select style={{ width: '100%', marginBottom: 10 }} value={c.mode} onChange={(e) => setMode(e.target.value as ControlMode)}>
                {(['manual', 'timer', 'auto', 'smart', 'optimized'] as ControlMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
              </select>
              <button className={`bigbtn ${c.mode === 'smart' ? 'on' : ''}`} onClick={() => setMode('smart')}>🤖 Modo inteligente</button>
              <button className={`bigbtn ${c.mode === 'auto' ? 'on' : ''}`} style={{ marginTop: 8 }} onClick={() => setMode('auto')}>🌱 Modo automático</button>
              <button className={`bigbtn ${w.pump.on ? 'on' : ''}`} style={{ marginTop: 8 }} onClick={manualToggle}>💧 Irrigar agora (manual)</button>
              {w.zones.map((z) => <div className="row" key={z.index}><span>Setor {z.name}</span><b>{moistPct(w, z.index).toFixed(0)}% · {z.valveOpen ? 'irrigando' : 'parado'}</b></div>)}
            </>
          )}
          {p === 'alerts' && <Alerts compact />}
          {p === 'graphs' && (
            <>
              <b>Umidade média (%)</b>
              <div style={{ height: 130 }}><ResponsiveContainer><LineChart data={data}><XAxis dataKey="t" hide /><YAxis hide domain={[0, 100]} /><Line dataKey="m" stroke="#2ee6a0" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
              <b>Reservatório (m³)</b>
              <div style={{ height: 130 }}><ResponsiveContainer><AreaChart data={data}><XAxis dataKey="t" hide /><YAxis hide domain={[0, w.reservoir.cap / 1000]} /><Area dataKey="r" stroke="#4aa8ff" fill="#4aa8ff44" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
            </>
          )}
        </div>
        <div className="nav">
          {([['home', '🏠', 'Início'], ['sensors', '📡', 'Sensores'], ['irrig', '💧', 'Irrigação'], ['alerts', '🔔', 'Alertas'], ['graphs', '📈', 'Gráficos']] as [P, string, string][]).map(([k, i, l]) => (
            <button key={k} className={p === k ? 'act' : ''} onClick={() => setP(k)}>{i}<br />{l}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
