// Simplified 8-ball rules.
//
// - Break: table stays open afterwards. Pocketing any ball continues the turn.
//   The 8 pocketed on the break is re-spotted.
// - Open table: the first ball pocketed after the break decides the groups.
// - A player continues as long as they pocket one of their own balls.
// - Fouls (no ball hit, wrong ball hit first, cue ball pocketed) give the
//   opponent ball in hand anywhere on the table.
// - The 8 wins once all own balls are cleared; pocketing it earlier or with a
//   foul loses the game. No called pockets.

import {
  Ball,
  BALL_R,
  CUE_START,
  FOOT_SPOT,
  SimulationResult,
  TABLE_W,
  findFreeSpot,
} from "@/lib/billiard-physics"

export type Role = "X" | "O"
export type Group = "solids" | "stripes"
export type BallInHand = "kitchen" | "anywhere" | null

export interface BilliardState {
  balls: Ball[]
  groups: { X: Group | null; O: Group | null }
  ballInHand: BallInHand
  isBreak: boolean
  message: string | null
}

export interface BilliardShotRecord {
  seq: number
  by: Role
  dx: number
  dy: number
  power: number
  start: Ball[]
}

export const GROUP_LABEL: Record<Group, string> = {
  solids: "Solids",
  stripes: "Stripes",
}

export function groupOf(n: number): Group | null {
  if (n >= 1 && n <= 7) return "solids"
  if (n >= 9 && n <= 15) return "stripes"
  return null
}

export function otherGroup(g: Group): Group {
  return g === "solids" ? "stripes" : "solids"
}

export function remainingInGroup(balls: Ball[], g: Group): number {
  return balls.filter((b) => groupOf(b.n) === g).length
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createRack(): Ball[] {
  // 15 slots, apex towards the head (bottom), rows going up the table.
  // Slot 4 (middle of the third row) holds the 8, the back corners
  // (slots 10 and 14) hold one solid and one stripe.
  const solids = shuffle([1, 2, 3, 4, 5, 6, 7])
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15])
  const cornerSolid = solids.pop()!
  const cornerStripe = stripes.pop()!
  const rest = shuffle([...solids, ...stripes])

  const order: number[] = []
  for (let slot = 0; slot < 15; slot++) {
    if (slot === 4) order.push(8)
    else if (slot === 10) order.push(Math.random() < 0.5 ? cornerSolid : cornerStripe)
    else if (slot === 14) order.push(order[10] === cornerSolid ? cornerStripe : cornerSolid)
    else order.push(rest.pop()!)
  }

  const spacing = BALL_R * 2 + 0.05
  const rowStep = (spacing * Math.sqrt(3)) / 2
  const balls: Ball[] = []
  let slot = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({
        n: order[slot++],
        x: TABLE_W / 2 + (i - row / 2) * spacing,
        y: FOOT_SPOT.y - row * rowStep,
      })
    }
  }
  return balls
}

export function createInitialState(): BilliardState {
  return {
    balls: [{ n: 0, x: CUE_START.x, y: CUE_START.y }, ...createRack()],
    groups: { X: null, O: null },
    ballInHand: "kitchen",
    isBreak: true,
    message: null,
  }
}

export interface ShotOutcome {
  state: BilliardState
  nextTurn: Role
  winner: Role | null
}

export function applyShot(prev: BilliardState, shooter: Role, sim: SimulationResult): ShotOutcome {
  const opponent: Role = shooter === "X" ? "O" : "X"
  const pocketed = sim.pocketed
  const objectPocketed = pocketed.filter((n) => n !== 0 && n !== 8)
  const scratch = pocketed.includes(0)
  const eightIn = pocketed.includes(8)

  const myGroup = prev.groups[shooter]
  const clearedBefore = myGroup !== null && remainingInGroup(prev.balls, myGroup) === 0

  // ---- Fouls ----
  let foul: string | null = null
  if (sim.firstHit === null) {
    foul = "No ball hit"
  } else if (!prev.isBreak) {
    if (myGroup === null) {
      if (sim.firstHit === 8) foul = "Hit the 8 first"
    } else if (clearedBefore) {
      if (sim.firstHit !== 8) foul = "Must hit the 8 first"
    } else if (groupOf(sim.firstHit) !== myGroup) {
      foul = "Hit an opponent ball first"
    }
  }
  if (scratch) foul = "Scratch"

  let balls = sim.final.map((b) => ({ ...b }))

  // ---- The 8 ----
  if (eightIn) {
    if (prev.isBreak) {
      const spot = findFreeSpot(balls, FOOT_SPOT.x, FOOT_SPOT.y)
      balls.push({ n: 8, x: spot.x, y: spot.y })
    } else {
      const won = clearedBefore && !foul
      return {
        state: {
          ...prev,
          balls,
          ballInHand: null,
          isBreak: false,
          message: won ? "8-ball sunk!" : foul ? `Foul on the 8: ${foul}` : "8-ball sunk too early",
        },
        nextTurn: prev.isBreak ? shooter : opponent,
        winner: won ? shooter : opponent,
      }
    }
  }

  // ---- Groups ----
  const groups = { ...prev.groups }
  let message: string | null = null
  if (!prev.isBreak && myGroup === null && !foul && objectPocketed.length > 0) {
    const g = groupOf(objectPocketed[0])!
    groups[shooter] = g
    groups[opponent] = otherGroup(g)
    message = `Groups assigned`
  }

  // ---- Next turn ----
  const newGroup = groups[shooter]
  let continueTurn = false
  if (!foul) {
    continueTurn =
      newGroup === null
        ? objectPocketed.length > 0
        : objectPocketed.some((n) => groupOf(n) === newGroup)
  }

  if (scratch) {
    const spot = findFreeSpot(balls, CUE_START.x, CUE_START.y)
    balls = [{ n: 0, x: spot.x, y: spot.y }, ...balls]
  }

  if (foul) message = `Foul: ${foul} – ball in hand`
  else if (prev.isBreak && eightIn) message = "8-ball on the break – re-spotted"

  return {
    state: {
      balls,
      groups,
      ballInHand: foul ? "anywhere" : null,
      isBreak: false,
      message,
    },
    nextTurn: continueTurn ? shooter : opponent,
    winner: null,
  }
}
