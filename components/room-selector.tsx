"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/client"
import { Grid3X3, Circle, Anchor, Users, Gamepad2, ArrowLeft } from "lucide-react"

type GameType = "tictactoe" | "connectfour" | "battleship"

interface RoomSelectorProps {
  roomId: string
  onSelectGame: (gameType: GameType) => void
  onBack: () => void
}

interface GameCounts {
  waiting: number
  playing: number
}

interface AllCounts {
  tictactoe: GameCounts
  connectfour: GameCounts
  battleship: GameCounts
}

export function RoomSelector({ roomId, onSelectGame, onBack }: RoomSelectorProps) {
  const [counts, setCounts] = useState<AllCounts>({
    tictactoe: { waiting: 0, playing: 0 },
    connectfour: { waiting: 0, playing: 0 },
    battleship: { waiting: 0, playing: 0 },
  })
  const supabase = createClient()

  useEffect(() => {
    const fetchCounts = async () => {
      // Fetch queue counts (waiting)
      const { data: queueData } = await supabase
        .from("matchmaking_queue")
        .select("game_type")
        .eq("room_id", roomId)

      // Fetch active games counts (playing) - only games from this room
      const { data: gamesData } = await supabase
        .from("games")
        .select("game_type")
        .eq("room_id", roomId)
        .eq("status", "playing")

      const newCounts: AllCounts = {
        tictactoe: { waiting: 0, playing: 0 },
        connectfour: { waiting: 0, playing: 0 },
        battleship: { waiting: 0, playing: 0 },
      }

      if (queueData) {
        queueData.forEach((row) => {
          if (row.game_type in newCounts) {
            newCounts[row.game_type as GameType].waiting++
          }
        })
      }

      if (gamesData) {
        gamesData.forEach((row) => {
          const gameType = row.game_type as GameType
          if (gameType in newCounts) {
            newCounts[gameType].playing++
          }
        })
      }

      setCounts(newCounts)
    }

    fetchCounts()

    // Subscribe to realtime changes for queue
    const queueChannel = supabase
      .channel("queue-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matchmaking_queue",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchCounts()
        }
      )
      .subscribe()

    // Subscribe to realtime changes for games
    const gamesChannel = supabase
      .channel("games-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
        },
        () => {
          fetchCounts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(queueChannel)
      supabase.removeChannel(gamesChannel)
    }
  }, [roomId, supabase])

  const totalWaiting = counts.tictactoe.waiting + counts.connectfour.waiting + counts.battleship.waiting
  const totalPlaying = (counts.tictactoe.playing + counts.connectfour.playing + counts.battleship.playing) * 2

  const games = [
    {
      type: "tictactoe" as GameType,
      name: "Tic Tac Toe",
      icon: <Grid3X3 className="h-8 w-8" />,
    },
    {
      type: "connectfour" as GameType,
      name: "Vier Gewinnt",
      icon: (
        <div className="flex gap-1">
          <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
          <Circle className="h-4 w-4 fill-rose-500 text-rose-500" />
          <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
          <Circle className="h-4 w-4 fill-rose-500 text-rose-500" />
        </div>
      ),
    },
    {
      type: "battleship" as GameType,
      name: "Schiffe Versenken",
      icon: <Anchor className="h-8 w-8 text-sky-500" />,
    },
  ]

  return (
    <>
      <ThemeToggle />
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-2xl">Raum: {roomId}</CardTitle>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {totalWaiting} wartend
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Gamepad2 className="h-3 w-3 mr-1" />
              {totalPlaying} spielend
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {games.map((game) => (
            <Button
              key={game.type}
              variant="outline"
              className="h-24 flex items-center justify-between px-4"
              onClick={() => onSelectGame(game.type)}
            >
              <div className="flex items-center gap-3">
                {game.icon}
                <span className="text-lg font-medium">{game.name}</span>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge variant={counts[game.type].waiting > 0 ? "default" : "secondary"} className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {counts[game.type].waiting} wartend
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Gamepad2 className="h-3 w-3 mr-1" />
                  {counts[game.type].playing * 2} spielend
                </Badge>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
