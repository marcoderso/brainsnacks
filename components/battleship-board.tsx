"use client"

import { BOARD_SIZE, Ship } from "@/lib/battleship-utils"

interface BattleshipBoardProps {
  board: string[]
  ships?: Ship[]
  shots?: string[]
  onCellClick?: (index: number) => void
  disabled?: boolean
  isOpponentBoard?: boolean
  showShips?: boolean
}

export function BattleshipBoard({
  board,
  ships = [],
  shots = [],
  onCellClick,
  disabled = false,
  isOpponentBoard = false,
  showShips = true,
}: BattleshipBoardProps) {
  const getCellState = (index: number): "empty" | "ship" | "hit" | "miss" | "sunk" => {
    const isShot = shots.includes(index.toString())
    const cellValue = board[index]

    if (isOpponentBoard) {
      if (!isShot) return "empty"
      if (cellValue && cellValue !== "" && cellValue !== "miss") {
        // Check if ship is sunk
        const ship = ships.find((s) => s.id === cellValue)
        if (ship && ship.hits.length === ship.positions.length) {
          return "sunk"
        }
        return "hit"
      }
      return "miss"
    } else {
      // Own board
      if (isShot && cellValue && cellValue !== "" && cellValue !== "miss") {
        const ship = ships.find((s) => s.id === cellValue)
        if (ship && ship.hits.length === ship.positions.length) {
          return "sunk"
        }
        return "hit"
      }
      if (isShot) return "miss"
      if (cellValue && cellValue !== "" && showShips) return "ship"
      return "empty"
    }
  }

  const getCellClass = (state: "empty" | "ship" | "hit" | "miss" | "sunk") => {
    const base = "aspect-square w-full rounded-sm transition-colors flex items-center justify-center text-xs font-bold"
    switch (state) {
      case "ship":
        return `${base} bg-blue-500 dark:bg-blue-400`
      case "hit":
        return `${base} bg-rose-500 dark:bg-rose-400 text-white`
      case "miss":
        return `${base} bg-muted`
      case "sunk":
        return `${base} bg-rose-700 dark:bg-rose-600 text-white`
      default:
        return `${base} bg-sky-100 dark:bg-sky-900 hover:bg-sky-200 dark:hover:bg-sky-800`
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Column headers */}
      <div className="grid grid-cols-[auto_repeat(10,1fr)] gap-0.5">
        <div className="w-4" />
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Board rows */}
      {Array.from({ length: BOARD_SIZE }).map((_, row) => (
        <div key={row} className="grid grid-cols-[auto_repeat(10,1fr)] gap-0.5">
          <div className="w-4 flex items-center justify-center text-xs text-muted-foreground">
            {String.fromCharCode(65 + row)}
          </div>
          {Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const index = row * BOARD_SIZE + col
            const state = getCellState(index)
            const isClickable = isOpponentBoard && !disabled && state === "empty"

            return (
              <button
                key={index}
                className={getCellClass(state)}
                onClick={() => isClickable && onCellClick?.(index)}
                disabled={!isClickable}
              >
                {state === "hit" && "X"}
                {state === "sunk" && "X"}
                {state === "miss" && "•"}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
