import type { Config, Layout, PipeSeg, PlantSite } from './types'

/** Gera a geometria da propriedade a partir da configuração. Zonas: A(0) B(1) C(2) D(3). */
/** Faixa usual de entrelinha (m) — demonstrativa; fora dela o layout sinaliza `densityWarning`. */
export const ROW_SP_RANGE: [number, number] = [2, 6]

/**
 * Escolhe nº de linhas (par) e plantas por linha (par) tal que:
 *  - W × L = área configurada (exato), com L = plantas_por_linha × espaçamento + 3 m de carreador;
 *  - nº de plantas desenhadas = linhas × plantas_por_linha, o mais próximo possível do pedido;
 *  - entrelinha = W / linhas dentro da faixa usual quando possível.
 */
export function chooseGrid(areaM2: number, plants: number, spacing: number) {
  let best: { rows: number; ppr: number; score: number; rowSp: number } | null = null
  for (let rows = 4; rows <= 120; rows += 2) {
    for (let ppr = 4; ppr <= 400; ppr += 2) {
      const L = ppr * spacing + 3
      const W = areaM2 / L
      const rowSp = W / rows
      const outOfRange = Math.max(0, ROW_SP_RANGE[0] - rowSp) + Math.max(0, rowSp - ROW_SP_RANGE[1])
      const aspect = Math.abs(Math.log(W / L))
      const score = outOfRange * 1e6 + Math.abs(rows * ppr - plants) * 100 + aspect
      if (!best || score < best.score) best = { rows, ppr, score, rowSp }
    }
  }
  return best!
}

/** Gera a geometria da propriedade a partir da configuração. Zonas: A(0) B(1) C(2) D(3). */
export function buildLayout(cfg: Config): Layout {
  const { rows, ppr } = chooseGrid(cfg.areaM2, cfg.plants, cfg.spacing)
  const sp = cfg.spacing
  const L = ppr * sp + 3
  const W = cfg.areaM2 / L
  const rowSp = W / rows
  const densityWarning = rowSp < ROW_SP_RANGE[0] - 1e-9 || rowSp > ROW_SP_RANGE[1] + 1e-9

  const rowX: number[] = []
  for (let i = 0; i < rows; i++) rowX.push(-W / 2 + rowSp * (i + 0.5))

  const plants: PlantSite[] = []
  const emitters: Layout['emitters'] = []
  const posts: Layout['posts'] = []
  for (let i = 0; i < rows; i++) {
    const col = rowX[i] < 0 ? 0 : 1
    for (let h = 0; h < 2; h++) {
      const zone = col * 2 + h
      const sign = h === 0 ? -1 : 1
      for (let j = 0; j < ppr / 2; j++) {
        const z = sign * (1.5 + (j + 0.5) * sp)
        const k = i * 131 + h * 17 + j * 7
        const off = (Math.sin(k * 12.9898) * 43758.5453) % 1
        plants.push({ x: rowX[i], z, zone, row: i, off: (off - Math.floor(off) - 0.5) * 16 })
        emitters.push({ x: rowX[i] + 0.35, z, zone })
        if (j % 3 === 0) posts.push({ x: rowX[i], z: z + sp * 0.5 * -sign * -1 })
      }
    }
  }

  const zoneRects = [
    { x0: -W / 2, x1: 0, z0: -L / 2, z1: -1.5 },
    { x0: -W / 2, x1: 0, z0: 1.5, z1: L / 2 },
    { x0: 0, x1: W / 2, z0: -L / 2, z1: -1.5 },
    { x0: 0, x1: W / 2, z0: 1.5, z1: L / 2 },
  ]

  const tank = { x: -W / 2 - 16, z: 0, r: 3.6, h: 4.2 }
  const pump = { x: -W / 2 - 8, z: 0 }
  const pipes: PipeSeg[] = []
  const y = 0.12
  pipes.push({ id: 'm0', a: [tank.x + tank.r, 0], b: [pump.x - 1.4, 0], kind: 'main', zones: [0, 1, 2, 3], y })
  pipes.push({ id: 'm1', a: [pump.x + 1.4, 0], b: [-W / 2 - 1, 0], kind: 'main', zones: [0, 1, 2, 3], y })
  pipes.push({ id: 't0', a: [-W / 2 - 1, 0], b: [-W / 4, 0], kind: 'trunk', zones: [0, 1, 2, 3], y })
  pipes.push({ id: 't1', a: [-W / 4, 0], b: [W / 4, 0], kind: 'trunk', zones: [2, 3], y })

  const valves: Layout['valves'] = []
  for (let zone = 0; zone < 4; zone++) {
    const col = zone >> 1
    const sign = zone % 2 === 0 ? -1 : 1
    const cx = col === 0 ? -W / 4 : W / 4
    valves.push({ zone, x: cx, z: sign * 0.9 })
    pipes.push({ id: `s${zone}`, a: [cx, 0], b: [cx, sign * 1.5], kind: 'stub', zones: [zone], y })
    const r = zoneRects[zone]
    pipes.push({ id: `h${zone}a`, a: [cx, sign * 1.5], b: [r.x0 + rowSp * 0.35, sign * 1.5], kind: 'header', zones: [zone], y })
    pipes.push({ id: `h${zone}b`, a: [cx, sign * 1.5], b: [r.x1 - rowSp * 0.15, sign * 1.5], kind: 'header', zones: [zone], y })
  }
  for (let i = 0; i < rows; i++) {
    const col = rowX[i] < 0 ? 0 : 1
    for (let h = 0; h < 2; h++) {
      const zone = col * 2 + h
      const sign = h === 0 ? -1 : 1
      pipes.push({
        id: `l${i}_${h}`,
        a: [rowX[i] + 0.35, sign * 1.5],
        b: [rowX[i] + 0.35, sign * (L / 2 - 0.4)],
        kind: 'lateral',
        zones: [zone],
        y,
      })
    }
  }

  return {
    W,
    L,
    rowSp,
    densityWarning,
    rows,
    ppr,
    rowX,
    plants,
    posts,
    pipes,
    valves,
    zoneRects,
    tank,
    pump,
    station: { x: W / 2 + 6, z: 0 },
    panels: { x: W / 2 + 8, z: L / 4 + 4 },
    emitters,
  }
}
