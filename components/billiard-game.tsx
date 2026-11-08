"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { BilliardTable, TABLE_MAX_WIDTH, ballColor } from "@/components/billiard-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { generatePlayerId, generateGameCode } from "@/lib/game-utils"
import { Ball, simulate } from "@/lib/billiard-physics"
import {
  BilliardShotRecord,
  BilliardState,
  GROUP_LABEL,
  Group,
  Role,
  applyShot,
  createInitialState,
  groupOf,
  remainingInGroup,
} from "@/lib/billiard-rules"
import { Copy, Users, RefreshCw, ArrowLeft, RotateCcw, RotateCw } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface Game {
  id: string
  current_turn: string
  player_x: string | null
  player_x_name: string | null
  player_o: string | null
  player_o_name: string | null
  winner: string | null
  status: string
  round_starter: string
  billiard_state: BilliardState
  last_shot: BilliardShotRecord | null
}

interface BilliardGameProps {
  onBack: () => void
  initialGameId?: string
  username?: string | null
}

const FINE_AIM_STEP = (0.4 * Math.PI) / 180

function MiniBall({ n }: { n: number }) {
  const color = ballColor(n)
  const background =
    n > 8 ? `linear-gradient(#f8f6f0 28%, ${color} 28% 72%, #f8f6f0 72%)` : color
  return (
    <span
      className="inline-block size-2.5 rounded-full border border-black/30"
      style={{ background }}
    />
  )
}

function PlayerBadge({
  name,
  symbol,
  active,
  group,
  balls,
}: {
  name: string
  symbol: Role
  active: boolean
  group: Group | null
  balls: Ball[]
}) {
  const remaining = group ? balls.filter((b) => groupOf(b.n) === group).map((b) => b.n).sort((a, b) => a - b) : []
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <Badge variant={active ? "default" : "outline"} className="max-w-full truncate">
        <span className={symbol === "X" ? "text-blue-500 mr-1" : "text-rose-500 mr-1"}>{symbol}</span>
        <span className="truncate">{name}</span>
      </Badge>
      <div className="flex h-3 items-center gap-0.5">
        {group ? (
          remaining.length > 0 ? (
            remaining.map((n) => <MiniBall key={n} n={n} />)
          ) : (
            <MiniBall n={8} />
          )
        ) : (
          <span className="text-[10px] text-muted-foreground">open</span>
        )}
        {group && <span className="ml-1 text-[10px] text-muted-foreground">{GROUP_LABEL[group]}</span>}
      </div>
    </div>
  )
}

export function BilliardGame({ onBack, initialGameId, username }: BilliardGameProps) {
  const [game, setGame] = useState<Game | null>(null)
  const [playerId, setPlayerId] = useState<string>("")
  const [gameIdInput, setGameIdInput] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [copied, setCopied] = useState(false)

  const [frames, setFrames] = useState<Ball[][] | null>(null)
  const [aim, setAim] = useState({ x: 0, y: -1 })
  const [power, setPower] = useState(55)
  const [cuePos, setCuePos] = useState<{ x: number; y: number } | null>(null)
  const lastSeqRef = useRef(0)
  const shootingRef = useRef(false)
  const fineAimTimer = useRef<{ timeout?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({})

  const supabase = createClient()

  useEffect(() => {
    setPlayerId(generatePlayerId())
  }, [])

  const enterGame = useCallback((data: Game) => {
    lastSeqRef.current = data.last_shot?.seq ?? 0
    setFrames(null)
    setCuePos(null)
    setGame(data)
  }, [])

  // Auto-join game if initialGameId is provided (from matchmaking)
  useEffect(() => {
    if (!initialGameId || !playerId || game) return

    const fetchGame = async () => {
      const { data } = await supabase.from("games").select().eq("id", initialGameId).single()
      if (data) enterGame(data as Game)
    }

    fetchGame()
  }, [initialGameId, playerId, game, supabase, enterGame])

  // Realtime updates: animate new shots, then show the stored result
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
          const next = payload.new as Game
          const shot = next.last_shot
          if (shot && shot.seq > lastSeqRef.current) {
            lastSeqRef.current = shot.seq
            const sim = simulate(shot.start, shot)
            setFrames(sim.frames)
          }
          setCuePos(null)
          setGame(next)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game?.id, supabase])

  const getPlayerRole = useCallback((): Role | null => {
    if (!game || !playerId) return null
    if (game.player_x === playerId) return "X"
    if (game.player_o === playerId) return "O"
    return null
  }, [game, playerId])

  const role = getPlayerRole()
  const state = game?.billiard_state
  const isAnimating = frames !== null
  const isMyTurn = !!game && !!role && game.current_turn === role && game.status === "playing"
  const canShoot = isMyTurn && !isAnimating

  const displayBalls: Ball[] =
    state && cuePos && canShoot && state.ballInHand
      ? state.balls.map((b) => (b.n === 0 ? { n: 0, x: cuePos.x, y: cuePos.y } : b))
      : state?.balls ?? []

  const createGame = async () => {
    setLoading(true)
    setError("")

    const { data, error: createError } = await supabase
      .from("games")
      .insert({
        id: generateGameCode(),
        board: [],
        player_x: playerId,
        player_x_name: username || null,
        status: "waiting",
        current_turn: "X",
        round_starter: "X",
        game_type: "billiard",
        billiard_state: createInitialState(),
        last_shot: null,
      })
      .select()
      .single()

    if (createError) {
      setError("Failed to create game")
      setLoading(false)
      return
    }

    enterGame(data as Game)
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
      .eq("game_type", "billiard")
      .single()

    if (fetchError || !existingGame) {
      setError("Game not found")
      setLoading(false)
      return
    }

    if (existingGame.player_x === playerId || existingGame.player_o === playerId) {
      enterGame(existingGame as Game)
      setLoading(false)
      return
    }

    if (existingGame.player_o) {
      setError("Game is full")
      setLoading(false)
      return
    }

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

    enterGame(data as Game)
    setLoading(false)
  }

  const shoot = async () => {
    if (!game || !state || !role || !canShoot || shootingRef.current) return
    shootingRef.current = true

    const start = displayBalls.map((b) => ({ ...b }))
    const shotPower = power / 100
    const sim = simulate(start, { dx: aim.x, dy: aim.y, power: shotPower })
    const outcome = applyShot({ ...state, balls: start }, role, sim)
    const seq = (game.last_shot?.seq ?? 0) + 1
    const shot: BilliardShotRecord = { seq, by: role, dx: aim.x, dy: aim.y, power: shotPower, start }

    const updates = {
      billiard_state: outcome.state,
      last_shot: shot,
      current_turn: outcome.nextTurn,
      winner: outcome.winner,
      status: outcome.winner ? "finished" : "playing",
    }

    lastSeqRef.current = seq
    setCuePos(null)
    setFrames(sim.frames)
    setGame({ ...game, ...updates })

    const { error: updateError } = await supabase
      .from("games")
      .update(updates)
      .eq("id", game.id)
      .eq("current_turn", role)

    shootingRef.current = false
    if (updateError) setError("Failed to save shot")
  }

  const startNewRound = async () => {
    if (!game) return
    const nextStarter = game.round_starter === "X" ? "O" : "X"

    const { error: updateError } = await supabase
      .from("games")
      .update({
        billiard_state: createInitialState(),
        current_turn: nextStarter,
        round_starter: nextStarter,
        winner: null,
        status: "playing",
      })
      .eq("id", game.id)

    if (updateError) setError("Failed to start new round")
  }

  const rotateAim = (direction: 1 | -1) => {
    const a = FINE_AIM_STEP * direction
    setAim((d) => ({
      x: d.x * Math.cos(a) - d.y * Math.sin(a),
      y: d.x * Math.sin(a) + d.y * Math.cos(a),
    }))
  }

  const startFineAim = (direction: 1 | -1) => {
    stopFineAim()
    rotateAim(direction)
    fineAimTimer.current.timeout = setTimeout(() => {
      fineAimTimer.current.interval = setInterval(() => rotateAim(direction), 40)
    }, 350)
  }

  const stopFineAim = () => {
    clearTimeout(fineAimTimer.current.timeout)
    clearInterval(fineAimTimer.current.interval)
  }

  useEffect(() => stopFineAim, [])

  const copyGameId = async () => {
    if (game?.id) {
      await navigator.clipboard.writeText(game.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const leaveGame = () => {
    setGame(null)
    setFrames(null)
    setGameIdInput("")
    setError("")
  }

  const getStatusMessage = () => {
    if (!game || !state) return ""
    if (game.status === "waiting") return "Waiting for opponent..."
    if (isAnimating) return "Balls rolling..."
    if (game.status === "finished") {
      return game.winner === role ? "You won!" : "You lost!"
    }
    if (isMyTurn) {
      if (state.isBreak) return "Your break!"
      const myGroup = role ? state.groups[role] : null
      if (myGroup && remainingInGroup(state.balls, myGroup) === 0) return "Your turn – now the 8!"
      return "Your turn"
    }
    return "Opponent's turn"
  }

  const getHint = () => {
    if (!game || !state || isAnimating) return null
    if (game.status === "playing" && canShoot && state.ballInHand) {
      return state.message ? `${state.message}. Drag the cue ball to place it.` : "Drag the cue ball to place it"
    }
    return state.message
  }

  // Lobby screen
  if (!game || !state) {
    return (
      <>
        <ThemeToggle />
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-2xl">Billiards</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Button onClick={createGame} disabled={loading || !playerId} className="w-full">
                <Users className="mr-2 h-4 w-4" />
                Create new game
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                placeholder="Enter game code"
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
                Join game
              </Button>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </CardContent>
        </Card>
      </>
    )
  }

  const hint = getHint()
  const nameX = game.player_x_name || (role === "X" ? "You" : "Opponent")
  const nameO = game.player_o_name || (role === "O" ? "You" : game.player_o ? "Opponent" : "Waiting...")

  return (
    <div className="w-full max-w-md mx-auto">
      {/* The theme toggle would overlap the header on small screens */}
      <div className="hidden sm:block">
        <ThemeToggle />
      </div>
      <Card className="gap-2 py-3">
        <CardHeader className="px-3 gap-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={leaveGame}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl">Billiards</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {copied && <span className="text-xs text-green-500">Copied!</span>}
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded tracking-widest">{game.id}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyGameId}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 flex flex-col gap-2">
          <div className="flex items-start justify-center gap-2">
            <PlayerBadge
              name={nameX}
              symbol="X"
              active={game.status === "playing" && game.current_turn === "X"}
              group={state.groups.X}
              balls={state.balls}
            />
            <span className="pt-0.5 text-sm text-muted-foreground">vs</span>
            <PlayerBadge
              name={nameO}
              symbol="O"
              active={game.status === "playing" && game.current_turn === "O"}
              group={state.groups.O}
              balls={state.balls}
            />
          </div>

          <div className="text-center leading-tight">
            <p className="font-medium">{getStatusMessage()}</p>
            <p className="min-h-4 text-xs text-muted-foreground">{hint}</p>
          </div>

          <div className="flex items-stretch justify-center gap-2">
            <div className="min-w-0 flex-1" style={{ maxWidth: TABLE_MAX_WIDTH }}>
              <BilliardTable
                balls={displayBalls}
                frames={frames}
                onAnimationEnd={() => setFrames(null)}
                interactive={canShoot}
                aim={aim}
                onAimChange={setAim}
                power={power / 100}
                ballInHand={state.ballInHand}
                onCueMove={setCuePos}
              />
            </div>

            {game.status !== "finished" && (
              <div className="flex w-16 shrink-0 flex-col items-center gap-2">
                <div className="text-center leading-tight">
                  <div className="text-[10px] text-muted-foreground">Power</div>
                  <div className="text-sm font-medium tabular-nums">{power}%</div>
                </div>
                <Slider
                  orientation="vertical"
                  value={[power]}
                  min={5}
                  max={100}
                  step={1}
                  onValueChange={(v) => setPower(v[0])}
                  disabled={!canShoot}
                  className="min-h-24 flex-1 px-2 data-[orientation=vertical]:min-h-24 [&_[data-slot=slider-thumb]]:size-7 [&_[data-slot=slider-track]]:w-2"
                  aria-label="Power"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 touch-none"
                  disabled={!canShoot}
                  onPointerDown={() => startFineAim(-1)}
                  onPointerUp={stopFineAim}
                  onPointerLeave={stopFineAim}
                  onPointerCancel={stopFineAim}
                  aria-label="Rotate aim left"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 touch-none"
                  disabled={!canShoot}
                  onPointerDown={() => startFineAim(1)}
                  onPointerUp={stopFineAim}
                  onPointerLeave={stopFineAim}
                  onPointerCancel={stopFineAim}
                  aria-label="Rotate aim right"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  className="h-16 w-16 shrink-0 rounded-full text-sm font-semibold"
                  disabled={!canShoot}
                  onClick={shoot}
                >
                  Shoot
                </Button>
              </div>
            )}
          </div>

          {game.status === "finished" && (
            <Button onClick={startNewRound} className="w-full h-11" disabled={isAnimating}>
              New round
            </Button>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
