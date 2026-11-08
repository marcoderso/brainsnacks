"use client"

import { Button } from "@/components/ui/button"

interface GameBoardProps {
  board: string[]
  onCellClick: (index: number) => void
  disabled: boolean
}

export function GameBoard({ board, onCellClick, disabled }: GameBoardProps) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] sm:max-w-xs mx-auto">
      {board.map((cell, index) => (
        <Button
          key={index}
          variant="outline"
          className="aspect-square h-20 sm:h-24 text-3xl sm:text-4xl font-bold hover:bg-muted disabled:opacity-100"
          onClick={() => onCellClick(index)}
          disabled={disabled || cell !== ""}
        >
          <span className={cell === "X" ? "text-blue-500" : "text-rose-500"}>
            {cell}
          </span>
        </Button>
      ))}
    </div>
  )
}
