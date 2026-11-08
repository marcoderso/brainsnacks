"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { 
  BOARD_SIZE, 
  SHIP_TYPES, 
  Ship, 
  createEmptyBoard, 
  canPlaceShip, 
  placeShip,
  autoPlaceShips 
} from "@/lib/battleship-utils"
import { RotateCw, Shuffle, Check } from "lucide-react"

interface ShipPlacementProps {
  onConfirm: (board: string[], ships: Ship[]) => void
}

export function ShipPlacement({ onConfirm }: ShipPlacementProps) {
  const [board, setBoard] = useState<string[]>(createEmptyBoard())
  const [ships, setShips] = useState<Ship[]>([])
  const [selectedShip, setSelectedShip] = useState<typeof SHIP_TYPES[0] | null>(null)
  const [isHorizontal, setIsHorizontal] = useState(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const placedShipIds = ships.map(s => s.id)
  const availableShips = SHIP_TYPES.filter(s => !placedShipIds.includes(s.id))

  const getPreviewPositions = useCallback((startIndex: number, size: number, horizontal: boolean): number[] => {
    const positions: number[] = []
    const row = Math.floor(startIndex / BOARD_SIZE)
    const col = startIndex % BOARD_SIZE

    for (let i = 0; i < size; i++) {
      if (horizontal) {
        if (col + i < BOARD_SIZE) {
          positions.push(startIndex + i)
        }
      } else {
        if (row + i < BOARD_SIZE) {
          positions.push(startIndex + i * BOARD_SIZE)
        }
      }
    }

    return positions
  }, [])

  const handleCellClick = (index: number) => {
    if (!selectedShip) return

    const result = placeShip(board, index, selectedShip.id, selectedShip.size, isHorizontal)
    if (result) {
      setBoard(result.board)
      setShips([...ships, {
        id: selectedShip.id,
        name: selectedShip.name,
        size: selectedShip.size,
        positions: result.positions,
        hits: [],
      }])
      setSelectedShip(null)
      setHoverIndex(null)
    }
  }

  const handleCellHover = (index: number) => {
    if (selectedShip) {
      setHoverIndex(index)
    }
  }

  const handleRandomPlace = () => {
    const { board: newBoard, ships: newShips } = autoPlaceShips()
    setBoard(newBoard)
    setShips(newShips)
    setSelectedShip(null)
    setHoverIndex(null)
  }

  const handleReset = () => {
    setBoard(createEmptyBoard())
    setShips([])
    setSelectedShip(null)
    setHoverIndex(null)
  }

  const handleConfirm = () => {
    if (ships.length === 5) {
      onConfirm(board, ships)
    }
  }

  const getCellState = (index: number): "empty" | "ship" | "preview-valid" | "preview-invalid" => {
    // Check if cell has a placed ship
    if (board[index] !== "") {
      return "ship"
    }

    // Check for preview
    if (selectedShip && hoverIndex !== null) {
      const previewPositions = getPreviewPositions(hoverIndex, selectedShip.size, isHorizontal)
      if (previewPositions.includes(index)) {
        const isValid = canPlaceShip(board, hoverIndex, selectedShip.size, isHorizontal)
        return isValid ? "preview-valid" : "preview-invalid"
      }
    }

    return "empty"
  }

  const getCellClass = (state: "empty" | "ship" | "preview-valid" | "preview-invalid") => {
    const base = "aspect-square w-full rounded-sm transition-colors"
    switch (state) {
      case "ship":
        return `${base} bg-blue-500 dark:bg-blue-400`
      case "preview-valid":
        return `${base} bg-green-400/60 dark:bg-green-500/60`
      case "preview-invalid":
        return `${base} bg-rose-400/60 dark:bg-rose-500/60`
      default:
        return `${base} bg-sky-100 dark:bg-sky-900 hover:bg-sky-200 dark:hover:bg-sky-800`
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Available Ships */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-muted-foreground">Ships to place:</div>
        <div className="flex flex-wrap gap-2">
          {availableShips.map(ship => (
            <Button
              key={ship.id}
              variant={selectedShip?.id === ship.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedShip(selectedShip?.id === ship.id ? null : ship)}
              className="flex items-center gap-2"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: ship.size }).map((_, i) => (
                  <div key={i} className="w-2 h-2 bg-current rounded-sm" />
                ))}
              </div>
              <span className="text-xs">{ship.name}</span>
            </Button>
          ))}
        </div>
        {availableShips.length === 0 && (
          <p className="text-sm text-green-600 dark:text-green-400">All ships placed!</p>
        )}
      </div>

      {/* Rotation toggle */}
      {selectedShip && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHorizontal(!isHorizontal)}
          >
            <RotateCw className="h-4 w-4 mr-2" />
            {isHorizontal ? "Horizontal" : "Vertical"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Click on the board to place {selectedShip.name}
          </span>
        </div>
      )}

      {/* Board */}
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

              return (
                <button
                  key={index}
                  className={getCellClass(state)}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => handleCellHover(index)}
                  onMouseLeave={() => setHoverIndex(null)}
                  disabled={!selectedShip || state === "ship"}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleRandomPlace} className="flex-1">
          <Shuffle className="h-4 w-4 mr-2" />
          Random
        </Button>
        <Button variant="outline" onClick={handleReset} className="flex-1">
          Reset
        </Button>
        <Button 
          onClick={handleConfirm} 
          disabled={ships.length !== 5}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          Ready
        </Button>
      </div>
    </div>
  )
}
