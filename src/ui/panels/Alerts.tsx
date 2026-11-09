import { useState } from 'react'
import type { AlertCategory, Severity } from '../../engine/types'
import { clock, dayHour, useWorld } from '../util'
import { formatClock } from '../../engine/climate'

const SEV: Severity[] = ['critical', 'warning', 'info']
const SL: Record<Severity, string> = { critical: 'Crítico', warning: 'Atenção', info: 'Info' }
const CATS: AlertCategory[] = ['Irrigação', 'Solo', 'Reservatório', 'Clima', 'Sensores', 'Hidráulica', 'Energia', 'Plantas']

export default function Alerts({ compact = false }: { compact?: boolean }) {
  const w = useWorld(500)
  const [sev, setSev] = useState<Severity | null>(null)
  const [cat, setCat] = useState<AlertCategory | null>(null)
  const [onlyActive, setOnlyActive] = useState(false)
  const list = [...w.alerts].reverse().filter((a) => (!sev || a.severity === sev) && (!cat || a.category === cat) && (!onlyActive || a.active))
  void clock
  return (
    <div className={compact ? '' : 'scroll'}>
      {!compact && <h2>Centro de notificações</h2>}
      <div className="chips">
        <span className={`chip ${!sev ? 'act' : ''}`} onClick={() => setSev(null)}>Todas</span>
        {SEV.map((s) => <span key={s} className={`chip ${sev === s ? 'act' : ''}`} onClick={() => setSev(sev === s ? null : s)}>{SL[s]} ({w.alerts.filter((a) => a.active && a.severity === s).length})</span>)}
        <span className={`chip ${onlyActive ? 'act' : ''}`} onClick={() => setOnlyActive(!onlyActive)}>Somente ativos</span>
      </div>
      {!compact && (
        <div className="chips">
          {CATS.map((c) => <span key={c} className={`chip ${cat === c ? 'act' : ''}`} onClick={() => setCat(cat === c ? null : c)}>{c}</span>)}
        </div>
      )}
      {list.length === 0 && <div className="note">Nenhum alerta {w.alerts.length ? 'com este filtro' : 'registrado ainda'}.</div>}
      {list.slice(0, compact ? 8 : 200).map((a) => (
        <div key={a.id} className={`alert ${a.severity} ${a.active ? '' : 'old'}`}>
          <h5><span className={`sev ${a.severity}`}>{SL[a.severity]}</span> {a.title}</h5>
          <p>{a.description}</p>
          <p className="note">🕒 {formatClock(a.t)}{a.tEnd ? ` → resolvido ${dayHour(a.tEnd)}` : ' · ATIVO'} · 📍 {a.location} · {a.category}</p>
          {a.active && <p className="rec">➜ {a.recommendation}</p>}
        </div>
      ))}
    </div>
  )
}
