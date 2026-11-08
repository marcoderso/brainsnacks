const ROWS = 6
const COLS = 7

export function createEmptyBoard(): string[] {
  return Array(ROWS * COLS).fill("")
}

export function getCell(board: string[], row: number, col: number): string {
  return board[row * COLS + col]
}

export function setCell(board: string[], row: number, col: number, value: string): string[] {
  const newBoard = [...board]
  newBoard[row * COLS + col] = value
  return newBoard
}

export function dropPiece(board: string[], col: number, player: string): { board: string[]; row: number } | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (getCell(board, row, col) === "") {
      return { board: setCell(board, row, col, player), row }
    }
  }
  return null
}

export function checkConnectFourWinner(board: string[]): string | null {
  // Check horizontal
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      const cell = getCell(board, row, col)
      if (
        cell &&
        cell === getCell(board, row, col + 1) &&
        cell === getCell(board, row, col + 2) &&
        cell === getCell(board, row, col + 3)
      ) {
        return cell
      }
    }
  }

  // Check vertical
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = getCell(board, row, col)
      if (
        cell &&
        cell === getCell(board, row + 1, col) &&
        cell === getCell(board, row + 2, col) &&
        cell === getCell(board, row + 3, col)
      ) {
        return cell
      }
    }
  }

  // Check diagonal (down-right)
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      const cell = getCell(board, row, col)
      if (
        cell &&
        cell === getCell(board, row + 1, col + 1) &&
        cell === getCell(board, row + 2, col + 2) &&
        cell === getCell(board, row + 3, col + 3)
      ) {
        return cell
      }
    }
  }

  // Check diagonal (down-left)
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 3; col < COLS; col++) {
      const cell = getCell(board, row, col)
      if (
        cell &&
        cell === getCell(board, row + 1, col - 1) &&
        cell === getCell(board, row + 2, col - 2) &&
        cell === getCell(board, row + 3, col - 3)
      ) {
        return cell
      }
    }
  }

  return null
}

export function checkConnectFourDraw(board: string[]): boolean {
  return board.every((cell) => cell !== "") && !checkConnectFourWinner(board)
}

export function isColumnFull(board: string[], col: number): boolean {
  return getCell(board, 0, col) !== ""
}
