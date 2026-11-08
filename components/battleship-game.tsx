"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { BattleshipBoard } from "@/components/battleship-board"
import { ShipPlacement } from "@/components/ship-placement"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { generatePlayerId, generateGameCode } from "@/lib/game-utils"
import {
  Ship,
  createEmptyBoard,
  allShipsSunk,
} from "@/lib/battleship-utils"
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
  board_x: string[]
  board_o: string[]
  ships_x: Ship[]
  ships_o: Ship[]
  shots_x: string[]
  shots_o: string[]
  phase: string
}

interface BattleshipGameProps {
  onBack: () => void
  initialGameId?: string
  username?: string | null
}

export function BattleshipGame({ onBack, initialGameId, username }: BattleshipGameProps) {
  const [game, setGame] = useState<Game | null>(null)
  const [playerId, setPlayerId] = useState<string>("")
  const [gameIdInput, setGameIdInput] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [shipsPlaced, setShipsPlaced] = useState(false)

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
        setGame(data as Game)
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
    return game.current_turn === role && game.phase === "playing"
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

  // Check if both players have placed ships
  useEffect(() => {
    if (!game) return
    const role = getPlayerRole()
    if (!role) return

    const myShips = role === "X" ? game.ships_x : game.ships_o
    const opponentShips = role === "X" ? game.ships_o : game.ships_x

    if (
      game.phase === "placing" &&
      myShips?.length === 5 &&
      opponentShips?.length === 5
    ) {
      // Both players ready, start playing
      supabase
        .from("games")
        .update({ phase: "playing", status: "playing" })
        .eq("id", game.id)
        .then()
    }
  }, [game, getPlayerRole, supabase])

  const createGame = async () => {
    setLoading(true)
    setError("")

    const gameCode = generateGameCode()

    const { data, error: createError } = await supabase
      .from("games")
      .insert({
        id: gameCode,
        board: createEmptyBoard(),
        player_x: playerId,
        player_x_name: username || null,
        status: "waiting",
        game_type: "battleship",
        phase: "placing",
        board_x: createEmptyBoard(),
        board_o: createEmptyBoard(),
        ships_x: [],
        ships_o: [],
        shots_x: [],
        shots_o: [],
      })
      .select()
      .single()

    if (createError) {
      setError("Failed to create game")
      setLoading(false)
      return
    }

    setGame(data)
    setShipsPlaced(false)
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
      .eq("game_type", "battleship")
      .single()

    if (fetchError || !existingGame) {
      setError("Game not found")
      setLoading(false)
      return
    }

    if (existingGame.player_x === playerId) {
      setGame(existingGame)
      const myShips = existingGame.ships_x || []
      setShipsPlaced(myShips.length === 5)
      setLoading(false)
      return
    }

    if (existingGame.player_o && existingGame.player_o !== playerId) {
      setError("Game is full")
      setLoading(false)
      return
    }

    if (existingGame.player_o === playerId) {
      setGame(existingGame)
      const myShips = existingGame.ships_o || []
      setShipsPlaced(myShips.length === 5)
      setLoading(false)
      return
    }

    if (!existingGame.player_o) {
      const { data, error: updateError } = await supabase
        .from("games")
        .update({
          player_o: playerId,
          player_o_name: username || null,
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
      setShipsPlaced(false)
    }

    setLoading(false)
  }

  const confirmShipPlacement = async (board: string[], ships: Ship[]) => {
    if (!game || ships.length !== 5) return
    const role = getPlayerRole()
    if (!role) return

    const updates: Record<string, unknown> = {}
    if (role === "X") {
      updates.board_x = board
      updates.ships_x = ships
    } else {
      updates.board_o = board
      updates.ships_o = ships
    }

    const { error: updateError } = await supabase
      .from("games")
      .update(updates)
      .eq("id", game.id)

    if (updateError) {
      setError("Failed to place ships")
      return
    }

    setShipsPlaced(true)
  }

  const fireShot = async (index: number) => {
    if (!game || !isMyTurn()) return
    const role = getPlayerRole()
    if (!role) return

    // Get opponent's data
    const opponentBoard = role === "X" ? game.board_o : game.board_x
    const opponentShips: Ship[] = role === "X" ? game.ships_o : game.ships_x
    const myShots = role === "X" ? game.shots_x : game.shots_o

    // Check if already shot here
    if (myShots.includes(index.toString())) return

    const newShots = [...myShots, index.toString()]
    const cellValue = opponentBoard[index]
    const isHit = cellValue && cellValue !== "" && cellValue !== "miss"

    // Update opponent ships if hit
    let updatedOpponentShips = opponentShips
    if (isHit) {
      updatedOpponentShips = opponentShips.map((ship) => {
        if (ship.id === cellValue) {
          return { ...ship, hits: [...ship.hits, index] }
        }
        return ship
      })
    }

    const updates: Record<string, unknown> = {
      current_turn: role === "X" ? "O" : "X",
    }

    if (role === "X") {
      updates.shots_x = newShots
      updates.ships_o = updatedOpponentShips
    } else {
      updates.shots_o = newShots
      updates.ships_x = updatedOpponentShips
    }

    // Check for winner
    if (allShipsSunk(updatedOpponentShips)) {
      updates.winner = role
      updates.status = "finished"
      updates.phase = "finished"
    }

    const { error: updateError } = await supabase
      .from("games")
      .update(updates)
      .eq("id", game.id)

    if (updateError) {
      setError("Failed to fire shot")
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

    const nextStarter = game.round_starter === "X" ? "O" : "X"

    const { error: updateError } = await supabase
      .from("games")
      .update({
        board: createEmptyBoard(),
        board_x: createEmptyBoard(),
        board_o: createEmptyBoard(),
        ships_x: [],
        ships_o: [],
        shots_x: [],
        shots_o: [],
        current_turn: nextStarter,
        round_starter: nextStarter,
        winner: null,
        status: "waiting",
        phase: "placing",
      })
      .eq("id", game.id)

    if (updateError) {
      setError("Failed to start new round")
      return
    }

    setShipsPlaced(false)
  }

  const leaveGame = () => {
    setGame(null)
    setGameIdInput("")
    setError("")
    setShipsPlaced(false)
  }

  const getStatusMessage = () => {
    if (!game) return ""
    const role = getPlayerRole()

    if (game.phase === "placing") {
      const myShips = role === "X" ? game.ships_x : game.ships_o
      const opponentShips = role === "X" ? game.ships_o : game.ships_x

      if (!shipsPlaced && myShips?.length !== 5) {
        return "Place your ships"
      }
      if (myShips?.length === 5 && opponentShips?.length !== 5) {
        return "Waiting for opponent to place ships..."
      }
    }

    if (game.status === "waiting") {
      return "Waiting for opponent to join..."
    }

    if (game.status === "finished") {
      if (game.winner === role) {
        return "Sieg! Du hast alle feindlichen Schiffe versenkt!"
      }
      return "Niederlage! Deine Flotte wurde zerstört!"
    }

    if (isMyTurn()) {
      return "Du bist dran - Feuer frei!"
    }
    return "Gegner nimmt Ziel..."
  }

  // Lobby screen
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
              <CardTitle className="text-2xl">Schiffe Versenken</CardTitle>
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
  const myBoard = role === "X" ? game.board_x : game.board_o
  const myShips: Ship[] = role === "X" ? game.ships_x : game.ships_o
  const opponentBoard = role === "X" ? game.board_o : game.board_x
  const opponentShips: Ship[] = role === "X" ? game.ships_o : game.ships_x
  const myShots = role === "X" ? game.shots_x : game.shots_o
  const opponentShots = role === "X" ? game.shots_o : game.shots_x

  // Ship placement phase
  if (game.phase === "placing" && !shipsPlaced) {
    return (
      <>
        <ThemeToggle />
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Platziere deine Schiffe</CardTitle>
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
            </div>
          </CardHeader>

          <CardContent>
            <ShipPlacement onConfirm={confirmShipPlacement} />
          </CardContent>
        </Card>
      </>
    )
  }

  // Waiting for opponent ships
  if (game.phase === "placing" && shipsPlaced) {
    return (
      <>
        <ThemeToggle />
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Schiffe Versenken</CardTitle>
              <Button variant="ghost" size="icon" onClick={leaveGame}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="animate-pulse text-muted-foreground">
              Warte auf Gegner...
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  // Determine which board to show based on whose turn it is
  // The board shown is always the one being attacked (the defender's board)
  // If it's my turn: I see opponent's board (to attack) with only my shots visible
  // If it's opponent's turn: I see my board with my ships and opponent's shots
  const isDefending = !isMyTurn() && game.status !== "finished"
  const boardToShow = isDefending ? myBoard : opponentBoard
  const shipsToShow = isDefending ? myShips : opponentShips
  const shotsToShow = isDefending ? opponentShots : myShots
  const showShips = isDefending // Only show ships when viewing own board (being attacked)

  // Game in progress or finished
  return (
    <>
      <ThemeToggle />
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Schiffe Versenken</CardTitle>
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

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-4">
            <Badge variant={isMyTurn() ? "default" : "outline"}>
              {role === "X" ? (game.player_x_name || "Du") : (game.player_o_name || "Du")}
            </Badge>
            <span className="text-muted-foreground">vs</span>
            <Badge variant={!isMyTurn() && game.status !== "finished" ? "default" : "outline"}>
              {role === "X" ? (game.player_o_name || "Gegner") : (game.player_x_name || "Gegner")}
            </Badge>
          </div>

          <p className="text-center font-medium">{getStatusMessage()}</p>

          {/* Board label */}
          <div className="text-center text-sm text-muted-foreground">
            {isDefending ? (
              <span className="text-rose-500 font-medium">Deine Flotte - Unter Beschuss!</span>
            ) : (
              <span className="text-blue-500 font-medium">Feindliche Gewässer - Feuer!</span>
            )}
          </div>

          <BattleshipBoard
            board={boardToShow}
            ships={shipsToShow}
            shots={shotsToShow}
            onCellClick={isMyTurn() && game.status !== "finished" ? fireShot : undefined}
            disabled={!isMyTurn() || game.status === "finished"}
            isOpponentBoard={!isDefending}
            showShips={showShips}
          />

          {/* Ship status */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted-foreground">
              {isDefending ? "Deine Schiffe:" : "Feindliche Schiffe:"}
            </div>
            <div className="flex flex-wrap gap-1">
              {shipsToShow.map(ship => {
                const isSunk = ship.hits.length === ship.positions.length
                return (
                  <Badge 
                    key={ship.id} 
                    variant={isSunk ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {ship.name} {isSunk ? "(Versenkt)" : `(${ship.hits.length}/${ship.size})`}
                  </Badge>
                )
              })}
            </div>
          </div>

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
