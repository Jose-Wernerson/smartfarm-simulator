import { moistPct } from '../../engine/sim'
import { STAGES, stageIndex } from '../../engine/params'
import { Kpi, useWorld } from '../util'

export function monitorData() {
  return null
}

export default function MonitorPanel() {
  const w = useWorld(250)
  const c = w.cfg
  const m = w.zones.map((_, i) => moistPct(w, i))
  const avg = m.reduce((a, b) => a + b, 0) / 4
  const mState = avg < c.threshold - 4 ? 'crit' : avg < c.threshold ? 'warn' : avg >= c.blockAbove ? 'info' : 'ok'
  const tSoil = w.zones.reduce((a, z) => a + z.tSoil, 0) / 4
  const lvl = (w.reservoir.L / w.reservoir.cap) * 100
  const active = w.sensors.filter((s) => s.status !== 'offline').length
  const ks = w.zones.reduce((a, z) => a + z.ks, 0) / 4
  const minKs = Math.min(...w.zones.map((z) => z.ks))
  const health = minKs < 0.5 ? 'Estresse severo' : minKs < 0.75 ? 'Estresse hídrico' : minKs < 0.92 ? 'Atenção' : 'Saudável'
  const hState = minKs < 0.5 ? 'crit' : minKs < 0.75 ? 'warn' : minKs < 0.92 ? 'info' : 'ok'
  const pumpState = w.faults.pumpFailure && w.pump.want ? 'crit' : w.pump.on ? 'ok' : w.faults.power ? 'crit' : 'off'
  const pumpTxt = w.faults.pumpFailure && w.pump.want ? 'FALHA' : w.pump.on ? 'LIGADA' : w.faults.power ? 'SEM ENERGIA' : 'Desligada'
  const water = w.stats.withdrawnL
  const dayWater = water - w.dayStart.stats.withdrawnL
  const st = stageIndex(w.zones.reduce((a, z) => a + z.dev, 0) / 4)
  return (
    <>
      <h3>Solo e clima</h3>
      <div className="grid2">
        <Kpi label="Umidade média do solo" value={avg.toFixed(1)} unit="%" state={mState} pct={avg} />
        <Kpi label="Temp. do solo" value={tSoil.toFixed(1)} unit="°C" state="info" />
        <Kpi label="Temp. do ar" value={w.wx.tAir.toFixed(1)} unit="°C" state={w.wx.tAir > 38 ? 'crit' : w.wx.tAir > 35 ? 'warn' : 'ok'} />
        <Kpi label="Umidade do ar" value={(w.wx.rh * 100).toFixed(0)} unit="%" state="info" pct={w.wx.rh * 100} />
        <Kpi label="Luminosidade" value={(w.wx.solar * 0.12).toFixed(0)} unit="klux" state="info" sub={`${w.wx.solar.toFixed(0)} W/m²`} />
        <Kpi label="Chuva" value={w.wx.rain.toFixed(1)} unit="mm/h" state={w.wx.rain > 0.1 ? 'info' : 'off'} sub={`ET₀ ${(w.wx.et0 * 1).toFixed(2)} mm/h`} />
      </div>
      <div className="card" style={{ marginTop: 8, padding: 8 }}>
        {w.zones.map((z, i) => (
          <div className="row" key={i}>
            <span>Setor {z.name} {z.valveOpen ? '💧' : ''}</span>
            <b style={{ color: m[i] < c.threshold ? 'var(--crit)' : m[i] >= c.blockAbove ? 'var(--info)' : 'var(--ok)' }}>{m[i].toFixed(1)}% · Ks {z.ks.toFixed(2)}</b>
          </div>
        ))}
      </div>
      <h3>Água e bomba</h3>
      <div className="grid2">
        <Kpi label="Estado da bomba" value={pumpTxt} state={pumpState} sub={w.pump.on ? `${(w.pump.flowLph / 1000).toFixed(1)} m³/h · ${w.pump.pressure.toFixed(2)} bar` : `Modo: ${c.mode}`} />
        <Kpi label="Reservatório" value={(w.reservoir.L / 1000).toFixed(1)} unit="m³" state={lvl < 8 ? 'crit' : lvl < 20 ? 'warn' : 'ok'} pct={lvl} sub={`${lvl.toFixed(0)}%${w.reservoir.refilling ? ' · repondo' : ''}`} />
        <Kpi label="Consumo hoje" value={(dayWater / 1000).toFixed(1)} unit="m³" state="info" />
        <Kpi label="Consumo acumulado" value={(water / 1000).toFixed(1)} unit="m³" state="info" />
        <Kpi label="Potência" value={w.energy.loadKw.toFixed(2)} unit="kW" state={w.energy.loadKw > 0 ? 'ok' : 'off'} sub={`${w.stats.kWh.toFixed(1)} kWh acum.`} />
        <Kpi label="Sensores ativos" value={`${active}/${w.sensors.length}`} state={active === w.sensors.length ? 'ok' : active > w.sensors.length / 2 ? 'warn' : 'crit'} pct={(active / w.sensors.length) * 100} />
      </div>
      <h3>Plantas</h3>
      <Kpi label="Estado geral" value={health} state={hState} sub={`Ks médio ${ks.toFixed(2)} · estágio médio: ${STAGES[st].name}`} />
      <div className="card" style={{ marginTop: 8, padding: 8 }}>
        {w.zones.map((z) => (
          <div className="row" key={z.index}>
            <span>Setor {z.name}</span>
            <b>{STAGES[stageIndex(z.dev)].name} · {z.dev.toFixed(0)}%</b>
          </div>
        ))}
      </div>
      <p className="note">Plantas: {w.layout.plants.length} · Previsão simulada 6 h: {w.forecastMm.toFixed(1)} mm</p>
    </>
  )
}
