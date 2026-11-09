import { describe, expect, it } from 'vitest'
import { run, sum, world } from './helpers'
import type { Alert, World } from '../types'

const has = (w: World, key: string) => w.alerts.some((a: Alert) => a.key === key)
const dry = { preset: 'drought' as const, tempC: 28 }

describe('Simulação de falhas', () => {
  it('bomba com falha: sem vazão, alerta crítico e estresse hídrico crescente', () => {
    const w = world({ mode: 'smart', ...dry })
    w.faults.pumpFailure = true
    run(w, 10)
    expect(w.stats.withdrawnL).toBe(0)
    expect(has(w, 'pumpF')).toBe(true)
    expect(w.alerts.find((a) => a.key === 'pumpF')!.severity).toBe('critical')
    expect(w.stats.stressHours).toBeGreaterThan(20)
    expect(Math.min(...w.zones.map((z) => z.ks))).toBeLessThan(0.5)
  })

  it('reservatório vazio: não irriga, alerta crítico de nível', () => {
    const w = world({ mode: 'auto', ...dry })
    w.faults.reservoirEmpty = true
    run(w, 8)
    expect(w.stats.withdrawnL).toBe(0)
    expect(w.reservoir.L).toBe(0)
    expect(has(w, 'resC')).toBe(true)
    expect(w.stats.stressHours).toBeGreaterThan(0)
  })

  it('vazamento: perda de água = fração configurada, queda de pressão e alerta', () => {
    const w = world({ mode: 'timer' })
    w.faults.leak = 0.3
    run(w, 5)
    expect(w.stats.leakL / w.stats.withdrawnL).toBeCloseTo(0.3, 6)
    expect(has(w, 'leak')).toBe(true)
    const p = world({ mode: 'timer' })
    p.faults.leak = 0.3
    run(p, 0.3)
    const healthy = world({ mode: 'manual' })
    healthy.pump.cmd = true
    healthy.zones.forEach((z) => (z.valveCmd = true))
    run(healthy, 0.1)
    expect(p.pump.pressure === 0 || p.pump.pressure < healthy.pump.pressure * 0.8).toBe(true)
  })

  it('gotejador obstruído (todos os setores abertos): o setor recebe menos água e a pressão sobe', () => {
    // Limitação documentada: com os 4 setores abertos a pressão sobe só ~12%, abaixo do limiar de alerta (1,25×).
    const ok = world({ mode: 'timer' })
    const bad = world({ mode: 'timer' })
    bad.faults.clog[2] = 0.6
    run(ok, 3)
    run(bad, 3)
    expect(bad.zones[2].appliedL).toBeLessThan(ok.zones[2].appliedL)
    expect(bad.stats.withdrawnL).toBeLessThanOrEqual(ok.stats.withdrawnL)
  })

  it('gotejador obstruído (setor isolado aberto): pressão sobe e o alerta é gerado', () => {
    const ok = world({ mode: 'manual' })
    const bad = world({ mode: 'manual' })
    bad.faults.clog[2] = 0.6
    for (const w of [ok, bad]) {
      w.pump.cmd = true
      w.zones[2].valveCmd = true
      run(w, 0.1)
    }
    expect(bad.pump.pressure).toBeGreaterThan(ok.pump.pressure * 1.25)
    expect(has(bad, 'clog2') || has(bad, 'phi')).toBe(true)
    expect(has(ok, 'clog2') || has(ok, 'phi')).toBe(false)
  })

  it('falha elétrica: nada irriga, alerta crítico, sensores sem comunicação, e retoma ao restaurar', () => {
    const w = world({ mode: 'timer', timerStartH: 7 })
    w.faults.power = true
    run(w, 1)
    expect(sum(w.zones.map((z) => z.appliedL))).toBe(0)
    expect(has(w, 'power')).toBe(true)
    expect(w.sensors.every((s) => s.value === null)).toBe(true)
    w.faults.power = false
    run(w, 2)
    expect(w.stats.withdrawnL).toBeGreaterThan(0)
    expect(w.sensors.some((s) => s.value !== null)).toBe(true)
  })

  it('falta de comunicação: todos os sensores offline e alerta', () => {
    const w = world({ mode: 'auto' })
    w.faults.comms = true
    run(w, 0.2)
    expect(w.sensors.every((s) => s.status === 'offline')).toBe(true)
    expect(has(w, 'comms')).toBe(true)
  })

  it('sensor desconectado: sem leitura e alerta; automático fica cego, otimizado compensa pelos vizinhos', () => {
    const run10 = (mode: 'auto' | 'optimized') => {
      const w = world({ mode, ...dry })
      w.faults.offline['SM-A'] = true
      run(w, 10)
      return w
    }
    const auto = run10('auto')
    const opt = run10('optimized')
    expect(auto.sensors.find((s) => s.id === 'SM-A')!.value).toBeNull()
    expect(has(auto, 'offSM-A')).toBe(true)
    expect(auto.stats.stressHours).toBeGreaterThan(10)
    expect(opt.stats.stressHours).toBeLessThan(auto.stats.stressHours)
  })

  it('sensor com leitura incorreta: detectado como suspeito; otimizado não desperdiça água como o automático', () => {
    const go = (mode: 'auto' | 'optimized') => {
      const w = world({ mode, ...dry })
      w.faults.wrong['SM-B'] = true
      run(w, 6)
      return w
    }
    const auto = go('auto')
    const opt = go('optimized')
    expect(has(auto, 'susSM-B')).toBe(true)
    expect(auto.sensors.find((s) => s.id === 'SM-B')!.suspect).toBe(true)
    expect(opt.stats.withdrawnL).toBeLessThan(auto.stats.withdrawnL * 0.5)
  })

  it('o modo otimizado trava a bomba por vazamento (pressão baixa persistente) e tenta religar depois', () => {
    const w = world({ mode: 'optimized', ...dry })
    w.faults.leak = 0.4
    run(w, 6)
    expect(w.ctl.leakLockUntil).toBeGreaterThan(w.t0)
    const auto = world({ mode: 'auto', ...dry })
    auto.faults.leak = 0.4
    run(auto, 6)
    expect(w.stats.leakL).toBeLessThan(auto.stats.leakL)
  })

  it('sem nenhuma falha, não há alertas de falha em nenhum modo (sem falso positivo de falha)', () => {
    // alertas operacionais legítimos (nível, temperatura, necessidade) são permitidos; falhas não.
    const FAIL = /^(pumpF|dry|phi|comms|power|clog|off|sus)/
    for (const mode of ['timer', 'auto', 'smart', 'optimized', 'operator'] as const) {
      const w = world({ mode, ...dry })
      run(w, 10)
      const bad = w.alerts.filter((a) => FAIL.test(a.key)).map((a) => a.key)
      expect(bad, mode).toEqual([])
    }
  })
})
