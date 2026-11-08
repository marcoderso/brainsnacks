"use client"

import { Button } from "@/components/ui/button"
import { isColumnFull } from "@/lib/connect-four-utils"
import { ChevronDown } from "lucide-react"

interface ConnectFourBoardProps {
  board: string[]
  onColumnClick: (col: number) => void
  disabled: boolean
  currentTurn: string
}

const ROWS = 6
const COLS = 7

export function ConnectFourBoard({
  board,
  onColumnClick,
  disabled,
  currentTurn,
}: ConnectFourBoardProps) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-[350px] sm:max-w-[400px] mx-auto">
      {/* Column buttons */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: COLS }).map((_, col) => (
          <Button
            key={col}
            variant="ghost"
            size="sm"
            className="h-8 p-0"
            onClick={() => onColumnClick(col)}
            disabled={disabled || isColumnFull(board, col)}
          >
            <ChevronDown
              className={`h-4 w-4 ${
                currentTurn === "X" ? "text-blue-500" : "text-rose-500"
              }`}
            />
          </Button>
        ))}
      </div>

      {/* Game board */}
      <div className="bg-black dark:bg-white p-2 rounded-lg">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: ROWS }).map((_, row) =>
            Array.from({ length: COLS }).map((_, col) => {
              const index = row * COLS + col
              const cell = board[index]
              return (
                <button
                  key={index}
                  className="aspect-square w-full bg-neutral-900 dark:bg-neutral-100 rounded-full flex items-center justify-center"
                  onClick={() => onColumnClick(col)}
                  disabled={disabled || isColumnFull(board, col)}
                >
                  <div
                    className={`w-[85%] h-[85%] rounded-full transition-colors ${
                      cell === "X"
                        ? "bg-blue-500"
                        : cell === "O"
                        ? "bg-rose-500"
                        : "bg-neutral-700 dark:bg-neutral-300"
                    }`}
                  />
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
