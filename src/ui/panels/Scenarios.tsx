import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getWorld } from '../../store/sim'
import { useResults } from '../../store/results'
import { SCENARIOS, savingVs } from '../../engine/scenarios'
import { PRESETS } from '../../engine/climate'
import { downloadCsv } from '../../engine/csv'

const tip = { contentStyle: { background: '#0e1822', border: '1px solid #22364a', fontSize: 12 } }
const ax = { stroke: '#7f96ab', fontSize: 11 }

export function scenariosCsv() {
  const { results } = useResults.getState()
  const ref = results[0]
  downloadCsv('smartfarm_cenarios.csv', [
    ['Cenário', 'Água retirada (m³)', 'Água aplicada ao solo (m³)', 'Perdas (m³)', 'Bomba (h)', 'Irrigações', 'Energia (kWh)', 'Estresse (h)', 'Umidade média (%)', 'Economia vs convencional (%)'],
    ...results.map((r) => [r.def.name, (r.withdrawnL / 1000).toFixed(1), (r.appliedL / 1000).toFixed(1), (r.lossL / 1000).toFixed(1), r.pumpH.toFixed(1), r.irrigations, r.kWh.toFixed(1), r.stressH.toFixed(0), r.avgMoist.toFixed(1), savingVs(ref, r).toFixed(1)]),
  ])
}

export default function Scenarios() {
  const { results, running, run, days: rd, label } = useResults()
  const [days, setDays] = useState(14)
  const cfg = getWorld().cfg
  const ref = results[0]
  const series = results.length ? results[0].series.map((_, i) => ({ d: results[0].series[i].t, ...Object.fromEntries(results.map((r) => [r.def.short, r.series[i]?.moist])) })) : []
  const water = results.map((r) => ({ n: r.def.short, agua: r.withdrawnL / 1000, perdas: r.lossL / 1000, fill: r.def.color }))
  const best = results.length ? [...results].sort((a, b) => a.withdrawnL - b.withdrawnL)[0] : null
  return (
    <div className="scroll">
      <h2>Cenários experimentais</h2>
      <p className="note">Cada cenário roda no motor sem falhas, com o mesmo clima ({PRESETS[cfg.preset].label}, {cfg.tempC} °C, chuva {cfg.rainMmH} mm/h), solo e propriedade configurados. Percentuais são calculados dos resultados — válidos apenas para estas condições simuladas.</p>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Período: <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} dias</option>)}</select></label>
          <button className="btn primary" disabled={running} onClick={() => run(getWorld().cfg, days, PRESETS[cfg.preset].label)}>{running ? 'Calculando…' : '▶ Executar os 5 cenários'}</button>
          {results.length > 0 && <button className="btn" onClick={scenariosCsv}>⬇ CSV</button>}
        </div>
      </div>
      <div className="charts">{SCENARIOS.map((s) => (
        <div key={s.id} className="card" style={{ borderLeft: `4px solid ${s.color}` }}><b>{s.id}. {s.name}</b><p className="note">{s.description}</p></div>
      ))}</div>
      {results.length > 0 && (
        <>
          <p className="note">Resultado: {rd} dias · clima "{label}".</p>
          <div className="card" style={{ overflow: 'auto' }}>
            <table>
              <thead><tr><th>Cenário</th><th>Água retirada</th><th>Perdas*</th><th>Bomba</th><th>Irrig.</th><th>Energia</th><th>Estresse</th><th>Umid. média</th><th>Δ água vs 1</th></tr></thead>
              <tbody>{results.map((r) => {
                const sv = savingVs(ref, r)
                return (
                  <tr key={r.def.id}><td style={{ color: r.def.color, fontWeight: 600 }}>{r.def.short}</td><td>{(r.withdrawnL / 1000).toFixed(0)} m³</td><td>{(r.lossL / 1000).toFixed(0)} m³</td><td>{r.pumpH.toFixed(1)} h</td><td>{r.irrigations}</td><td>{r.kWh.toFixed(0)} kWh</td><td>{r.stressH.toFixed(0)} h</td><td>{r.avgMoist.toFixed(0)}%</td><td>{r.def.id === 1 ? '—' : `${sv >= 0 ? '−' : '+'}${Math.abs(sv).toFixed(1)}%`}</td></tr>
                )
              })}</tbody>
            </table>
            <p className="note">*Perdas = drenagem + escoamento + ineficiência de aplicação + vazamento. "Estresse" = horas com Ks &lt; 0,8 (média dos setores). Economia só é válida se o estresse não aumentar.</p>
            {best && <p className="note"><b>Menor consumo nesta simulação:</b> {best.def.name} ({(best.withdrawnL / 1000).toFixed(0)} m³; {savingVs(ref, best).toFixed(1)}% menos que o convencional).</p>}
          </div>
          <div className="charts">
            <div className="card"><div className="chart-title">Água retirada e perdas (m³)</div><div style={{ height: 250 }}><ResponsiveContainer><BarChart data={water}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="n" {...ax} /><YAxis {...ax} width={40} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} /><Legend /><Bar dataKey="agua" name="Retirada" fill="#4aa8ff" /><Bar dataKey="perdas" name="Perdas" fill="#ff8a5a" /></BarChart></ResponsiveContainer></div></div>
            <div className="card"><div className="chart-title">Umidade média do solo (%)</div><div style={{ height: 250 }}><ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="d" {...ax} tickFormatter={(v) => `${Number(v).toFixed(0)}d`} /><YAxis {...ax} width={40} domain={[0, 100]} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} /><Legend />{results.map((r) => <Line key={r.def.id} dataKey={r.def.short} stroke={r.def.color} dot={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div></div>
            <div className="card"><div className="chart-title">Energia (kWh) e horas de bomba</div><div style={{ height: 250 }}><ResponsiveContainer><BarChart data={results.map((r) => ({ n: r.def.short, kWh: r.kWh, h: r.pumpH }))}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="n" {...ax} /><YAxis {...ax} width={40} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} /><Legend /><Bar dataKey="kWh" fill="#f5b83d" /><Bar dataKey="h" name="Bomba (h)" fill="#2ee6a0" /></BarChart></ResponsiveContainer></div></div>
          </div>
        </>
      )}
    </div>
  )
}
