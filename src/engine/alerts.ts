import type { AlertCategory, Severity, World } from './types'
import { SOILS } from './params'
import { soilReading } from './controller'

interface Raise {
  severity: Severity
  category: AlertCategory
  location: string
  title: string
  description: string
  recommendation: string
}

function raise(w: World, key: string, r: Raise) {
  if (w.alerts.some((a) => a.key === key && a.active)) return
  w.alerts.push({ id: w.nextAlertId++, key, t: w.t, tEnd: null, active: true, ...r })
  if (w.alerts.length > 500) {
    const i = w.alerts.findIndex((a) => !a.active)
    if (i >= 0) w.alerts.splice(i, 1)
  }
}
function clear(w: World, key: string) {
  for (const a of w.alerts) if (a.key === key && a.active) {
    a.active = false
    a.tEnd = w.t
  }
}
const isActive = (w: World, key: string) => w.alerts.some((a) => a.key === key && a.active)

export function evalAlerts(w: World, dtMin: number): void {
  const cfg = w.cfg
  const soil = SOILS[cfg.soil]
  const P0 = cfg.pressureBar
  const comms = w.faults.comms
  const power = w.faults.power

  if (power) raise(w, 'power', { severity: 'critical', category: 'Energia', location: 'Quadro elétrico', title: 'Falha elétrica', description: 'Sem energia: bomba, válvulas, controlador e gateway desligados.', recommendation: 'Verificar a rede/gerador e disjuntores. Irrigação interrompida.' })
  else clear(w, 'power')
  if (comms && !power) raise(w, 'comms', { severity: 'warning', category: 'Sensores', location: 'Gateway', title: 'Falta de comunicação', description: 'Nenhum sensor está transmitindo dados.', recommendation: 'Checar o gateway/antena. Controle usa últimos valores conhecidos.' })
  else clear(w, 'comms')

  w.zones.forEach((z, i) => {
    const N = `Setor ${z.name}`
    const r = soilReading(w, i)
    if (r.valid) {
      const v = r.v
      const low = cfg.threshold - 4
      if (v < low) raise(w, `low${i}`, { severity: v < low - 10 ? 'critical' : 'warning', category: 'Solo', location: N, title: `Umidade baixa no ${N}`, description: `Leitura de ${v.toFixed(1)}% (limite de irrigação ${cfg.threshold}%).`, recommendation: 'Verificar irrigação, válvula do setor e reservatório.' })
      else if (v > low + 3) clear(w, `low${i}`)
      if (v < cfg.threshold && !z.irrigating) raise(w, `need${i}`, { severity: 'info', category: 'Irrigação', location: N, title: 'Necessidade de irrigação', description: `Umidade ${v.toFixed(1)}% abaixo do limite de ${cfg.threshold}%.`, recommendation: cfg.mode === 'manual' ? 'Ligar bomba e abrir a válvula do setor.' : 'Aguardar o controlador (janela/previsão de chuva).' })
      else if (v >= cfg.threshold + 2 || z.irrigating) clear(w, `need${i}`)
      if (v >= cfg.blockAbove) raise(w, `wet${i}`, { severity: 'warning', category: 'Solo', location: N, title: 'Umidade muito elevada', description: `Leitura ${v.toFixed(1)}%: irrigação bloqueada, risco de encharcamento.`, recommendation: 'Suspender irrigação; verificar drenagem.' })
      else if (v < cfg.blockAbove - 3) clear(w, `wet${i}`)
    }
    if (z.ks < 0.5) raise(w, `stressC${i}`, { severity: 'critical', category: 'Plantas', location: N, title: 'Planta sob estresse hídrico severo', description: `Coeficiente de estresse Ks = ${z.ks.toFixed(2)}.`, recommendation: 'Irrigar imediatamente o setor.' })
    else if (z.ks > 0.6) clear(w, `stressC${i}`)
    if (z.ks < 0.75) raise(w, `stress${i}`, { severity: 'warning', category: 'Plantas', location: N, title: 'Planta sob estresse hídrico', description: `Ks = ${z.ks.toFixed(2)}; crescimento reduzido.`, recommendation: 'Revisar acionamento da irrigação.' })
    else if (z.ks > 0.9) clear(w, `stress${i}`)
    if (z.clog > 0.3 && w.pump.on && z.valveOpen && w.pump.pressure > P0 * 1.25) raise(w, `clog${i}`, { severity: 'warning', category: 'Hidráulica', location: N, title: 'Possível obstrução de gotejadores', description: 'Pressão elevada com válvula aberta e vazão reduzida.', recommendation: 'Inspecionar filtros e gotejadores do setor.' })
    else if (z.clog === 0) clear(w, `clog${i}`)
  })

  for (const s of w.sensors) {
    if (s.status === 'offline' && !comms && !power) raise(w, `off${s.id}`, { severity: 'warning', category: 'Sensores', location: s.label, title: `Sensor ${s.id} sem comunicação`, description: s.battery <= 0 ? 'Bateria esgotada.' : 'Sem pacotes recebidos.', recommendation: 'Verificar bateria, antena e posição do sensor.' })
    else clear(w, `off${s.id}`)
    if (s.suspect) raise(w, `sus${s.id}`, { severity: 'warning', category: 'Sensores', location: s.label, title: `Leitura suspeita – ${s.id}`, description: `Valor ${s.value?.toFixed(1)} ${s.unit} inconsistente com sensores vizinhos/limites físicos.`, recommendation: 'Calibrar ou substituir o sensor; modo otimizado ignora a leitura.' })
    else clear(w, `sus${s.id}`)
    if (s.battery < 20 && s.battery > 0) raise(w, `bat${s.id}`, { severity: 'info', category: 'Sensores', location: s.label, title: `Bateria baixa – ${s.id}`, description: `${s.battery.toFixed(0)}% restante.`, recommendation: 'Programar troca de bateria.' })
  }

  const lvl = (w.reservoir.L / w.reservoir.cap) * 100
  if (lvl < 8) raise(w, 'resC', { severity: 'critical', category: 'Reservatório', location: 'Reservatório', title: 'Reservatório com nível crítico', description: `Nível ${lvl.toFixed(1)}%.`, recommendation: 'Reabastecer imediatamente; bomba protegida contra marcha a seco.' })
  else if (lvl > 12) clear(w, 'resC')
  if (lvl < 20) raise(w, 'resL', { severity: 'warning', category: 'Reservatório', location: 'Reservatório', title: 'Nível baixo do reservatório', description: `Nível ${lvl.toFixed(1)}%.`, recommendation: 'Verificar reposição de água.' })
  else if (lvl > 25) clear(w, 'resL')

  if (w.wx.tAir > 38) raise(w, 'tempC', { severity: 'critical', category: 'Clima', location: 'Estação', title: 'Temperatura muito elevada', description: `${w.wx.tAir.toFixed(1)} °C.`, recommendation: 'Risco de estresse térmico; evitar irrigar no calor do dia.' })
  else if (w.wx.tAir < 36.5) clear(w, 'tempC')
  if (w.wx.tAir > 35) raise(w, 'temp', { severity: 'warning', category: 'Clima', location: 'Estação', title: 'Temperatura elevada', description: `${w.wx.tAir.toFixed(1)} °C.`, recommendation: 'Monitorar demanda hídrica.' })
  else if (w.wx.tAir < 33.5) clear(w, 'temp')
  if (w.forecastMm >= cfg.rainSkipMm && w.wx.rain < 0.1) raise(w, 'fc', { severity: 'info', category: 'Clima', location: 'Previsão', title: 'Previsão de chuva', description: `~${w.forecastMm.toFixed(1)} mm nas próximas 6 h.`, recommendation: 'Modos inteligentes adiam a irrigação.' })
  else if (w.forecastMm < 0.5) clear(w, 'fc')

  if (w.pump.noFlowMin >= 10) raise(w, 'pumpF', { severity: 'critical', category: 'Hidráulica', location: 'Bomba', title: 'Bomba com falha', description: 'Comando ligado, mas sem vazão há mais de 10 min.', recommendation: 'Inspecionar motor, relé e escorva.' })
  else if (w.pump.noFlowMin === 0) clear(w, 'pumpF')
  const dry = w.pump.want && !power && w.reservoir.L <= 1
  if (dry) raise(w, 'dry', { severity: 'critical', category: 'Hidráulica', location: 'Bomba', title: 'Bomba bloqueada: reservatório vazio', description: 'Proteção contra marcha a seco acionada.', recommendation: 'Reabastecer o reservatório.' })
  else clear(w, 'dry')

  const pv = w.sensors.find((s) => s.type === 'pressure')?.value
  // Persistência de 10 min da pressão MEDIDA baixa (evita alarme em transitórios/ruído).
  w.pump.lowPressSensMin = w.pump.on && pv != null && pv < P0 * 0.8 ? w.pump.lowPressSensMin + dtMin : 0
  if (w.pump.on && pv != null) {
    if (w.pump.lowPressSensMin >= 10) raise(w, 'leak', { severity: 'critical', category: 'Hidráulica', location: w.faults.leakZone === 4 ? 'Tubulação principal' : `Setor ${'ABCD'[Math.max(0, w.faults.leakZone)]}`, title: 'Vazamento detectado', description: `Pressão ${pv.toFixed(2)} bar (nominal ${P0.toFixed(1)}), perda de água.`, recommendation: 'Fechar setor e localizar o vazamento.' })
    else if (pv > P0 * 0.92 && w.faults.leak === 0) clear(w, 'leak')
    if (pv > P0 * 1.35) raise(w, 'phi', { severity: 'warning', category: 'Hidráulica', location: 'Tubulação principal', title: 'Pressão anormal na tubulação', description: `Pressão ${pv.toFixed(2)} bar acima do esperado.`, recommendation: 'Checar obstruções, filtros e válvulas.' })
    else if (pv < P0 * 1.2) clear(w, 'phi')
  }
  if (w.faults.leak === 0 && isActive(w, 'leak')) clear(w, 'leak')
  void soil
}
