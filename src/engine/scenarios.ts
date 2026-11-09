import type { Config, ControlMode } from './types'
import { createWorld, step } from './sim'

export interface ScenarioDef {
  id: number
  name: string
  short: string
  mode: ControlMode
  eff: number
  description: string
  color: string
}

export const SCENARIOS: ScenarioDef[] = [
  { id: 1, name: 'Agricultura convencional', short: 'Convencional', mode: 'operator', eff: 0.6, color: '#c2703d', description: 'Operador irriga 15 mm nominais a cada 2 dias às 10h, sem sensores e sem considerar clima. Eficiência de aplicação menor (hipótese 60%).' },
  { id: 2, name: 'Irrigação programada', short: 'Programada', mode: 'timer', eff: 0.9, color: '#d9a21b', description: 'Bomba acionada diariamente em horário fixo, todos os setores, independente de chuva ou umidade.' },
  { id: 3, name: 'Irrigação por sensores', short: 'Sensores', mode: 'auto', eff: 0.9, color: '#3b9bd6', description: 'Irrigação por setor conforme umidade do solo, com histerese.' },
  { id: 4, name: 'Agricultura inteligente', short: 'Inteligente', mode: 'smart', eff: 0.9, color: '#2fae66', description: 'Sensores + previsão de chuva + evapotranspiração + janela horária e meta de reposição calculada.' },
  { id: 5, name: 'Propriedade otimizada', short: 'Otimizada', mode: 'optimized', eff: 0.9, color: '#8e5fd6', description: 'Controle por zonas (máx. 2 simultâneas), validação cruzada de sensores, detecção de vazamento e metas por ETc.' },
]

export interface ScenarioResult {
  def: ScenarioDef
  days: number
  withdrawnL: number
  appliedL: number
  lossL: number
  pumpH: number
  irrigations: number
  kWh: number
  stressH: number
  overwetH: number
  inRangeH: number
  avgMoist: number
  vigor: number
  dev: number
  rainMm: number
  etcMm: number
  series: { t: number; moist: number; water: number }[]
  daily: { day: number; waterL: number }[]
}

/** Executa um cenário sem falhas, com o mesmo clima (configuração) para todos. */
export function runScenario(def: ScenarioDef, base: Config, days: number): ScenarioResult {
  const cfg: Config = { ...base, mode: def.mode, effDrip: def.eff }
  const w = createWorld(cfg)
  const end = w.t0 + days * 1440
  const series: ScenarioResult['series'] = []
  let nextS = w.t0
  while (w.t < end) {
    step(w, 5)
    if (w.t >= nextS) {
      series.push({ t: (w.t - w.t0) / 1440, moist: w.history.length ? w.history[w.history.length - 1].moistAvg : 0, water: w.stats.withdrawnL })
      nextS += 180
    }
  }
  const s = w.stats
  return {
    def, days, withdrawnL: s.withdrawnL, appliedL: s.appliedL, lossL: s.leakL + s.lossSoilL + s.lossEffL,
    pumpH: s.pumpMin / 60, irrigations: s.irrigations, kWh: s.kWh, stressH: s.stressHours, overwetH: s.overwetHours,
    inRangeH: s.inRangeHours, avgMoist: s.steps ? s.moistSum / s.steps : 0,
    vigor: w.zones.reduce((a, z) => a + z.vigor, 0) / 4, dev: w.zones.reduce((a, z) => a + z.dev, 0) / 4,
    rainMm: s.rainMm, etcMm: s.etcMm, series, daily: w.daily.map((d) => ({ day: d.day, waterL: d.waterL })),
  }
}

export function runAll(base: Config, days: number): ScenarioResult[] {
  return SCENARIOS.map((d) => runScenario(d, base, days))
}

/** Economia (%) de água retirada vs. referência, calculada a partir dos resultados do motor. */
export function savingVs(ref: ScenarioResult, r: ScenarioResult): number {
  return ref.withdrawnL > 0 ? ((ref.withdrawnL - r.withdrawnL) / ref.withdrawnL) * 100 : 0
}

/**
 * Assinatura da configuração que determina os resultados dos cenários.
 * Exclui `mode` e `effDrip` (cada cenário define os seus). Qualquer outra mudança invalida resultados antigos.
 */
export function scenarioSignature(cfg: Config): string {
  const { mode: _mode, effDrip: _eff, ...rest } = cfg
  void _mode
  void _eff
  return JSON.stringify(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)))
}
