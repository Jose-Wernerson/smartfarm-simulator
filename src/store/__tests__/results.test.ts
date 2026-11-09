import { beforeEach, describe, expect, it } from 'vitest'
import { useResults } from '../results'
import { getWorld, useSim } from '../sim'
import { DEFAULT_CONFIG } from '../../engine/params'
import { scenarioSignature } from '../../engine/scenarios'

const cfg = () => ({ ...DEFAULT_CONFIG })

describe('Resultados de cenários — duração e invalidação (regressão M1)', () => {
  beforeEach(() => {
    useResults.getState().clear()
    useResults.getState().setDays(14)
    useSim.getState().reset()
  })

  it('a duração escolhida vive no store e sobrevive à troca de abas (desmontagem do componente)', () => {
    useResults.getState().setDays(21)
    expect(useResults.getState().days).toBe(21)
  })

  it('os resultados têm exatamente a duração solicitada e o store a registra', () => {
    for (const d of [3, 7]) {
      useResults.getState().runNow(cfg(), d, 'x')
      const s = useResults.getState()
      expect(s.resultDays).toBe(d)
      expect(s.days).toBe(d)
      expect(s.results).toHaveLength(5)
      for (const r of s.results) {
        expect(r.days).toBe(d)
        expect(r.daily).toHaveLength(d)
      }
    }
  })

  it('mudança de configuração relevante descarta resultados antigos', () => {
    useResults.getState().runNow(getWorld().cfg, 3, 'x')
    expect(useResults.getState().results).toHaveLength(5)
    useSim.getState().setConfig({ threshold: 47 })
    expect(useResults.getState().results).toHaveLength(0)
    expect(useResults.getState().signature).toBeNull()
  })

  it('mudança de clima (preset) também invalida', () => {
    useResults.getState().runNow(getWorld().cfg, 3, 'x')
    useSim.getState().setPreset('drought')
    expect(useResults.getState().results).toHaveLength(0)
  })

  it('mudança estrutural (plantas/área) invalida', () => {
    useResults.getState().runNow(getWorld().cfg, 3, 'x')
    useSim.getState().setConfig({ areaM2: 8000 })
    expect(useResults.getState().results).toHaveLength(0)
  })

  it('trocar o modo de operação ou reiniciar a simulação NÃO invalida (cenários definem o próprio modo)', () => {
    useResults.getState().runNow(getWorld().cfg, 3, 'x')
    useSim.getState().setConfig({ mode: 'manual' })
    expect(useResults.getState().results).toHaveLength(5)
    useSim.getState().reset()
    expect(useResults.getState().results).toHaveLength(5)
  })

  it('cálculo em andamento é descartado se a configuração muda antes de terminar', async () => {
    useResults.getState().run(getWorld().cfg, 3, 'x')
    expect(useResults.getState().running).toBe(true)
    useSim.getState().setConfig({ threshold: 52 })
    await new Promise((r) => setTimeout(r, 200))
    expect(useResults.getState().results).toHaveLength(0)
    expect(useResults.getState().running).toBe(false)
  })

  it('assinatura ignora modo e eficiência, mas muda com qualquer outro parâmetro', () => {
    const a = scenarioSignature(cfg())
    expect(scenarioSignature({ ...cfg(), mode: 'manual', effDrip: 0.5 })).toBe(a)
    expect(scenarioSignature({ ...cfg(), tempC: 30 })).not.toBe(a)
    expect(scenarioSignature({ ...cfg(), rootDepthM: 0.4 })).not.toBe(a)
  })

  it('config da planta: alterar quantidade de plantas pelo store resulta em contagem desenhada = configurada', () => {
    useSim.getState().setConfig({ plants: 1200 })
    const w = getWorld()
    expect(w.layout.plants.length).toBe(w.cfg.plants)
  })
})
