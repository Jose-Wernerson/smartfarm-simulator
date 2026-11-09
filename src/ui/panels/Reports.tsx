import { useState } from 'react'
import { downloadCsv } from '../../engine/csv'
import { formatClock } from '../../engine/climate'
import { useResults } from '../../store/results'
import { savingVs } from '../../engine/scenarios'
import { dailyWithCurrent, dayHour, useWorld } from '../util'
import type { World } from '../../engine/types'

type Sec = 'daily' | 'monthly' | 'irr' | 'alerts' | 'sensors' | 'scen'

function monthly(w: World) {
  const d = dailyWithCurrent(w)
  const out: { mes: number; dias: number; agua: number; bomba: number; kWh: number; irrig: number; chuva: number }[] = []
  d.forEach((r) => {
    const m = Math.floor(r.day / 30)
    let o = out.find((x) => x.mes === m)
    if (!o) out.push((o = { mes: m, dias: 0, agua: 0, bomba: 0, kWh: 0, irrig: 0, chuva: 0 }))
    o.dias++; o.agua += r.waterL; o.bomba += r.pumpH; o.kWh += r.kWh; o.irrig += r.irrigations; o.chuva += r.rainMm
  })
  return out
}

export default function Reports() {
  const w = useWorld(1000)
  const [sec, setSec] = useState<Sec>('daily')
  const { results } = useResults()
  const daily = dailyWithCurrent(w)
  const T = (head: string[], rows: (string | number)[][], file: string) => (
    <div className="card" style={{ overflow: 'auto', maxHeight: '62vh' }}>
      <button className="btn sm" style={{ marginBottom: 8 }} onClick={() => downloadCsv(file, [head, ...rows])}>⬇ Exportar CSV</button>
      <table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
      {rows.length === 0 && <p className="note">Sem dados ainda — inicie a simulação.</p>}
    </div>
  )
  const S: [Sec, string][] = [['daily', 'Consumo diário'], ['monthly', 'Mensal'], ['irr', 'Histórico de irrigação'], ['alerts', 'Alertas'], ['sensors', 'Sensores'], ['scen', 'Cenários / economia']]
  return (
    <div className="scroll">
      <h2>Relatórios</h2>
      <div className="chips">{S.map(([k, l]) => <span key={k} className={`chip ${sec === k ? 'act' : ''}`} onClick={() => setSec(k)}>{l}</span>)}</div>
      {sec === 'daily' && T(['Dia', 'Água (m³)', 'Bomba (h)', 'Irrigações', 'Energia (kWh)', 'Chuva (mm)', 'ET₀ (mm)', 'ETc real (mm)', 'T média (°C)', 'Umid. média (%)'],
        daily.map((d) => [d.day + 1, (d.waterL / 1000).toFixed(1), d.pumpH.toFixed(2), d.irrigations, d.kWh.toFixed(1), d.rainMm.toFixed(1), d.et0Mm.toFixed(1), d.etcMm.toFixed(1), d.tMean.toFixed(1), d.moistAvg.toFixed(1)]), 'smartfarm_consumo_diario.csv')}
      {sec === 'monthly' && T(['Mês (30 d)', 'Dias simulados', 'Água (m³)', 'Bomba (h)', 'Irrigações', 'Energia (kWh)', 'Chuva (mm)'],
        monthly(w).map((m) => [m.mes + 1, m.dias, (m.agua / 1000).toFixed(1), m.bomba.toFixed(1), m.irrig, m.kWh.toFixed(1), m.chuva.toFixed(1)]), 'smartfarm_consumo_mensal.csv')}
      {sec === 'irr' && T(['Início', 'Fim', 'Duração (min)', 'Setores', 'Volume (m³)'],
        [...w.irrLog].reverse().map((e) => [formatClock(e.start), e.end ? formatClock(e.end) : 'em andamento', ((e.end ?? w.t) - e.start).toFixed(0), e.zones, (e.volumeL / 1000).toFixed(2)]), 'smartfarm_irrigacoes.csv')}
      {sec === 'alerts' && T(['Horário', 'Gravidade', 'Categoria', 'Local', 'Título', 'Descrição', 'Recomendação', 'Resolvido em'],
        [...w.alerts].reverse().map((a) => [formatClock(a.t), a.severity, a.category, a.location, a.title, a.description, a.recommendation, a.tEnd ? formatClock(a.tEnd) : 'ativo']), 'smartfarm_alertas.csv')}
      {sec === 'sensors' && T(['Instante', ...w.sensors.map((s) => `${s.id} (${s.unit})`)],
        w.history.slice(-96).reverse().map((h) => [dayHour(h.t), ...w.sensors.map((s) => { const p = s.history.find((x) => x.t === h.t); return p ? p.v.toFixed(2) : '—' })]), 'smartfarm_sensores.csv')}
      {sec === 'scen' && (results.length === 0 ? <div className="card note">Execute os cenários na aba "Cenários" para gerar o comparativo.</div> :
        T(['Cenário', 'Água (m³)', 'Bomba (h)', 'Energia (kWh)', 'Estresse (h)', 'Economia vs convencional (%)'],
          results.map((r) => [r.def.name, (r.withdrawnL / 1000).toFixed(1), r.pumpH.toFixed(1), r.kWh.toFixed(1), r.stressH.toFixed(0), r.def.id === 1 ? '—' : savingVs(results[0], r).toFixed(1)]), 'smartfarm_comparativo.csv'))}
      <p className="note">Consumo = água retirada do reservatório pela bomba. Economia estimada = comparação dentro das condições simuladas, não projeção real.</p>
    </div>
  )
}
