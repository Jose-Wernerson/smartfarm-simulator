import { getWorld, useSim } from '../../store/sim'
import { emptyFaults } from '../../engine/sim'
import { useWorld } from '../util'
import type { Faults as F } from '../../engine/types'

export default function Faults() {
  const w = useWorld(250)
  const bump = useSim((s) => s.bump)
  const f = getWorld().faults
  const upd = (fn: (f: F) => void) => { fn(getWorld().faults); bump() }
  const sm = w.sensors.filter((s) => s.type === 'soilMoisture')
  const Card = (p: { title: string; desc: string; on: boolean; toggle: () => void; extra?: React.ReactNode }) => (
    <div className="card">
      <b>{p.title}</b>
      <p className="note">{p.desc}</p>
      {p.extra}
      <button className={`btn ${p.on ? 'danger' : ''}`} onClick={p.toggle}>{p.on ? 'Restaurar' : 'Provocar falha'}</button>
    </div>
  )
  return (
    <div className="scroll">
      <h2>Simulador de falhas</h2>
      <p className="note">Provoque problemas e observe detecção, alertas e consequências (3D, gráficos e alertas). O modo de controle ativo influencia a reação: compare Automático × Otimizado.</p>
      <div className="faultgrid">
        <Card title="Sensor desconectado" desc={`Sensor de umidade do Setor A sai do ar (${sm[0]?.id}).`} on={!!f.offline[sm[0]?.id]} toggle={() => upd((x) => { x.offline[sm[0].id] = !x.offline[sm[0].id] })} />
        <Card title="Sensor com leitura incorreta" desc="Sensor do Setor B trava em ~7% (solo falsamente seco). Em modos por sensores causa irrigação desnecessária — exceto no modo otimizado (validação cruzada)." on={!!f.wrong[sm[1]?.id]} toggle={() => upd((x) => { x.wrong[sm[1].id] = !x.wrong[sm[1].id] })} />
        <Card title="Bomba com falha" desc="Comando liga mas não há vazão." on={f.pumpFailure} toggle={() => upd((x) => { x.pumpFailure = !x.pumpFailure })} />
        <Card title="Vazamento na tubulação" desc={`Perda de ${(f.leak * 100 || 25).toFixed(0)}% da vazão com queda de pressão.`} on={f.leak > 0}
          extra={<select value={f.leakZone} onChange={(e) => upd((x) => { x.leakZone = Number(e.target.value) })}><option value={4}>Tubulação principal</option>{'ABCD'.split('').map((n, i) => <option key={n} value={i}>Setor {n}</option>)}</select>}
          toggle={() => upd((x) => { x.leak = x.leak > 0 ? 0 : 0.25 })} />
        <Card title="Reservatório vazio" desc="Esvazia o reservatório e bloqueia a reposição." on={f.reservoirEmpty} toggle={() => upd((x) => { x.reservoirEmpty = !x.reservoirEmpty })} />
        <Card title="Falha elétrica" desc="Bomba, válvulas, controlador e gateway sem energia." on={f.power} toggle={() => upd((x) => { x.power = !x.power })} />
        <Card title="Falta de comunicação" desc="Gateway perde contato com todos os sensores." on={f.comms} toggle={() => upd((x) => { x.comms = !x.comms })} />
        <Card title="Gotejador obstruído (Setor C)" desc="60% dos gotejadores obstruídos: menos vazão no setor e pressão elevada." on={f.clog[2] > 0} toggle={() => upd((x) => { x.clog[2] = x.clog[2] > 0 ? 0 : 0.6 })} />
      </div>
      <button className="btn" style={{ marginTop: 10 }} onClick={() => upd((x) => Object.assign(x, emptyFaults()))}>Restaurar tudo</button>
    </div>
  )
}
