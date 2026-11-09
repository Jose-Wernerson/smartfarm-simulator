import { startDemo } from './Demo'
import { useSim } from '../../store/sim'

export default function Intro() {
  const setTab = useSim((s) => s.setTab)
  return (
    <div className="scroll" style={{ maxWidth: 900 }}>
      <div className="hero">
        <h2>SmartFarm Simulator 1.0</h2>
        <p style={{ margin: 0 }}>Plantio inteligente. Água consciente. Agricultura conectada.</p>
      </div>
      <div className="card">
        <h2>Como a tecnologia ajuda o agricultor?</h2>
        <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li><b>Sensores</b> medem a umidade do solo, o clima, o nível da água e a pressão da tubulação.</li>
          <li><b>O controlador</b> compara as medidas com metas e considera previsão de chuva e evapotranspiração.</li>
          <li><b>A bomba e as válvulas</b> irrigam só o setor e o horário necessários.</li>
          <li><b>Alertas</b> avisam sobre falhas — vazamento, sensor fora do ar, reservatório baixo.</li>
          <li><b>Relatórios e o celular</b> permitem acompanhar e decidir à distância.</li>
        </ol>
        <button className="btn primary" onClick={() => { setTab('3d'); startDemo() }}>🎓 Iniciar demonstração automática</button>
      </div>
      <div className="card note" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
        <b>Sobre os modelos.</b> Balanço hídrico simplificado do solo (zona radicular única), ET₀ horária por FAO-56 Penman-Monteith simplificada (radiação derivada de curva de céu limpo e nebulosidade; sem correção de altitude), ETc = ET₀ × Kc × Ks. Kc por estágio, profundidade radicular, fração de depleção, parâmetros de solo e aceleração do desenvolvimento são <b>hipóteses demonstrativas</b>, ajustáveis em "Hipóteses". A simulação <b>não prevê produtividade real</b> nem constitui recomendação agronômica. Todos os comandos são simulados; nenhum hardware real é controlado.
      </div>
    </div>
  )
}
