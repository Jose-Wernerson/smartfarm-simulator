import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'
import { dailyWithCurrent, dayHour, useWorld } from '../util'

const tip = { contentStyle: { background: '#0e1822', border: '1px solid #22364a', fontSize: 12 }, labelStyle: { color: '#9fb4c6' } }
const ax = { stroke: '#7f96ab', fontSize: 11 }
export const ZC = ['#4aa3ff', '#4ad2a0', '#ffc84a', '#ff8a5a']

function Box(p: { title: string; sub?: string; children: ReactNode; h?: number }) {
  return (
    <div className="card">
      <div className="chart-title">{p.title}</div>
      {p.sub && <div className="chart-sub">{p.sub}</div>}
      <div style={{ height: p.h ?? 230 }}>
        <ResponsiveContainer>{p.children as never}</ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Charts() {
  const w = useWorld(1200)
  const hist = w.history.filter((_, i) => i % 2 === 0 || w.history.length < 300).slice(-400)
  const data = hist.map((h) => ({ t: h.t, A: h.moist[0], B: h.moist[1], C: h.moist[2], D: h.moist[3], avg: h.moistAvg, tAir: h.tAir, tSoil: h.tSoil, res: h.reservoirL / 1000, kW: h.kW, kWh: h.kWhCum, flow: h.flow / 1000, pump: h.pumpOn, rain: h.rain, d0: h.dev[0], d1: h.dev[1], d2: h.dev[2], d3: h.dev[3], vigor: h.vigor }))
  const daily = dailyWithCurrent(w).map((d) => ({ dia: `D${d.day + 1}`, agua: d.waterL / 1000, bomba: d.pumpH, irrig: d.irrigations, kWh: d.kWh, chuva: d.rainMm, etc: d.etcMm }))
  const x = <XAxis dataKey="t" tickFormatter={dayHour} {...ax} minTickGap={50} />
  return (
    <div className="scroll">
      <h2>Análise em tempo simulado</h2>
      {data.length < 2 && <div className="note">Inicie a simulação para acumular dados históricos.</div>}
      <div className="charts">
        <Box title="Umidade do solo (%) por setor" sub={`Linha tracejada: limite de irrigação (${w.cfg.threshold}%)`}>
          <LineChart data={data}><CartesianGrid stroke="#1c2d3c" />{x}<YAxis {...ax} domain={[0, 100]} width={36} /><Tooltip {...tip} labelFormatter={(t) => dayHour(Number(t))} formatter={(v) => Number(v).toFixed(1)} /><Legend />
            <ReferenceLine y={w.cfg.threshold} stroke="#ff5a5a" strokeDasharray="5 4" />
            {['A', 'B', 'C', 'D'].map((k, i) => <Line key={k} dataKey={k} name={`Setor ${k}`} stroke={ZC[i]} dot={false} isAnimationActive={false} strokeWidth={1.6} />)}
          </LineChart>
        </Box>
        <Box title="Temperatura (°C)" sub="Ar × solo (média dos setores)">
          <LineChart data={data}><CartesianGrid stroke="#1c2d3c" />{x}<YAxis {...ax} width={36} domain={['auto', 'auto']} /><Tooltip {...tip} labelFormatter={(t) => dayHour(Number(t))} formatter={(v) => Number(v).toFixed(1)} /><Legend />
            <Line dataKey="tAir" name="Ar" stroke="#ff8a5a" dot={false} isAnimationActive={false} /><Line dataKey="tSoil" name="Solo" stroke="#c9a06a" dot={false} isAnimationActive={false} /></LineChart>
        </Box>
        <Box title="Consumo diário de água (m³)" sub="Retirada do reservatório por dia simulado">
          <BarChart data={daily}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="dia" {...ax} /><YAxis {...ax} width={36} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(1)} /><Bar dataKey="agua" name="Água (m³)" fill="#4aa8ff" /><Bar dataKey="chuva" name="Chuva (mm)" fill="#8ad4ff" /></BarChart>
        </Box>
        <Box title="Consumo de energia" sub="Potência instantânea (kW) e energia diária (kWh)">
          <LineChart data={data}><CartesianGrid stroke="#1c2d3c" />{x}<YAxis {...ax} width={36} /><Tooltip {...tip} labelFormatter={(t) => dayHour(Number(t))} formatter={(v) => Number(v).toFixed(2)} /><Legend />
            <Line dataKey="kW" name="kW" stroke="#f5b83d" dot={false} isAnimationActive={false} /><Line dataKey="kWh" name="kWh acum." stroke="#b57edc" dot={false} isAnimationActive={false} /></LineChart>
        </Box>
        <Box title="Volume do reservatório (m³)">
          <AreaChart data={data}><CartesianGrid stroke="#1c2d3c" />{x}<YAxis {...ax} width={36} domain={[0, w.reservoir.cap / 1000]} /><Tooltip {...tip} labelFormatter={(t) => dayHour(Number(t))} formatter={(v) => Number(v).toFixed(1)} /><Area dataKey="res" name="m³" stroke="#2f8fe0" fill="#2f8fe055" isAnimationActive={false} /></AreaChart>
        </Box>
        <Box title="Tempo de funcionamento da bomba (h/dia)">
          <BarChart data={daily}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="dia" {...ax} /><YAxis {...ax} width={36} /><Tooltip {...tip} formatter={(v) => Number(v).toFixed(2)} /><Bar dataKey="bomba" name="Horas" fill="#2ee6a0" /></BarChart>
        </Box>
        <Box title="Quantidade de irrigações por dia">
          <BarChart data={daily}><CartesianGrid stroke="#1c2d3c" /><XAxis dataKey="dia" {...ax} /><YAxis {...ax} width={36} allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="irrig" name="Acionamentos" fill="#b57edc" /></BarChart>
        </Box>
        <Box title="Desenvolvimento estimado das plantas (%)" sub="Índice com aceleração didática (hipótese) — não prevê produtividade real">
          <LineChart data={data}><CartesianGrid stroke="#1c2d3c" />{x}<YAxis {...ax} width={36} domain={[0, 100]} /><Tooltip {...tip} labelFormatter={(t) => dayHour(Number(t))} formatter={(v) => Number(v).toFixed(1)} /><Legend />
            {['d0', 'd1', 'd2', 'd3'].map((k, i) => <Line key={k} dataKey={k} name={`Setor ${'ABCD'[i]}`} stroke={ZC[i]} dot={false} isAnimationActive={false} />)}
            <Line dataKey="vigor" name="Vigor médio" stroke="#fff" strokeDasharray="4 3" dot={false} isAnimationActive={false} /></LineChart>
        </Box>
      </div>
    </div>
  )
}
