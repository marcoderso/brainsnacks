"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"
import { generatePlayerId, generateGameCode } from "@/lib/game-utils"
import { createEmptyBoard as createConnectFourBoard } from "@/lib/connect-four-utils"
import { createEmptyBoard as createBattleshipBoard } from "@/lib/battleship-utils"
import { createInitialState as createBilliardState } from "@/lib/billiard-rules"
import { ArrowLeft, Loader2 } from "lucide-react"

type GameType = "tictactoe" | "connectfour" | "battleship" | "billiard"

interface MatchmakingQueueProps {
  roomId: string
  gameType: GameType
  username: string
  onBack: () => void
  onMatchFound: (gameId: string) => void
}

const gameNames: Record<GameType, string> = {
  tictactoe: "Tic Tac Toe",
  connectfour: "Vier Gewinnt",
  battleship: "Schiffe Versenken",
  billiard: "Billiards",
}

export function MatchmakingQueue({ roomId, gameType, username, onBack, onMatchFound }: MatchmakingQueueProps) {
  const [status, setStatus] = useState<"joining" | "waiting" | "matched">("joining")
  const [playerId] = useState(() => generatePlayerId())
  const supabase = createClient()

  const createGameForMatch = useCallback(async (opponentId: string, opponentName: string): Promise<string | null> => {
    const gameCode = generateGameCode()
    
    let board: string[]
    let gameTypeField = gameType
    
    if (gameType === "tictactoe") {
      board = ["", "", "", "", "", "", "", "", ""]
    } else if (gameType === "connectfour") {
      board = createConnectFourBoard()
    } else if (gameType === "battleship") {
      board = createBattleshipBoard()
    } else {
      board = []
    }

    const { data, error } = await supabase
      .from("games")
      .insert({
        id: gameCode,
        board,
        player_x: playerId,
        player_x_name: username,
        player_o: opponentId,
        player_o_name: opponentName,
        status: "playing",
        game_type: gameTypeField,
        current_turn: "X",
        round_starter: "X",
        room_id: roomId,
        ...(gameType === "billiard" ? { billiard_state: createBilliardState(), last_shot: null } : {}),
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to create game:", error)
      return null
    }

    return data.id
  }, [gameType, playerId, supabase, roomId, username])

  const removeFromQueue = useCallback(async () => {
    await supabase
      .from("matchmaking_queue")
      .delete()
      .eq("room_id", roomId)
      .eq("game_type", gameType)
      .eq("player_id", playerId)
  }, [roomId, gameType, playerId, supabase])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const joinQueue = async () => {
      // First check if there's someone waiting
      const { data: waiting } = await supabase
        .from("matchmaking_queue")
        .select("*")
        .eq("room_id", roomId)
        .eq("game_type", gameType)
        .neq("player_id", playerId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (waiting && mounted) {
        // Found someone waiting - create game and remove them from queue
        const gameId = await createGameForMatch(waiting.player_id, waiting.player_name || "Anonym")
        
        if (gameId) {
          // Remove the matched player from queue
          await supabase
            .from("matchmaking_queue")
            .delete()
            .eq("id", waiting.id)

          setStatus("matched")
          onMatchFound(gameId)
          return
        }
      }

      // No one waiting - join the queue
      const { error } = await supabase
        .from("matchmaking_queue")
        .upsert({
          room_id: roomId,
          game_type: gameType,
          player_id: playerId,
          player_name: username,
        })

      if (error) {
        console.error("Failed to join queue:", error)
        return
      }

      if (mounted) {
        setStatus("waiting")
      }

      // Subscribe to new games where we are player_o (someone matched with us)
      channel = supabase
        .channel(`match-${playerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "games",
            filter: `player_o=eq.${playerId}`,
          },
          async (payload) => {
            if (mounted && payload.new) {
              // We got matched! Remove ourselves from queue
              await removeFromQueue()
              setStatus("matched")
              onMatchFound(payload.new.id as string)
            }
          }
        )
        .subscribe()
    }

    joinQueue()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
      // Clean up queue entry on unmount
      removeFromQueue()
    }
  }, [roomId, gameType, playerId, supabase, createGameForMatch, onMatchFound, removeFromQueue])

  const handleBack = async () => {
    await removeFromQueue()
    onBack()
  }

  return (
    <>
      <ThemeToggle />
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">{gameNames[gameType]}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-8">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">
              {status === "joining" && "Trete Warteschlange bei..."}
              {status === "waiting" && "Warte auf Gegner..."}
              {status === "matched" && "Gegner gefunden! Spiel startet..."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Raum: {roomId}
            </p>
          </div>
          <Button variant="outline" onClick={handleBack}>
            Abbrechen
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
