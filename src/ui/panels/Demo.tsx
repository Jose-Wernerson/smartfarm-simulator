import { useEffect } from 'react'
import { getWorld, replaceWorld, useSim } from '../../store/sim'
import { useDemo } from '../../store/demo'
import { useResults } from '../../store/results'
import { DEFAULT_CONFIG } from '../../engine/params'
import { PRESETS } from '../../engine/climate'
import { savingVs } from '../../engine/scenarios'
import { moistPct } from '../../engine/sim'

interface Step {
  title: string
  text: (() => string) | string
  enter: () => void
  done: () => boolean
}
const elapsed = () => getWorld().t - useDemo.getState().enterT
const avgM = () => { const w = getWorld(); return w.zones.reduce((a, _, i) => a + moistPct(w, i), 0) / 4 }
const minM = () => { const w = getWorld(); return Math.min(...w.zones.map((_, i) => moistPct(w, i))) }

const droughtCfg = () => ({ ...DEFAULT_CONFIG, preset: 'drought' as const, rainMmH: 0, tempC: 28, mode: 'smart' as const, startMoisture: 52 })

const STEPS: Step[] = [
  { title: '1. Visão geral da propriedade', text: 'Esta é uma propriedade de maracujá com 4 setores de irrigação, reservatório, bomba, sensores de solo e uma estação meteorológica. Cada ponto verde é um sensor IoT enviando dados em tempo real simulado.',
    enter: () => { replaceWorld({ ...droughtCfg(), preset: 'sunny' }); const s = useSim.getState(); s.setView('persp'); s.setTab('3d'); s.setSpeed(900); s.setRunning(true) }, done: () => elapsed() > 4 * 60 },
  { title: '2. Chega o período seco', text: 'Ativamos um período de seca com calor: o sol aquece, o ar fica seco e a evapotranspiração aumenta. A umidade do solo começa a cair — os sensores acompanham isso.',
    enter: () => { const s = useSim.getState(); s.setPreset('drought'); s.setConfig({ tempC: 28 }); s.setSpeed(3600); s.setRunning(true) }, done: () => minM() < getWorld().cfg.threshold + 2 || elapsed() > 8 * 1440 },
  { title: '3. Irrigação inteligente entra em ação', text: () => `A umidade chegou perto do limite (${getWorld().cfg.threshold}%). O sistema decide irrigar na janela adequada (noite), considerando previsão de chuva e ET. Veja a água percorrendo as tubulações e os gotejadores pingando.`,
    enter: () => { useSim.getState().setSpeed(900) }, done: () => (getWorld().pump.on && elapsed() > 20) || elapsed() > 2 * 1440 },
  { title: '4. Recuperação da umidade', text: 'Enquanto a bomba funciona, a umidade do solo sobe aos poucos e o reservatório perde volume. Ao atingir a meta, o sistema desliga sozinho — sem desperdício.',
    enter: () => { useSim.getState().setSpeed(900) }, done: () => (!getWorld().pump.on && elapsed() > 60) || elapsed() > 12 * 60 },
  { title: '5. Comparando formas de irrigar', text: 'Rodamos 5 estratégias nas mesmas condições de seca por 7 dias e medimos o consumo de água calculado pelo motor de simulação.',
    enter: () => { useSim.getState().setRunning(false); useResults.getState().run(droughtCfg(), 7, PRESETS.drought.label); useSim.getState().setTab('scenarios') }, done: () => false },
  { title: '6. Benefícios potenciais', text: () => {
      const r = useResults.getState().results
      if (!r.length) return 'Calculando…'
      const sm = r[3], conv = r[0]
      return `Nesta simulação de 7 dias de seca, a irrigação inteligente usou ${(sm.withdrawnL / 1000).toFixed(0)} m³ contra ${(conv.withdrawnL / 1000).toFixed(0)} m³ da convencional (${savingVs(conv, sm).toFixed(0)}% menos água), com ${sm.stressH.toFixed(0)} h de estresse hídrico. Benefícios potenciais: uso consciente da água, menos energia de bombeamento, alertas antecipados de falhas e acompanhamento remoto. São resultados de um modelo simplificado, sem calibração com dados reais da propriedade.`
    }, enter: () => {}, done: () => false },
]

export default function Demo() {
  const { active, step, auto, setActive, setStep, setAuto } = useDemo()
  const rev = useSim((s) => s.rev)
  const results = useResults((s) => s.results)
  const running = useResults((s) => s.running)
  const go = (i: number) => { const n = Math.max(0, Math.min(STEPS.length - 1, i)); setStep(n, getWorld().t); STEPS[n].enter(); setStep(n, getWorld().t) }
  useEffect(() => {
    if (!active || !auto) return
    if (STEPS[step].done() && step < STEPS.length - 1) go(step + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, active, auto, step])
  useEffect(() => {
    if (active && step === 4 && auto && results.length && !running) {
      const id = setTimeout(() => go(5), 2500)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, running, active, step, auto])
  if (!active) return null
  const st = STEPS[step]
  return (
    <div className="demo-panel">
      <div className="steps">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'd' : ''} />)}</div>
      <h4>{st.title}</h4>
      <p>{typeof st.text === 'function' ? st.text() : st.text}</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => go(step - 1)} disabled={step === 0}>◀ Anterior</button>
        <button className="btn sm primary" onClick={() => go(step + 1)} disabled={step === STEPS.length - 1}>Próximo ▶</button>
        <label className="note"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> avanço automático</label>
        <span className="spacer" />
        <span className="note">Umidade média: {avgM().toFixed(0)}%</span>
        <button className="btn sm danger" onClick={() => { setActive(false); useSim.getState().setRunning(false) }}>Encerrar</button>
      </div>
    </div>
  )
}

export function startDemo() {
  useDemo.getState().setActive(true)
  const s = 0
  useDemo.getState().setStep(s, 0)
  STEPS[0].enter()
  useDemo.getState().setStep(0, getWorld().t)
}
