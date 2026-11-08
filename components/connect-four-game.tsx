"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ConnectFourBoard } from "@/components/connect-four-board"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { generatePlayerId, generateGameCode } from "@/lib/game-utils"
import {
  createEmptyBoard,
  dropPiece,
  checkConnectFourWinner,
  checkConnectFourDraw,
} from "@/lib/connect-four-utils"
import { Copy, Users, RefreshCw, ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface Game {
  id: string
  board: string[]
  current_turn: string
  player_x: string | null
  player_x_name: string | null
  player_o: string | null
  player_o_name: string | null
  winner: string | null
  status: string
  game_type: string
  round_starter: string
}

interface ConnectFourGameProps {
  onBack: () => void
  initialGameId?: string
  username?: string | null
}

export function ConnectFourGame({ onBack, initialGameId, username }: ConnectFourGameProps) {
  const [game, setGame] = useState<Game | null>(null)
  const [playerId, setPlayerId] = useState<string>("")
  const [gameIdInput, setGameIdInput] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [copied, setCopied] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    setPlayerId(generatePlayerId())
  }, [])

  // Auto-join game if initialGameId is provided (from matchmaking)
  useEffect(() => {
    if (!initialGameId || !playerId || game) return

    const fetchGame = async () => {
      const { data } = await supabase
        .from("games")
        .select()
        .eq("id", initialGameId)
        .single()

      if (data) {
        setGame(data)
      }
    }

    fetchGame()
  }, [initialGameId, playerId, game, supabase])

  const getPlayerRole = useCallback((): "X" | "O" | null => {
    if (!game || !playerId) return null
    if (game.player_x === playerId) return "X"
    if (game.player_o === playerId) return "O"
    return null
  }, [game, playerId])

  const isMyTurn = useCallback((): boolean => {
    const role = getPlayerRole()
    if (!role || !game) return false
    return game.current_turn === role
  }, [game, getPlayerRole])

  useEffect(() => {
    if (!game?.id) return

    const channel = supabase
      .channel(`game:${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          setGame(payload.new as Game)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game?.id, supabase])

  const createGame = async () => {
    setLoading(true)
    setError("")

    const gameCode = generateGameCode()
    const emptyBoard = createEmptyBoard()

    const { data, error: createError } = await supabase
      .from("games")
      .insert({
        id: gameCode,
        board: emptyBoard,
        player_x: playerId,
        player_x_name: username || null,
        status: "waiting",
        game_type: "connectfour",
      })
      .select()
      .single()

    if (createError) {
      setError("Failed to create game")
      setLoading(false)
      return
    }

    setGame(data)
    setLoading(false)
  }

  const joinGame = async () => {
    if (!gameIdInput.trim()) {
      setError("Please enter a game code")
      return
    }

    setLoading(true)
    setError("")

    const gameCode = gameIdInput.trim().toUpperCase()

    const { data: existingGame, error: fetchError } = await supabase
      .from("games")
      .select()
      .eq("id", gameCode)
      .eq("game_type", "connectfour")
      .single()

    if (fetchError || !existingGame) {
      setError("Game not found")
      setLoading(false)
      return
    }

    if (existingGame.player_x === playerId) {
      setGame(existingGame)
      setLoading(false)
      return
    }

    if (existingGame.player_o && existingGame.player_o !== playerId) {
      setError("Game is full")
      setLoading(false)
      return
    }

    if (!existingGame.player_o) {
      const { data, error: updateError } = await supabase
        .from("games")
        .update({
          player_o: playerId,
          player_o_name: username || null,
          status: "playing",
        })
        .eq("id", gameCode)
        .select()
        .single()

      if (updateError) {
        setError("Failed to join game")
        setLoading(false)
        return
      }

      setGame(data)
    } else {
      setGame(existingGame)
    }

    setLoading(false)
  }

  const makeMove = async (col: number) => {
    if (!game || !isMyTurn() || game.status !== "playing") return

    const role = getPlayerRole()
    if (!role) return

    const result = dropPiece(game.board, col, role)
    if (!result) return

    const winner = checkConnectFourWinner(result.board)
    const isDraw = checkConnectFourDraw(result.board)

    const updates: Partial<Game> = {
      board: result.board,
      current_turn: role === "X" ? "O" : "X",
    }

    if (winner) {
      updates.winner = winner
      updates.status = "finished"
    } else if (isDraw) {
      updates.winner = "draw"
      updates.status = "finished"
    }

    const { error: updateError } = await supabase
      .from("games")
      .update(updates)
      .eq("id", game.id)

    if (updateError) {
      setError("Failed to make move")
    }
  }

  const copyGameId = async () => {
    if (game?.id) {
      await navigator.clipboard.writeText(game.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const startNewRound = async () => {
    if (!game) return

    const emptyBoard = createEmptyBoard()

    // Alternate starting player based on who started the last round
    const nextStarter = game.round_starter === "X" ? "O" : "X"

    const { error: updateError } = await supabase
      .from("games")
      .update({
        board: emptyBoard,
        current_turn: nextStarter,
        round_starter: nextStarter,
        winner: null,
        status: "playing",
      })
      .eq("id", game.id)

    if (updateError) {
      setError("Failed to start new round")
    }
  }

  const leaveGame = () => {
    setGame(null)
    setGameIdInput("")
    setError("")
  }

  const getStatusMessage = () => {
    if (!game) return ""

    if (game.status === "waiting") {
      return "Waiting for opponent to join..."
    }

    if (game.status === "finished") {
      if (game.winner === "draw") {
        return "Unentschieden!"
      }
      const role = getPlayerRole()
      if (game.winner === role) {
        return "Du hast gewonnen!"
      }
      return "Du hast verloren!"
    }

    if (isMyTurn()) {
      return "Du bist dran"
    }
    return "Gegner ist dran"
  }

  if (!game) {
    return (
      <>
        <ThemeToggle />
        <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">Vier Gewinnt</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Button onClick={createGame} disabled={loading} className="w-full">
              <Users className="mr-2 h-4 w-4" />
              Neues Spiel erstellen
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Oder</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Input
              placeholder="Spiel-Code eingeben"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center font-mono text-lg tracking-widest uppercase"
            />
            <Button
              variant="secondary"
              onClick={joinGame}
              disabled={loading || !gameIdInput.trim()}
              className="w-full"
            >
              Spiel beitreten
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
      </>
    )
  }

  const role = getPlayerRole()

  return (
    <>
      <ThemeToggle />
      <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Vier Gewinnt</CardTitle>
          <Button variant="ghost" size="icon" onClick={leaveGame}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">Code:</span>
          <code className="text-sm font-mono bg-muted px-3 py-1 rounded tracking-widest">
            {game.id}
          </code>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyGameId}>
            <Copy className="h-3 w-3" />
          </Button>
          {copied && <span className="text-xs text-green-500">Kopiert!</span>}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-center gap-4">
          <Badge variant={role === "X" ? "default" : "outline"}>
            <span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-2" />
            {game.player_x_name || (role === "X" ? "Du" : "Gegner")}
          </Badge>
          <span className="text-muted-foreground">vs</span>
          <Badge variant={role === "O" ? "default" : "outline"}>
            <span className="inline-block w-3 h-3 rounded-full bg-rose-400 mr-2" />
            {game.player_o_name || (role === "O" ? "Du" : game.player_o ? "Gegner" : "Wartet...")}
          </Badge>
        </div>

        <p className="text-center font-medium">{getStatusMessage()}</p>

        <ConnectFourBoard
          board={game.board}
          onColumnClick={makeMove}
          disabled={!isMyTurn() || game.status !== "playing"}
          currentTurn={game.current_turn}
        />

        {game.status === "finished" && (
          <Button onClick={startNewRound} className="w-full">
            Neue Runde
          </Button>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
      </Card>
    </>
  )
}
