// Billiard physics for a portrait table.
//
// The simulation is deterministic: it uses a fixed timestep and only basic
// arithmetic plus Math.sqrt (which IEEE 754 requires to be correctly rounded),
// so both players compute the same result from the same shot. Trigonometric
// functions are deliberately avoided here because their results may differ
// between JavaScript engines.

export const TABLE_W = 500
export const TABLE_H = 1000
export const BALL_R = 14
export const RAIL = 28 // visual rail width around the playing area

export const FOOT_SPOT = { x: TABLE_W / 2, y: TABLE_H / 4 }
export const HEAD_STRING_Y = (TABLE_H * 3) / 4
export const CUE_START = { x: TABLE_W / 2, y: TABLE_H * 0.8 }

export const MAX_SPEED = 3200 // units per second at full power

const DT = 1 / 480
const STEPS_PER_FRAME = 8 // 480 / 8 = 60 recorded frames per second
const MAX_STEPS = 480 * 20
const ROLL_DECEL = 150 // constant rolling resistance (units/s²)
const DRAG = 0.8 // speed-proportional drag (1/s)
const STOP_SPEED = 2
const BALL_RESTITUTION = 0.94
const CUSHION_RESTITUTION = 0.78

const CORNER_GAP = 32
const SIDE_GAP = 24

export interface Ball {
  n: number // 0 = cue ball, 1-7 solids, 8 = eight ball, 9-15 stripes
  x: number
  y: number
}

export interface Pocket {
  x: number
  y: number
  r: number // capture radius for the ball center
}

export const POCKETS: Pocket[] = [
  { x: 0, y: 0, r: 28 },
  { x: TABLE_W, y: 0, r: 28 },
  { x: -6, y: TABLE_H / 2, r: 24 },
  { x: TABLE_W + 6, y: TABLE_H / 2, r: 24 },
  { x: 0, y: TABLE_H, r: 28 },
  { x: TABLE_W, y: TABLE_H, r: 28 },
]

interface Segment {
  ax: number
  ay: number
  bx: number
  by: number
}

// Cushions with gaps at the pockets. The segment end points act as pocket jaws.
const CUSHIONS: Segment[] = [
  { ax: CORNER_GAP, ay: 0, bx: TABLE_W - CORNER_GAP, by: 0 },
  { ax: CORNER_GAP, ay: TABLE_H, bx: TABLE_W - CORNER_GAP, by: TABLE_H },
  { ax: 0, ay: CORNER_GAP, bx: 0, by: TABLE_H / 2 - SIDE_GAP },
  { ax: 0, ay: TABLE_H / 2 + SIDE_GAP, bx: 0, by: TABLE_H - CORNER_GAP },
  { ax: TABLE_W, ay: CORNER_GAP, bx: TABLE_W, by: TABLE_H / 2 - SIDE_GAP },
  { ax: TABLE_W, ay: TABLE_H / 2 + SIDE_GAP, bx: TABLE_W, by: TABLE_H - CORNER_GAP },
]

export interface Shot {
  dx: number // unit direction vector
  dy: number
  power: number // 0..1
}

export interface SimulationResult {
  frames: Ball[][]
  final: Ball[]
  pocketed: number[] // ball numbers in the order they dropped
  firstHit: number | null // first object ball touched by the cue ball
}

export function shotSpeed(power: number): number {
  const p = Math.min(1, Math.max(0.02, power))
  return MAX_SPEED * p * Math.sqrt(p)
}

interface SimBall {
  n: number
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
}

function snapshot(balls: SimBall[]): Ball[] {
  const out: Ball[] = []
  for (const b of balls) {
    if (b.active) out.push({ n: b.n, x: b.x, y: b.y })
  }
  return out
}

export function simulate(start: Ball[], shot: Shot): SimulationResult {
  const balls: SimBall[] = start.map((b) => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, active: true }))
  const cue = balls.find((b) => b.n === 0)
  const pocketed: number[] = []
  let firstHit: number | null = null

  if (cue) {
    const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1
    const speed = shotSpeed(shot.power)
    cue.vx = (shot.dx / len) * speed
    cue.vy = (shot.dy / len) * speed
  }

  const frames: Ball[][] = [snapshot(balls)]
  const minDist = BALL_R * 2

  for (let step = 1; step <= MAX_STEPS; step++) {
    let moving = false

    // Integrate positions and apply rolling friction
    for (const b of balls) {
      if (!b.active) continue
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
      if (speed === 0) continue
      b.x += b.vx * DT
      b.y += b.vy * DT
      const newSpeed = speed - (ROLL_DECEL + DRAG * speed) * DT
      if (newSpeed <= STOP_SPEED) {
        b.vx = 0
        b.vy = 0
      } else {
        const f = newSpeed / speed
        b.vx *= f
        b.vy *= f
        moving = true
      }
    }

    // Pockets (plus a safety net for balls that escaped the table)
    for (const b of balls) {
      if (!b.active) continue
      let drop = false
      for (const p of POCKETS) {
        const dx = b.x - p.x
        const dy = b.y - p.y
        if (dx * dx + dy * dy < p.r * p.r) {
          drop = true
          break
        }
      }
      if (
        !drop &&
        (b.x < -BALL_R || b.x > TABLE_W + BALL_R || b.y < -BALL_R || b.y > TABLE_H + BALL_R)
      ) {
        drop = true
      }
      if (drop) {
        b.active = false
        b.vx = 0
        b.vy = 0
        pocketed.push(b.n)
      }
    }

    // Cushions and pocket jaws
    for (const b of balls) {
      if (!b.active) continue
      for (const s of CUSHIONS) {
        const ex = s.bx - s.ax
        const ey = s.by - s.ay
        let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / (ex * ex + ey * ey)
        if (t < 0) t = 0
        else if (t > 1) t = 1
        const qx = s.ax + ex * t
        const qy = s.ay + ey * t
        const dx = b.x - qx
        const dy = b.y - qy
        const d2 = dx * dx + dy * dy
        if (d2 >= BALL_R * BALL_R) continue
        let nx: number
        let ny: number
        let dist = Math.sqrt(d2)
        if (dist > 1e-9) {
          nx = dx / dist
          ny = dy / dist
        } else {
          // Ball center exactly on the cushion line: push towards the table
          nx = s.ax === s.bx ? (s.ax === 0 ? 1 : -1) : 0
          ny = s.ay === s.by ? (s.ay === 0 ? 1 : -1) : 0
          dist = 0
        }
        b.x += nx * (BALL_R - dist)
        b.y += ny * (BALL_R - dist)
        const vn = b.vx * nx + b.vy * ny
        if (vn < 0) {
          b.vx -= (1 + CUSHION_RESTITUTION) * vn * nx
          b.vy -= (1 + CUSHION_RESTITUTION) * vn * ny
        }
      }
    }

    // Ball-ball collisions (equal masses)
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]
      if (!a.active) continue
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]
        if (!b.active) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy
        if (d2 >= minDist * minDist || d2 === 0) continue
        const dist = Math.sqrt(d2)
        const nx = dx / dist
        const ny = dy / dist
        const overlap = (minDist - dist) / 2
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        if (vn > 0) {
          const imp = ((1 + BALL_RESTITUTION) / 2) * vn
          a.vx -= imp * nx
          a.vy -= imp * ny
          b.vx += imp * nx
          b.vy += imp * ny
          moving = true
          if (firstHit === null) {
            if (a.n === 0) firstHit = b.n
            else if (b.n === 0) firstHit = a.n
          }
        }
      }
    }

    if (step % STEPS_PER_FRAME === 0 || !moving) {
      frames.push(snapshot(balls))
    }
    if (!moving) break
  }

  return { frames, final: snapshot(balls), pocketed, firstHit }
}

// ---------- Helpers for placing balls ----------

export function isFreeSpot(balls: Ball[], x: number, y: number, ignore?: number): boolean {
  if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) return false
  for (const b of balls) {
    if (b.n === ignore) continue
    const dx = b.x - x
    const dy = b.y - y
    if (dx * dx + dy * dy < (BALL_R * 2 + 0.5) ** 2) return false
  }
  for (const p of POCKETS) {
    const dx = p.x - x
    const dy = p.y - y
    if (dx * dx + dy * dy < (p.r + 4) ** 2) return false
  }
  return true
}

// Finds the closest free spot along a vertical line, starting at (x, y).
export function findFreeSpot(balls: Ball[], x: number, y: number, ignore?: number): { x: number; y: number } {
  for (let i = 0; i < 200; i++) {
    const offset = Math.ceil(i / 2) * 4 * (i % 2 === 0 ? 1 : -1)
    const cy = y + offset
    if (isFreeSpot(balls, x, cy, ignore)) return { x, y: cy }
  }
  for (let i = 0; i < 2000; i++) {
    const cx = BALL_R + ((i * 37) % (TABLE_W - 2 * BALL_R))
    const cy = BALL_R + ((i * 53) % (TABLE_H - 2 * BALL_R))
    if (isFreeSpot(balls, cx, cy, ignore)) return { x: cx, y: cy }
  }
  return { x, y }
}

// ---------- Aim helper (UI only, not part of the deterministic simulation) ----------

export interface AimPreview {
  ghost: { x: number; y: number }
  target: Ball | null
  targetDir: { x: number; y: number } | null
}

export function previewAim(balls: Ball[], cue: { x: number; y: number }, dir: { x: number; y: number }): AimPreview {
  let bestT = Infinity
  let target: Ball | null = null

  for (const b of balls) {
    if (b.n === 0) continue
    // Solve |cue + t*dir - b| = 2R for the smallest positive t
    const fx = cue.x - b.x
    const fy = cue.y - b.y
    const bq = fx * dir.x + fy * dir.y
    const c = fx * fx + fy * fy - 4 * BALL_R * BALL_R
    const disc = bq * bq - c
    if (disc < 0) continue
    const t = -bq - Math.sqrt(disc)
    if (t > 0 && t < bestT) {
      bestT = t
      target = b
    }
  }

  // Cushion bounds for the ball center
  const walls: number[] = []
  if (dir.x > 0) walls.push((TABLE_W - BALL_R - cue.x) / dir.x)
  if (dir.x < 0) walls.push((BALL_R - cue.x) / dir.x)
  if (dir.y > 0) walls.push((TABLE_H - BALL_R - cue.y) / dir.y)
  if (dir.y < 0) walls.push((BALL_R - cue.y) / dir.y)
  const wallT = Math.max(0, Math.min(...walls))
  if (wallT < bestT) {
    bestT = wallT
    target = null
  }

  const ghost = { x: cue.x + dir.x * bestT, y: cue.y + dir.y * bestT }
  let targetDir: { x: number; y: number } | null = null
  if (target) {
    const dx = target.x - ghost.x
    const dy = target.y - ghost.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    targetDir = { x: dx / len, y: dy / len }
  }
  return { ghost, target, targetDir }
}
