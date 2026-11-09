import { useSim } from '../../store/sim'
import { MODE_LABEL, SOILS } from '../../engine/params'
import { PRESETS } from '../../engine/climate'
import type { ControlMode, SoilType, WeatherPreset } from '../../engine/types'
import { Ctl, Slider, useWorld } from '../util'
import { getWorld } from '../../store/sim'

export default function ConfigPanel() {
  const w = useWorld(120)
  const c = w.cfg
  const set = useSim((s) => s.setConfig)
  const setPreset = useSim((s) => s.setPreset)
  const layout = w.layout
  return (
    <>
      <h3>Controle da irrigação</h3>
      <Ctl label="Modo de operação" value="">
        <select value={c.mode} onChange={(e) => set({ mode: e.target.value as ControlMode })}>
          {(['manual', 'timer', 'auto', 'smart', 'optimized', 'operator'] as ControlMode[]).map((m) => (
            <option key={m} value={m}>{MODE_LABEL[m]}</option>
          ))}
        </select>
      </Ctl>
      {c.mode === 'manual' && (
        <div className="card" style={{ padding: 8 }}>
          <div className="grid2">
            <button className={`btn ${w.pump.cmd ? 'on' : ''}`} onClick={() => { getWorld().pump.cmd = !getWorld().pump.cmd; useSim.getState().bump() }}>Bomba {w.pump.cmd ? 'LIGADA' : 'desligada'}</button>
            {w.zones.map((z) => (
              <button key={z.index} className={`btn ${z.valveCmd ? 'on' : ''}`} onClick={() => { const zz = getWorld().zones[z.index]; zz.valveCmd = !zz.valveCmd; useSim.getState().bump() }}>
                Válvula {z.name}: {z.valveCmd ? 'aberta' : 'fechada'}
              </button>
            ))}
          </div>
          <p className="note">Bomba só opera com ao menos uma válvula aberta (intertravamento).</p>
        </div>
      )}
      {c.mode === 'timer' && (
        <>
          <Slider label="Início (hora)" v={c.timerStartH} min={0} max={23} step={1} on={(v) => set({ timerStartH: v })} unit="h" />
          <Slider label="Duração" v={c.timerDurMin} min={10} max={360} step={10} on={(v) => set({ timerDurMin: v })} unit=" min" />
        </>
      )}
      <Slider label="Limite de umidade p/ irrigar" v={c.threshold} min={15} max={70} step={1} unit="%" on={(v) => set({ threshold: v })} />
      <p className="note">Umidade = grau de saturação do solo (θ/θs). Faixas demonstrativas: &lt;35% baixa · 35–60% intermediária · 60–80% adequada · &gt;{c.blockAbove}% bloqueia irrigação.</p>

      <h3>Propriedade</h3>
      <Slider label="Área (reinicia)" v={c.areaM2} min={1000} max={30000} step={500} unit=" m²" on={(v) => set({ areaM2: v })} hint={`(${(c.areaM2 / 10000).toFixed(2)} ha)`} />
      <Slider label="Quantidade de plantas (reinicia)" v={c.plants} min={200} max={2500} step={50} on={(v) => set({ plants: v })} />
      <Slider label="Espaçamento entre plantas (reinicia)" v={c.spacing} min={1} max={4} step={0.25} unit=" m" on={(v) => set({ spacing: v })} dec={2} />
      <p className="note">Entrelinha derivada: {layout.rowSp.toFixed(2)} m · {layout.rows} linhas × {layout.ppr} plantas = {layout.plants.length} plantas reais.{layout.rowSp <= 2 || layout.rowSp >= 6 ? ' ⚠ densidade fora da faixa usual.' : ''}</p>
      <Ctl label="Tipo de solo" value="">
        <select value={c.soil} onChange={(e) => set({ soil: e.target.value as SoilType })}>
          {Object.entries(SOILS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </Ctl>
      <Slider label="Capacidade do reservatório" v={c.reservoirL} min={10000} max={200000} step={5000} unit=" L" on={(v) => set({ reservoirL: v })} />
      <Slider label="Vazão da bomba" v={c.pumpLph} min={4000} max={40000} step={1000} unit=" L/h" on={(v) => set({ pumpLph: v })} />

      <h3>Clima</h3>
      <Ctl label="Condição" value="">
        <select value={c.preset} onChange={(e) => setPreset(e.target.value as WeatherPreset)}>
          {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </Ctl>
      <Slider label="Intensidade da chuva" v={c.rainMmH} min={0} max={30} step={0.5} unit=" mm/h" on={(v) => set({ rainMmH: v })} />
      <Slider label="Temperatura ambiente (média)" v={c.tempC} min={10} max={40} step={0.5} unit=" °C" on={(v) => set({ tempC: v })} />
      <Slider label="Variação térmica diária" v={c.tempAmp} min={2} max={18} step={1} unit=" °C" on={(v) => set({ tempAmp: v })} />
      <Slider label="Intensidade solar" v={c.solarPct} min={20} max={120} step={5} unit="%" on={(v) => set({ solarPct: v })} />

      <h3>Hipóteses e opções</h3>
      <details>
        <summary>Hipóteses agronômicas/técnicas</summary>
        <p className="note">Valores demonstrativos, não recomendações agronômicas. Sem dados reais da propriedade.</p>
        <Slider label="Escala do Kc" v={c.kcScale} min={0.6} max={1.4} step={0.05} dec={2} on={(v) => set({ kcScale: v })} />
        <Slider label="Profundidade radicular" v={c.rootDepthM} min={0.15} max={0.8} step={0.05} unit=" m" dec={2} on={(v) => set({ rootDepthM: v })} />
        <Slider label="Fração de depleção p" v={c.depletionP} min={0.3} max={0.8} step={0.05} dec={2} on={(v) => set({ depletionP: v })} />
        <Slider label="Eficiência de aplicação" v={c.effDrip} min={0.5} max={0.98} step={0.01} dec={2} on={(v) => set({ effDrip: v })} />
        <Slider label="Histerese (modo automático)" v={c.band} min={3} max={25} step={1} unit=" pp" on={(v) => set({ band: v })} />
        <Slider label="Bloquear irrigação acima de" v={c.blockAbove} min={70} max={98} step={1} unit="%" on={(v) => set({ blockAbove: v })} />
        <Slider label="Ruído dos sensores" v={c.noiseLevel} min={0} max={4} step={0.25} unit="×" dec={2} on={(v) => set({ noiseLevel: v })} />
        <Slider label="Aceleração do desenvolvimento" v={c.accel} min={1} max={40} step={1} unit="×" on={(v) => set({ accel: v })} />
        <Slider label="Desenvolvimento inicial (reinicia)" v={c.startDev} min={0} max={85} step={5} unit="%" on={(v) => set({ startDev: v })} />
        <Slider label="Umidade inicial (reinicia)" v={c.startMoisture} min={25} max={90} step={1} unit="%" on={(v) => set({ startMoisture: v })} />
        <Slider label="Pressão nominal" v={c.pressureBar} min={1} max={4} step={0.1} unit=" bar" on={(v) => set({ pressureBar: v })} />
        <Slider label="Previsão de chuva p/ adiar irrigação" v={c.rainSkipMm} min={1} max={15} step={1} unit=" mm" on={(v) => set({ rainSkipMm: v })} />
      </details>
      <details>
        <summary>Reposição de água e energia</summary>
        <Ctl label="Reposição automática (poço)" value={c.refill ? 'ligada' : 'desligada'}>
          <input type="checkbox" checked={c.refill} onChange={(e) => set({ refill: e.target.checked })} />
        </Ctl>
        <Slider label="Vazão de reposição" v={c.refillLph} min={1000} max={30000} step={1000} unit=" L/h" on={(v) => set({ refillLph: v })} />
        <Slider label="Painéis solares" v={c.panelsKwp} min={0} max={5} step={0.5} unit=" kWp" on={(v) => set({ panelsKwp: v })} />
      </details>
    </>
  )
}
