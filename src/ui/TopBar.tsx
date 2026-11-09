import { useSim } from '../store/sim'
import { clock, useWorld } from './util'
import { startDemo } from './panels/Demo'
import type { Tab } from '../store/sim'

const SPEEDS = [
  { v: 60, l: '1 min/s' },
  { v: 300, l: '5 min/s' },
  { v: 900, l: '15 min/s' },
  { v: 3600, l: '1 h/s' },
  { v: 14400, l: '4 h/s' },
]
export const TABS: [Tab, string][] = [['3d', '🌱 Propriedade 3D'], ['charts', '📈 Gráficos'], ['alerts', '🔔 Alertas'], ['scenarios', '🧪 Cenários'], ['faults', '⚠ Falhas'], ['reports', '📄 Relatórios'], ['phone', '📱 Celular'], ['demo', '🎓 Apresentação']]

export default function TopBar() {
  const w = useWorld(300)
  const { running, speed, setRunning, setSpeed, reset, tab, setTab, setPanel, leftOpen, rightOpen } = useSim()
  const crit = w.alerts.filter((a) => a.active && a.severity === 'critical').length
  const warn = w.alerts.filter((a) => a.active && a.severity === 'warning').length
  const status = crit ? { t: 'Crítico', c: 'crit' } : warn ? { t: 'Atenção', c: 'warn' } : { t: 'Normal', c: '' }
  const active = w.sensors.filter((s) => s.status !== 'offline').length
  const conn = active === w.sensors.length ? '' : active === 0 ? 'crit' : 'warn'
  return (
    <>
      <div className="top">
        <button className="btn sm mobile-toggle" onClick={() => setPanel('left', !leftOpen)}>⚙ Config</button>
        <div className="logo">
          <div className="logo-mark">🌿</div>
          <div><span>Smart<b>Farm</b> Simulator <small style={{ display: 'inline' }}>1.0</small></span><small>Plantio inteligente. Água consciente. Agricultura conectada.</small></div>
        </div>
        <span className="pill"><span className={`dot ${status.c}`} /> Propriedade: {status.t}</span>
        <span className="pill"><span className={`dot ${conn}`} /> Sensores {active}/{w.sensors.length}</span>
        <span className="spacer" />
        <span className="clock">🕒 {clock(w)}</span>
        <button className={`btn ${running ? '' : 'primary'}`} onClick={() => setRunning(!running)}>{running ? '⏸ Pausar' : '▶ Iniciar'}</button>
        <button className="btn" onClick={reset}>↺ Reiniciar</button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Velocidade da simulação">
          {SPEEDS.map((s) => <option key={s.v} value={s.v}>⏩ {s.l}</option>)}
        </select>
        <button className="btn sm" onClick={startDemo}>🎓 Demo</button>
        <button className="btn sm mobile-toggle" onClick={() => setPanel('right', !rightOpen)}>📊 Monitor</button>
      </div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'act' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
    </>
  )
}
