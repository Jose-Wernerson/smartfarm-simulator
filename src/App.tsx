import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from 'react'
import { getWorld, useSim } from './store/sim'
import TopBar from './ui/TopBar'
import ConfigPanel from './ui/panels/ConfigPanel'
import MonitorPanel from './ui/panels/MonitorPanel'
import DetailCard from './ui/panels/DetailCard'
import Charts from './ui/panels/Charts'
import Alerts from './ui/panels/Alerts'
import Scenarios from './ui/panels/Scenarios'
import Faults from './ui/panels/Faults'
import Reports from './ui/panels/Reports'
import Phone from './ui/panels/Phone'
import Demo from './ui/panels/Demo'
import Intro from './ui/panels/Intro'
import { useWorld } from './ui/util'

const Farm3D = lazy(() => import('./three/Farm3D'))

class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    if (this.state.err) return <div className="errbox">Falha na visualização 3D: {this.state.err}. Seu dispositivo pode não suportar WebGL. Os demais painéis continuam funcionando. <button className="btn sm" onClick={() => this.setState({ err: null })}>Tentar novamente</button></div>
    return this.props.children
  }
}

function Legend() {
  const layers = useSim((s) => s.layers)
  const toggle = useSim((s) => s.toggleLayer)
  const view = useSim((s) => s.view)
  const setView = useSim((s) => s.setView)
  const w = useWorld(1000)
  return (
    <>
      <div className="overlay">
        <button className={`btn sm ${view === 'persp' ? 'on' : ''}`} onClick={() => setView('persp')}>Perspectiva</button>
        <button className={`btn sm ${view === 'top' ? 'on' : ''}`} onClick={() => setView('top')}>Vista superior</button>
        <button className={`btn sm ${layers.zones ? 'on' : ''}`} onClick={() => toggle('zones')}>Zonas</button>
        <button className={`btn sm ${layers.flow ? 'on' : ''}`} onClick={() => toggle('flow')}>Fluxo de água</button>
        <button className={`btn sm ${layers.sensors ? 'on' : ''}`} onClick={() => toggle('sensors')}>Sensores</button>
      </div>
      <div className="legend">
        Umidade: <span style={{ background: '#ff5a4a' }} />&lt;{w.cfg.threshold}% <span style={{ background: '#ffc84a' }} />intermediária <span style={{ background: '#4ad27a' }} />adequada <span style={{ background: '#4a8cff' }} />&gt;{w.cfg.blockAbove}%
        <br />Arraste: girar · Roda: zoom · Clique: sensor/planta/setor
      </div>
    </>
  )
}

export default function App() {
  const { tab, tick, running, leftOpen, rightOpen, setPanel, error, setError, loading } = useSim()
  const last = useRef(performance.now())
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.5, (now - last.current) / 1000)
      last.current = now
      if (useSim.getState().running) tick(dt)
    }, 100)
    return () => clearInterval(id)
  }, [tick])
  void getWorld
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <aside className={`side left ${leftOpen ? 'open' : ''}`}>
          <button className="btn sm mobile-toggle" style={{ float: 'right' }} onClick={() => setPanel('left', false)}>✕</button>
          <ConfigPanel />
        </aside>
        <section className="center">
          {error && <div className="errbox">Erro na simulação: {error} <button className="btn sm" onClick={() => setError(null)}>Fechar</button></div>}
          <div style={{ position: 'absolute', inset: 0, display: tab === '3d' ? 'block' : 'none' }}>
            {loading && <div className="loading">Carregando visualização 3D…</div>}
            <Boundary>
              <Suspense fallback={<div className="loading">Carregando visualização 3D…</div>}>
                <Farm3D />
              </Suspense>
            </Boundary>
            <Legend />
            <DetailCard />
          </div>
          {tab === 'charts' && <Charts />}
          {tab === 'alerts' && <Alerts />}
          {tab === 'scenarios' && <Scenarios />}
          {tab === 'faults' && <Faults />}
          {tab === 'reports' && <Reports />}
          {tab === 'phone' && <Phone />}
          {tab === 'demo' && <Intro />}
          <Demo />
          {!running && tab === '3d' && <div className="overlay" style={{ left: 'auto', right: 12, top: 'auto', bottom: 12 }}><span className="pill">⏸ Pausado — pressione ▶ Iniciar</span></div>}
        </section>
        <aside className={`side right ${rightOpen ? 'open' : ''}`}>
          <button className="btn sm mobile-toggle" style={{ float: 'right' }} onClick={() => setPanel('right', false)}>✕</button>
          <MonitorPanel />
        </aside>
      </div>
    </div>
  )
}
