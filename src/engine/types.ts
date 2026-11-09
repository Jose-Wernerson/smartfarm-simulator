export type SoilType = 'arenoso' | 'franco' | 'argiloso'
export type WeatherPreset =
  | 'sunny'
  | 'partly'
  | 'cloudy'
  | 'lightRain'
  | 'heavyRain'
  | 'drought'
  | 'heatwave'
export type ControlMode = 'manual' | 'timer' | 'auto' | 'smart' | 'optimized' | 'operator'
export type SensorType =
  | 'soilMoisture'
  | 'soilTemp'
  | 'airTemp'
  | 'airHumidity'
  | 'light'
  | 'rain'
  | 'level'
  | 'flow'
  | 'pressure'
export type Severity = 'info' | 'warning' | 'critical'
export type AlertCategory =
  | 'Irrigação'
  | 'Solo'
  | 'Reservatório'
  | 'Clima'
  | 'Sensores'
  | 'Hidráulica'
  | 'Energia'
  | 'Plantas'

/** Todos os parâmetros configuráveis. Valores agronômicos são HIPÓTESES demonstrativas. */
export interface Config {
  // Propriedade
  areaM2: number
  plants: number
  spacing: number // m entre plantas na linha
  soil: SoilType
  reservoirL: number
  pumpLph: number
  threshold: number // % de saturação para iniciar irrigação
  // Clima
  preset: WeatherPreset
  rainMmH: number
  tempC: number // temperatura média diária base
  tempAmp: number // amplitude térmica diária
  solarPct: number
  // Hipóteses agronômicas / técnicas
  kcScale: number
  rootDepthM: number
  depletionP: number // fração de depleção sem estresse
  effDrip: number // eficiência de aplicação
  band: number // histerese (pontos %) modo automático
  blockAbove: number // % acima do qual a irrigação é bloqueada
  noiseLevel: number // multiplicador de ruído dos sensores
  accel: number // aceleração didática do desenvolvimento
  startDev: number // índice de desenvolvimento inicial (0-100)
  startMoisture: number // % de saturação inicial
  pressureBar: number
  pumpEta: number
  refill: boolean
  refillLph: number
  panelsKwp: number
  timerStartH: number
  timerDurMin: number
  rainSkipMm: number
  startHour: number
  seed: number
  mode: ControlMode
}

export interface Weather {
  t: number
  day: number
  hour: number
  tAir: number
  rh: number // 0-1
  solar: number // W/m²
  clear: number
  rain: number // mm/h
  wind: number // m/s
  cloud: number // 0-1
  et0: number // mm/h
}

export interface PlantSite {
  x: number
  z: number
  zone: number
  row: number
  off: number // deslocamento determinístico de desenvolvimento
}
export interface PipeSeg {
  id: string
  a: [number, number]
  b: [number, number]
  kind: 'main' | 'trunk' | 'stub' | 'header' | 'lateral'
  zones: number[]
  y: number
}
export interface Layout {
  W: number
  L: number
  rowSp: number
  densityWarning: boolean
  rows: number
  ppr: number
  rowX: number[]
  plants: PlantSite[]
  posts: { x: number; z: number }[]
  pipes: PipeSeg[]
  valves: { zone: number; x: number; z: number }[]
  zoneRects: { x0: number; x1: number; z0: number; z1: number }[]
  tank: { x: number; z: number; r: number; h: number }
  pump: { x: number; z: number }
  station: { x: number; z: number }
  panels: { x: number; z: number }
  emitters: { x: number; z: number; zone: number }[]
}

export interface SensorState {
  id: string
  label: string
  type: SensorType
  zone: number // -1 = geral
  pos: [number, number]
  unit: string
  value: number | null
  lastGood: number
  history: { t: number; v: number }[]
  status: 'ok' | 'offline' | 'fault' | 'lowbat'
  battery: number
  signal: number
  suspect: boolean
}

export interface ZoneState {
  index: number
  name: string
  areaM2: number
  plants: number
  theta: number
  tSoil: number
  valveCmd: boolean
  valveOpen: boolean
  irrigating: boolean
  flowLph: number
  ks: number
  dev: number
  vigor: number
  clog: number
  // acumulados
  appliedL: number
  stressH: number
  etcMm: number
  drainMm: number
  runoffMm: number
  rainInfilMm: number
}

export interface Alert {
  id: number
  key: string
  t: number
  tEnd: number | null
  severity: Severity
  category: AlertCategory
  location: string
  title: string
  description: string
  recommendation: string
  active: boolean
}

export interface IrrEvent {
  start: number
  end: number | null
  volumeL: number
  zones: string
}

export interface Sample {
  t: number
  moist: number[]
  moistAvg: number
  tAir: number
  tSoil: number
  rh: number
  solar: number
  rain: number
  reservoirL: number
  flow: number
  pumpOn: number
  kW: number
  kWhCum: number
  waterCumL: number
  dev: number[]
  vigor: number
}

export interface Stats {
  withdrawnL: number
  appliedL: number
  leakL: number
  lossSoilL: number // drenagem + escoamento de irrigação+chuva
  lossEffL: number
  pumpMin: number
  irrigations: number
  kWh: number
  gridKWh: number
  solarKWh: number
  rainMm: number
  etcMm: number
  stressHours: number
  overwetHours: number
  inRangeHours: number
  moistSum: number
  steps: number
  refillL: number
  dryRunMin: number
}

export interface DailyRec {
  day: number
  waterL: number
  pumpH: number
  irrigations: number
  kWh: number
  rainMm: number
  etcMm: number
  et0Mm: number
  tMean: number
  moistAvg: number
  alerts: number
}

export interface Faults {
  offline: Record<string, boolean>
  wrong: Record<string, boolean>
  pumpFailure: boolean
  leak: number // fração 0..0.6
  leakZone: number // 0-3 setor, 4 principal
  reservoirEmpty: boolean
  power: boolean
  comms: boolean
  clog: number[] // por setor 0..0.9
}

export interface World {
  cfg: Config
  layout: Layout
  t: number
  t0: number
  wx: Weather
  forecastMm: number
  zones: ZoneState[]
  sensors: SensorState[]
  reservoir: { L: number; cap: number; refilling: boolean }
  pump: {
    cmd: boolean
    want: boolean
    on: boolean
    flowLph: number
    leakLph: number
    pressure: number
    powerKw: number
    dwellMin: number
    runMinToday: number
    lowPressMin: number
    lowPressSensMin: number
    noFlowMin: number
  }
  energy: { loadKw: number; solarKw: number; gridKw: number }
  faults: Faults
  stats: Stats
  daily: DailyRec[]
  dayStart: { stats: Stats; day: number; alerts: number; et0: number; tSum: number; n: number }
  history: Sample[]
  alerts: Alert[]
  irrLog: IrrEvent[]
  ctl: { opRemainingL: number; opDay: number; leakLockUntil: number; et0Ema: number }
  rng: () => number
  nextAlertId: number
  lastSample: number
}
