"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TicTacToeGame } from "@/components/tic-tac-toe-game"
import { ConnectFourGame } from "@/components/connect-four-game"
import { BattleshipGame } from "@/components/battleship-game"
import { RoomSelector } from "@/components/room-selector"
import { MatchmakingQueue } from "@/components/matchmaking-queue"
import { UsernameInput } from "@/components/username-input"
import { ThemeToggle } from "@/components/theme-toggle"
import { Grid3X3, Circle, Anchor, User, Pencil } from "lucide-react"

type GameType = "tictactoe" | "connectfour" | "battleship"
type Mode = "rooms" | "manual"
type Screen = "mode-select" | "room-select" | "matchmaking" | "manual-select" | "playing"

interface GameState {
  screen: Screen
  mode: Mode
  gameType: GameType | null
  gameId: string | null
  username: string | null
}

export function GameSelector() {
  const [state, setState] = useState<GameState>({
    screen: "mode-select",
    mode: "rooms",
    gameType: null,
    gameId: null,
    username: null,
  })
  const [isEditingUsername, setIsEditingUsername] = useState(false)

  const roomId = "DGB"

  // Playing a game (either from matchmaking or manual)
  if (state.screen === "playing" && state.gameType && state.gameId) {
    const handleBack = () => {
      setState({
        ...state,
        screen: "mode-select",
        gameType: null,
        gameId: null,
      })
    }

    if (state.gameType === "tictactoe") {
      return <TicTacToeGame onBack={handleBack} initialGameId={state.gameId} username={state.username} />
    }
    if (state.gameType === "connectfour") {
      return <ConnectFourGame onBack={handleBack} initialGameId={state.gameId} username={state.username} />
    }
    if (state.gameType === "battleship") {
      return <BattleshipGame onBack={handleBack} initialGameId={state.gameId} username={state.username} />
    }
  }

  // Manual mode - original game selection
  if (state.screen === "manual-select" || (state.screen === "playing" && state.mode === "manual" && !state.gameId)) {
    if (state.gameType === "tictactoe") {
      return <TicTacToeGame onBack={() => setState({ ...state, screen: "manual-select", gameType: null })} username={state.username} />
    }
    if (state.gameType === "connectfour") {
      return <ConnectFourGame onBack={() => setState({ ...state, screen: "manual-select", gameType: null })} username={state.username} />
    }
    if (state.gameType === "battleship") {
      return <BattleshipGame onBack={() => setState({ ...state, screen: "manual-select", gameType: null })} username={state.username} />
    }

    // Manual game selection menu
    return (
      <>
        <ThemeToggle />
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState({ ...state, screen: "mode-select" })}
              >
                Zurück
              </Button>
              <CardTitle className="text-xl">Manueller Modus</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => setState({ ...state, gameType: "tictactoe" })}
            >
              <Grid3X3 className="h-8 w-8" />
              <span className="text-lg font-medium">Tic Tac Toe</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => setState({ ...state, gameType: "connectfour" })}
            >
              <div className="flex gap-1">
                <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
                <Circle className="h-4 w-4 fill-rose-500 text-rose-500" />
                <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
                <Circle className="h-4 w-4 fill-rose-500 text-rose-500" />
              </div>
              <span className="text-lg font-medium">Vier Gewinnt</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => setState({ ...state, gameType: "battleship" })}
            >
              <Anchor className="h-8 w-8 text-sky-500" />
              <span className="text-lg font-medium">Schiffe Versenken</span>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  // Matchmaking queue
  if (state.screen === "matchmaking" && state.gameType) {
    return (
      <MatchmakingQueue
        roomId={roomId}
        gameType={state.gameType}
        username={state.username || "Anonym"}
        onBack={() => setState({ ...state, screen: "room-select", gameType: null })}
        onMatchFound={(gameId) => setState({ ...state, screen: "playing", gameId })}
      />
    )
  }

  // Room game selection
  if (state.screen === "room-select") {
    return (
      <RoomSelector
        roomId={roomId}
        onSelectGame={(gameType) => setState({ ...state, screen: "matchmaking", gameType })}
        onBack={() => setState({ ...state, screen: "mode-select" })}
      />
    )
  }

  // Mode selection (default screen)
  const showUsernameModal = !state.username || isEditingUsername

  return (
    <div className="w-full max-w-md mx-auto flex flex-col">
      <ThemeToggle />
      
      {/* Username display centered above the card */}
      {state.username && !isEditingUsername && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Spielst als</span>
          <span className="font-medium">{state.username}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={() => setIsEditingUsername(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Username input modal */}
      <UsernameInput 
        onUsernameSet={(username) => {
          setState({ ...state, username })
          setIsEditingUsername(false)
        }} 
        isOpen={showUsernameModal}
        onClose={() => setIsEditingUsername(false)}
        currentUsername={state.username}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">Spieleraum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant="default"
            className="h-20 flex flex-col gap-1"
            onClick={() => setState({ ...state, screen: "room-select", mode: "rooms" })}
            disabled={!state.username}
          >
            <span className="text-lg font-medium">Räume</span>
            <span className="text-sm opacity-80">Automatisches Matchmaking</span>
          </Button>

          <Button
            variant="outline"
            className="h-20 flex flex-col gap-1"
            onClick={() => setState({ ...state, screen: "manual-select", mode: "manual" })}
            disabled={!state.username}
          >
            <span className="text-lg font-medium">Manuell</span>
            <span className="text-sm opacity-80">Erstelle oder trete mit Code bei</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
