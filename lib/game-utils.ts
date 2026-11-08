export const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export function checkWinner(board: string[]): string | null {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return null
}

export function checkDraw(board: string[]): boolean {
  return board.every((cell) => cell !== "") && !checkWinner(board)
}

export function generatePlayerId(): string {
  if (typeof window === "undefined") return ""
  let playerId = localStorage.getItem("tictactoe_player_id")
  if (!playerId) {
    playerId = crypto.randomUUID()
    localStorage.setItem("tictactoe_player_id", playerId)
  }
  return playerId
}

export function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
