import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSim } from '../../store/sim'
import { getWorld } from '../../store/sim'
import { STAGES, stageIndex } from '../../engine/params'
import { moistPct } from '../../engine/sim'
import { dayHour, useWorld } from '../util'

export default function DetailCard() {
  const w = useWorld(250)
  const sel = useSim((s) => s.selected)
  const select = useSim((s) => s.select)
  const bump = useSim((s) => s.bump)
  if (!sel) return null
  const close = <button className="btn sm" style={{ float: 'right' }} onClick={() => select(null)}>✕</button>
  if (sel.kind === 'sensor') {
    const s = w.sensors.find((x) => x.id === sel.id)
    if (!s) return null
    const F = getWorld().faults
    return (
      <div className="info-card">
        {close}
        <h4>{s.id}</h4>
        <div className="note">{s.label}</div>
        <div className="row"><span>Valor atual</span><b>{s.value === null ? 'sem leitura' : `${s.value.toFixed(2)} ${s.unit}`}</b></div>
        <div className="row"><span>Status</span><b>{s.status === 'ok' ? 'Operando' : s.status === 'lowbat' ? 'Bateria baixa' : 'Sem comunicação'}{s.suspect ? ' · leitura suspeita' : ''}</b></div>
        <div className="row"><span>Bateria</span><b>{s.battery.toFixed(0)}%</b></div>
        <div className="row"><span>Sinal</span><b>{s.signal.toFixed(0)}%</b></div>
        <div className="row"><span>Localização</span><b>{s.zone >= 0 ? `Setor ${'ABCD'[s.zone]} · ` : ''}({s.pos[0].toFixed(0)}, {s.pos[1].toFixed(0)}) m</b></div>
        <div style={{ height: 120, marginTop: 6 }}>
          <ResponsiveContainer>
            <LineChart data={s.history.map((h) => ({ t: h.t, v: h.v }))}>
              <XAxis dataKey="t" tickFormatter={dayHour} stroke="#7f96ab" fontSize={10} minTickGap={30} />
              <YAxis stroke="#7f96ab" fontSize={10} width={34} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(t) => dayHour(Number(t))} contentStyle={{ background: '#0e1822', border: '1px solid #22364a' }} />
              <Line dataKey="v" stroke="#2ee6a0" dot={false} isAnimationActive={false} strokeWidth={1.6} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="note">Histórico (~2 dias simulados, 15 min).</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => { F.offline[s.id] = !F.offline[s.id]; bump() }}>{F.offline[s.id] ? 'Reconectar' : 'Desconectar'}</button>
          <button className="btn sm" onClick={() => { F.wrong[s.id] = !F.wrong[s.id]; bump() }}>{F.wrong[s.id] ? 'Corrigir leitura' : 'Leitura incorreta'}</button>
        </div>
      </div>
    )
  }
  if (sel.kind === 'plant') {
    const p = w.layout.plants[Number(sel.id)]
    if (!p) return null
    const z = w.zones[p.zone]
    const dev = Math.max(0, Math.min(100, z.dev + p.off))
    const st = STAGES[stageIndex(dev)]
    return (
      <div className="info-card">
        {close}
        <h4>Maracujazeiro #{Number(sel.id) + 1}</h4>
        <div className="row"><span>Setor / linha</span><b>{z.name} / {p.row + 1}</b></div>
        <div className="row"><span>Estágio</span><b>{st.name}</b></div>
        <div className="row"><span>Desenvolvimento</span><b>{dev.toFixed(0)}%</b></div>
        <div className="row"><span>Kc do estágio (hipótese)</span><b>{(st.kc * w.cfg.kcScale).toFixed(2)}</b></div>
        <div className="row"><span>Coef. de estresse Ks</span><b>{z.ks.toFixed(2)}</b></div>
        <div className="row"><span>Vigor (índice)</span><b>{z.vigor.toFixed(0)}</b></div>
        <div className="row"><span>Umidade do setor</span><b>{moistPct(w, p.zone).toFixed(1)}%</b></div>
        <div className="row"><span>Horas sob estresse (setor)</span><b>{z.stressH.toFixed(0)} h</b></div>
      </div>
    )
  }
  if (sel.kind === 'zone') {
    const z = w.zones[Number(sel.id)]
    return (
      <div className="info-card">
        {close}
        <h4>Setor {z.name}</h4>
        <div className="row"><span>Umidade</span><b>{moistPct(w, z.index).toFixed(1)}%</b></div>
        <div className="row"><span>Temp. do solo</span><b>{z.tSoil.toFixed(1)} °C</b></div>
        <div className="row"><span>Plantas</span><b>{z.plants}</b></div>
        <div className="row"><span>Área</span><b>{z.areaM2.toFixed(0)} m²</b></div>
        <div className="row"><span>Válvula</span><b>{z.valveOpen ? 'aberta' : 'fechada'}</b></div>
        <div className="row"><span>Vazão aplicada</span><b>{z.flowLph.toFixed(0)} L/h</b></div>
        <div className="row"><span>Água aplicada (acum.)</span><b>{(z.appliedL / 1000).toFixed(1)} m³</b></div>
        <div className="row"><span>Drenagem / escoamento</span><b>{z.drainMm.toFixed(0)} / {z.runoffMm.toFixed(0)} mm</b></div>
        {w.cfg.mode === 'manual' && <button className="btn sm" onClick={() => { z.valveCmd = !z.valveCmd; bump() }}>{z.valveCmd ? 'Fechar válvula' : 'Abrir válvula'}</button>}
      </div>
    )
  }
  if (sel.kind === 'tank') {
    return (
      <div className="info-card">
        {close}
        <h4>Reservatório</h4>
        <div className="row"><span>Volume</span><b>{w.reservoir.L.toFixed(0)} / {w.reservoir.cap} L</b></div>
        <div className="row"><span>Reposição</span><b>{w.reservoir.refilling ? 'em andamento' : 'inativa'}</b></div>
        <div className="row"><span>Retirado (acum.)</span><b>{(w.stats.withdrawnL / 1000).toFixed(1)} m³</b></div>
        <div className="row"><span>Reposto (acum.)</span><b>{(w.stats.refillL / 1000).toFixed(1)} m³</b></div>
      </div>
    )
  }
  return (
    <div className="info-card">
      {close}
      <h4>Bomba hidráulica</h4>
      <div className="row"><span>Estado</span><b>{w.pump.on ? 'ligada' : 'desligada'}</b></div>
      <div className="row"><span>Vazão</span><b>{w.pump.flowLph.toFixed(0)} L/h</b></div>
      <div className="row"><span>Pressão</span><b>{w.pump.pressure.toFixed(2)} bar</b></div>
      <div className="row"><span>Potência</span><b>{w.pump.powerKw.toFixed(2)} kW</b></div>
      <div className="row"><span>Funcionamento (acum.)</span><b>{(w.stats.pumpMin / 60).toFixed(1)} h</b></div>
      <div className="row"><span>Vazamento</span><b>{w.pump.leakLph.toFixed(0)} L/h</b></div>
    </div>
  )
}
