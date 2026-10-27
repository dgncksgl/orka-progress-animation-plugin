export type Stage = { name: string; minTools: number; length: number; finScale: number }

export type Scene = {
  stage: Stage
  stageNumber: number
  columns: number
  rows: number
  cells: Uint32Array
  orcaPixels: number
}

type Color = number

export const STAGES: Stage[] = [
  { name: 'Calf', minTools: 0, length: 27, finScale: 1.0 },
  { name: 'Juvenile', minTools: 2, length: 33, finScale: 1.15 },
  { name: 'Adult', minTools: 5, length: 40, finScale: 1.3 },
  { name: 'Giant', minTools: 10, length: 48, finScale: 1.5 },
  { name: 'Legend', minTools: 17, length: 57, finScale: 1.7 },
]

// Every color is an exact xterm-256 palette entry, so terminals without
// truecolor draw the same scene instead of rounding gradients into noise.
const DEFAULT = 0x01000000
const BLACK: Color = 0x121212
const WHITE: Color = 0xeeeeee
const SADDLE: Color = 0x8a8a8a
const WATER_TOP: Color = 0x0087af
const WATER_DEEP: Color = 0x005f87
const FOAM: Color = 0xd7ffff
const CREST: Color = 0x5fd7ff
const BUBBLE: Color = 0xafffff
const SPACE = 0x20
const SAMPLES = 3

export function stageIndexFor(tools: number): number {
  let index = 0
  STAGES.forEach((stage, i) => {
    if (tools >= stage.minTools) index = i
  })
  return index
}

class Orca {
  readonly x0: number
  readonly y0: number
  readonly length: number
  readonly phase: number
  readonly half: number
  readonly finHeight: number
  readonly tailStart: number

  constructor(x0: number, y0: number, length: number, finScale: number, phase: number) {
    this.x0 = x0
    this.y0 = y0
    this.length = length
    this.phase = phase
    this.half = length * 0.13
    this.finHeight = this.half * finScale
    this.tailStart = length * 0.12
  }

  thickness(u: number): number {
    if (u < 0) return 0
    if (u < 0.65) return this.half * (0.25 + 0.75 * Math.sin((Math.PI / 2) * (u / 0.65)))
    return this.half * Math.sqrt(Math.max(0, 1 - ((u - 0.65) / 0.358) ** 2))
  }

  centre(u: number): number {
    return this.y0 + this.half * 0.55 * Math.sin(this.phase - u * 3) * (1 - u) ** 2
  }

  bodyU(x: number): number {
    return (x - this.x0 - this.tailStart) / (this.length - this.tailStart)
  }

  colorAt(x: number, y: number): Color | null {
    const u = this.bodyU(x)
    if (u > 1) return null
    if (u < 0) return this.fluke(x, y)

    const t = this.thickness(u)
    const c = this.centre(u)
    const v = (y - c) / t
    if (v >= -0.95 && v <= 1.05) return this.skin(u, v)
    return this.dorsalFin(u, y) ?? this.pectoralFin(u, y)
  }

  skin(u: number, v: number): Color {
    const patchU = (u - 0.8) / 0.075
    const patchV = (v + 0.28) / 0.2
    if (patchU * patchU + patchV * patchV <= 1) return WHITE
    if (u > 0.84 && v > 0.12) return WHITE
    if (u > 0.45 && u < 0.97 && v > 0.42) return WHITE
    if (u > 0.2 && u < 0.5 && v > 0.12 + Math.abs(u - 0.3) * 2.2) return WHITE
    if (u > 0.4 && u < 0.58 && v < -0.68) return SADDLE
    return BLACK
  }

  dorsalFin(u: number, y: number): Color | null {
    const back = this.centre(0.55) - this.thickness(0.55) * 0.95
    const k = (back - y) / this.finHeight
    if (k < 0 || k > 1) return null
    const lead = 0.61 - 0.12 * k
    const trail = 0.48 + 0.01 * Math.sqrt(k)
    return u >= trail && u <= lead ? BLACK : null
  }

  pectoralFin(u: number, y: number): Color | null {
    const t = this.thickness(0.72)
    const du = (u - 0.69 + (y - this.centre(0.72)) / this.length * 0.25) / 0.05
    const dv = ((y - this.centre(0.72)) / t - 1.25) / 0.4
    return du * du + dv * dv <= 1 ? BLACK : null
  }

  fluke(x: number, y: number): Color | null {
    const local = (x - this.x0) / this.tailStart
    if (local < 0) return null
    const dy = Math.abs(y - this.centre(0))
    const span = this.half * (0.25 + 0.85 * (1 - local))
    const notch = local < 0.35 ? this.half * 0.3 * (1 - local / 0.35) : 0
    return dy <= span && dy >= notch ? BLACK : null
  }
}

function surfaceAt(x: number, frame: number, waterline: number): number {
  return waterline + 0.7 * Math.sin(x * 0.35 - frame * 0.5) + 0.4 * Math.sin(x * 0.13 + frame * 0.3)
}

function backdrop(x: number, y: number, frame: number, waterline: number, height: number): Color {
  const surface = surfaceAt(x, frame, waterline)
  if (y < surface) return DEFAULT
  const below = y - surface
  if (below < 1) return Math.sin(x * 0.8 + frame * 0.6) > 0.2 ? FOAM : CREST
  const deepLine = waterline + (height - waterline) * 0.55 + 0.8 * Math.sin(x * 0.2 - frame * 0.25)
  return y < deepLine ? WATER_TOP : WATER_DEEP
}

function bubbleAt(x: number, y: number, frame: number, orca: Orca): boolean {
  for (let i = 0; i < 4; i += 1) {
    const age = (frame + i * 7) % 28
    const bx = orca.x0 + orca.length * 0.97 - age * 0.25 + Math.sin(age * 0.6 + i) * 0.8
    const by = orca.centre(1) + orca.half * 0.3 - age * 0.45
    if (Math.round(bx) === Math.round(x) && Math.round(by) === Math.round(y)) return true
  }
  return false
}

function spoutAt(x: number, y: number, frame: number, orca: Orca, waterline: number): boolean {
  const hole = orca.x0 + orca.length * 0.78
  const rise = waterline + 1 - y
  if (rise < 0) return false
  const height = orca.half * 1.4 + 2 * Math.sin(frame * 0.4)
  if (rise > height) return false
  const spread = 0.6 + (rise / height) ** 1.5 * height * 0.4
  const ragged = rise > height * 0.7 && Math.sin(x * 2.3 + y * 1.9 + frame * 1.3) < -0.3
  return Math.abs(x - hole) <= spread && !ragged
}

function layout(stage: Stage, frame: number, columns: number, legend: boolean) {
  const half = stage.length * 0.13
  const fin = Math.ceil(half * stage.finScale)
  const sky = fin + 1 + (legend ? Math.max(0, Math.ceil(half * 1.4) + 2 - fin) : 0)
  const below = Math.ceil(half * 2.6 + 0.5)
  const height = sky + below
  const travel = columns + stage.length
  const x0 = ((frame * 0.5) % travel) - stage.length
  const y0 = sky + half * 0.95 + 0.4 * Math.sin(frame * 0.15)
  return { height, waterline: sky, orca: new Orca(x0, y0, stage.length, stage.finScale, frame * 0.45) }
}

// Quadrant glyphs indexed by which of the four sub-pixels take the
// foreground: bit 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right.
const QUADRANTS = [
  0x20, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b,
  0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588,
]

function distance(a: Color, b: Color): number {
  if (a === b) return 0
  if (a === DEFAULT || b === DEFAULT) return 3 * 255 * 255
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255)
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255)
  const db = (a & 255) - (b & 255)
  return dr * dr + dg * dg + db * db
}

function cell(quad: Color[]): [number, Color, Color] {
  const counts = new Map<Color, number>()
  quad.forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1))
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const back = ranked[0]!
  if (ranked.length === 1) return [SPACE, DEFAULT, back]
  let fore = ranked[1]!
  let mask = 0
  quad.forEach((c, i) => {
    if (distance(c, fore) < distance(c, back)) mask |= 1 << i
  })
  let background = back
  if (fore === DEFAULT) {
    mask ^= 15
    ;[fore, background] = [background, fore]
  }
  return [QUADRANTS[mask]!, fore, background]
}

export function buildScene(tools: number, frame: number, columns: number, maxRows: number): Scene {
  const grown = stageIndexFor(tools)
  const width = Math.max(1, Math.min(512, columns))
  let shown = grown
  let plan = layout(STAGES[shown]!, frame, width, shown === STAGES.length - 1)
  while (shown > 0 && Math.ceil(plan.height / 2) > maxRows) {
    shown -= 1
    plan = layout(STAGES[shown]!, frame, width, false)
  }
  const rows = Math.max(1, Math.min(256, Math.ceil(plan.height / 2), maxRows))
  const heightPx = rows * 2
  const legend = shown === STAGES.length - 1
  const { orca, waterline } = plan

  let orcaPixels = 0
  // A sub-pixel is half a cell wide and half a cell tall: 0.5 by 1 scene units.
  const pixel = (x: number, y: number): Color => {
    const votes = new Map<Color, number>()
    let hits = 0
    for (let sy = 0; sy < SAMPLES; sy += 1) {
      for (let sx = 0; sx < SAMPLES; sx += 1) {
        const c = orca.colorAt(x + (sx + 0.5) / SAMPLES / 2, y + (sy + 0.5) / SAMPLES)
        if (c === null) continue
        hits += 1
        votes.set(c, (votes.get(c) ?? 0) + 1)
      }
    }
    if (hits * 2 >= SAMPLES * SAMPLES) {
      orcaPixels += 1
      let best = BLACK
      let most = 0
      votes.forEach((n, c) => {
        if (n > most) [best, most] = [c, n]
      })
      return best
    }
    if (legend && spoutAt(x + 0.25, y + 0.5, frame, orca, waterline)) return WHITE
    if (y > waterline + 1 && bubbleAt(x, y, frame, orca)) return BUBBLE
    return backdrop(x + 0.25, y + 0.5, frame, waterline, heightPx)
  }

  const cells = new Uint32Array(width * rows * 3)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const top = row * 2
      const quad = [pixel(col, top), pixel(col + 0.5, top), pixel(col, top + 1), pixel(col + 0.5, top + 1)]
      cells.set(cell(quad), (row * width + col) * 3)
    }
  }

  return { stage: STAGES[grown]!, stageNumber: grown + 1, columns: width, rows, cells, orcaPixels }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function encodeCells(cells: Uint32Array): string {
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += b === undefined ? '=' : ALPHABET[(n >> 6) & 63]!
    out += c === undefined ? '=' : ALPHABET[n & 63]!
  }
  return out
}
