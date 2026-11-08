export const BOARD_SIZE = 10
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE

export interface Ship {
  id: string
  name: string
  size: number
  positions: number[]
  hits: number[]
}

export const SHIP_TYPES = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
]

export function createEmptyBoard(): string[] {
  return Array(TOTAL_CELLS).fill("")
}

export function indexToCoord(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
  }
}

export function coordToIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col
}

export function canPlaceShip(
  board: string[],
  startIndex: number,
  size: number,
  horizontal: boolean
): boolean {
  const { row, col } = indexToCoord(startIndex)

  if (horizontal) {
    if (col + size > BOARD_SIZE) return false
    for (let i = 0; i < size; i++) {
      if (board[startIndex + i] !== "") return false
    }
  } else {
    if (row + size > BOARD_SIZE) return false
    for (let i = 0; i < size; i++) {
      if (board[startIndex + i * BOARD_SIZE] !== "") return false
    }
  }

  return true
}

export function placeShip(
  board: string[],
  startIndex: number,
  shipId: string,
  size: number,
  horizontal: boolean
): { board: string[]; positions: number[] } | null {
  if (!canPlaceShip(board, startIndex, size, horizontal)) return null

  const newBoard = [...board]
  const positions: number[] = []

  for (let i = 0; i < size; i++) {
    const index = horizontal ? startIndex + i : startIndex + i * BOARD_SIZE
    newBoard[index] = shipId
    positions.push(index)
  }

  return { board: newBoard, positions }
}

export function processShot(
  targetBoard: string[],
  ships: Ship[],
  shotIndex: number
): { hit: boolean; sunk: Ship | null; allSunk: boolean } {
  const cellValue = targetBoard[shotIndex]

  if (cellValue === "" || cellValue === "miss" || cellValue === "hit") {
    return { hit: false, sunk: null, allSunk: false }
  }

  // It's a hit
  const ship = ships.find((s) => s.id === cellValue)
  if (!ship) return { hit: true, sunk: null, allSunk: false }

  const updatedShip = {
    ...ship,
    hits: [...ship.hits, shotIndex],
  }

  const isSunk = updatedShip.hits.length === updatedShip.positions.length

  // Check if all ships are sunk
  const updatedShips = ships.map((s) =>
    s.id === ship.id ? updatedShip : s
  )
  const allSunk = updatedShips.every(
    (s) => s.hits.length === s.positions.length
  )

  return {
    hit: true,
    sunk: isSunk ? updatedShip : null,
    allSunk,
  }
}

export function getShipAt(ships: Ship[], index: number): Ship | undefined {
  return ships.find((s) => s.positions.includes(index))
}

export function isValidShot(shots: string[], index: number): boolean {
  return !shots.includes(index.toString())
}

export function autoPlaceShips(): { board: string[]; ships: Ship[] } {
  let board = createEmptyBoard()
  const ships: Ship[] = []

  for (const shipType of SHIP_TYPES) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 100) {
      const horizontal = Math.random() > 0.5
      const startIndex = Math.floor(Math.random() * TOTAL_CELLS)

      const result = placeShip(
        board,
        startIndex,
        shipType.id,
        shipType.size,
        horizontal
      )

      if (result) {
        board = result.board
        ships.push({
          id: shipType.id,
          name: shipType.name,
          size: shipType.size,
          positions: result.positions,
          hits: [],
        })
        placed = true
      }

      attempts++
    }
  }

  return { board, ships }
}

export function allShipsSunk(ships: Ship[]): boolean {
  return ships.every((s) => s.hits.length === s.positions.length)
}
