"use client"

import { useEffect, useRef } from "react"
import {
  Ball,
  BALL_R,
  HEAD_STRING_Y,
  FOOT_SPOT,
  POCKETS,
  RAIL,
  TABLE_H,
  TABLE_W,
  isFreeSpot,
  previewAim,
} from "@/lib/billiard-physics"
import type { BallInHand } from "@/lib/billiard-rules"

const TOTAL_W = TABLE_W + RAIL * 2
const TOTAL_H = TABLE_H + RAIL * 2

// Space the rest of the game UI needs vertically; the table takes what is left
// so it always fits on the screen together with the controls.
export const TABLE_MAX_WIDTH = `calc((100dvh - 200px) * ${TOTAL_W / TOTAL_H})`

export const BALL_COLORS: Record<number, string> = {
  0: "#f8f6f0",
  1: "#f5c400",
  2: "#1f4fbf",
  3: "#d42a2a",
  4: "#6b2fa0",
  5: "#f07a12",
  6: "#14864a",
  7: "#8b1e2d",
  8: "#18181b",
}

export function ballColor(n: number): string {
  return BALL_COLORS[n > 8 ? n - 8 : n]
}

interface BilliardTableProps {
  balls: Ball[]
  frames: Ball[][] | null
  onAnimationEnd: () => void
  interactive: boolean
  aim: { x: number; y: number }
  onAimChange: (dir: { x: number; y: number }) => void
  power: number
  ballInHand: BallInHand
  onCueMove: (pos: { x: number; y: number }) => void
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball) {
  const color = ballColor(b.n)
  ctx.save()
  ctx.beginPath()
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
  ctx.closePath()
  if (b.n > 8) {
    ctx.fillStyle = "#f8f6f0"
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = color
    ctx.fillRect(b.x - BALL_R, b.y - BALL_R * 0.55, BALL_R * 2, BALL_R * 1.1)
    ctx.restore()
  } else {
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.lineWidth = 1
  ctx.strokeStyle = "rgba(0,0,0,0.35)"
  ctx.stroke()
  // Small white dot with a soft highlight for a clean, flat look
  if (b.n !== 0) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_R * 0.42, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(b.x - BALL_R * 0.35, b.y - BALL_R * 0.4, BALL_R * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()
  ctx.restore()
}

function drawTable(ctx: CanvasRenderingContext2D, dark: boolean) {
  // Rail (lighter in dark mode so it stands out from the dark card)
  ctx.fillStyle = dark ? "#3f3f46" : "#27272a"
  ctx.beginPath()
  ctx.roundRect(-RAIL, -RAIL, TOTAL_W, TOTAL_H, 22)
  ctx.fill()

  // Felt
  ctx.fillStyle = "#2f7a57"
  ctx.fillRect(0, 0, TABLE_W, TABLE_H)

  // Head string and foot spot
  ctx.strokeStyle = "rgba(255,255,255,0.14)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, HEAD_STRING_Y)
  ctx.lineTo(TABLE_W, HEAD_STRING_Y)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,255,255,0.2)"
  ctx.beginPath()
  ctx.arc(FOOT_SPOT.x, FOOT_SPOT.y, 3, 0, Math.PI * 2)
  ctx.fill()

  // Diamonds
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  for (let i = 1; i < 4; i++) {
    const x = (TABLE_W / 4) * i
    for (const y of [-RAIL / 2, TABLE_H + RAIL / 2]) {
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue
    const y = (TABLE_H / 8) * i
    for (const x of [-RAIL / 2, TABLE_W + RAIL / 2]) {
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Pockets
  ctx.fillStyle = "#0a0a0a"
  for (const p of POCKETS) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r - 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function BilliardTable({
  balls,
  frames,
  onAnimationEnd,
  interactive,
  aim,
  onAimChange,
  power,
  ballInHand,
  onCueMove,
}: BilliardTableProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const animRef = useRef<{ frames: Ball[][]; start: number } | null>(null)
  const dragRef = useRef<"aim" | "cue" | null>(null)
  const lastDrawnRef = useRef<Ball[]>(balls)
  const propsRef = useRef({ balls, interactive, aim, power, ballInHand })
  propsRef.current = { balls, interactive, aim, power, ballInHand }
  const onAnimationEndRef = useRef(onAnimationEnd)
  onAnimationEndRef.current = onAnimationEnd

  const draw = (current: Ball[]) => {
    lastDrawnRef.current = current
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const scale = scaleRef.current
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, RAIL * scale * dpr, RAIL * scale * dpr)

    drawTable(ctx, document.documentElement.classList.contains("dark"))

    const { interactive: canAim, aim: dir, power: pow, ballInHand: bih } = propsRef.current
    const cue = current.find((b) => b.n === 0)
    const showAim = canAim && !animRef.current && cue

    if (showAim && bih === "kitchen") {
      ctx.fillStyle = "rgba(255,255,255,0.05)"
      ctx.fillRect(0, HEAD_STRING_Y, TABLE_W, TABLE_H - HEAD_STRING_Y)
    }

    if (showAim && cue) {
      const preview = previewAim(current, cue, dir)
      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.55)"
      ctx.lineWidth = 2
      ctx.setLineDash([8, 8])
      ctx.beginPath()
      ctx.moveTo(cue.x, cue.y)
      ctx.lineTo(preview.ghost.x, preview.ghost.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(preview.ghost.x, preview.ghost.y, BALL_R, 0, Math.PI * 2)
      ctx.stroke()
      if (preview.target && preview.targetDir) {
        ctx.strokeStyle = "rgba(255,255,255,0.4)"
        ctx.beginPath()
        ctx.moveTo(preview.target.x, preview.target.y)
        ctx.lineTo(preview.target.x + preview.targetDir.x * 70, preview.target.y + preview.targetDir.y * 70)
        ctx.stroke()
      }
      ctx.restore()
    }

    for (const b of current) drawBall(ctx, b)

    if (showAim && cue) {
      // Ball in hand marker
      if (bih) {
        ctx.save()
        ctx.strokeStyle = "rgba(255,255,255,0.8)"
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.arc(cue.x, cue.y, BALL_R * 2.2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      // Cue stick, pulled back according to the power
      const gap = BALL_R + 6 + pow * 60
      const length = 420
      const sx = cue.x - dir.x * gap
      const sy = cue.y - dir.y * gap
      const ex = cue.x - dir.x * (gap + length)
      const ey = cue.y - dir.y * (gap + length)
      ctx.save()
      ctx.lineCap = "round"
      ctx.strokeStyle = "#d8b48a"
      ctx.lineWidth = 7
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.strokeStyle = "#3f6fb5"
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx - dir.x * 6, sy - dir.y * 6)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Resize canvas to the wrapper width
  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return
    const resize = () => {
      const width = wrapper.clientWidth
      const height = (width * TOTAL_H) / TOTAL_W
      const dpr = window.devicePixelRatio || 1
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      scaleRef.current = width / TOTAL_W
      // Resizing clears the canvas, so redraw whatever was shown last
      draw(animRef.current ? lastDrawnRef.current : propsRef.current.balls)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrapper)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw when the theme is toggled
  useEffect(() => {
    const observer = new MutationObserver(() => draw(lastDrawnRef.current))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animation playback
  useEffect(() => {
    if (!frames || frames.length === 0) return
    animRef.current = { frames, start: performance.now() }
    let raf = 0
    const tick = (now: number) => {
      const anim = animRef.current
      if (!anim) return
      const idx = Math.max(0, Math.floor(((now - anim.start) / 1000) * 60))
      if (idx >= anim.frames.length - 1) {
        animRef.current = null
        draw(anim.frames[anim.frames.length - 1])
        onAnimationEndRef.current()
        return
      }
      draw(anim.frames[idx])
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      animRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames])

  // Static redraw
  useEffect(() => {
    if (!animRef.current) draw(balls)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balls, frames, interactive, aim, power, ballInHand])

  const toTable = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scale = scaleRef.current
    return {
      x: (e.clientX - rect.left) / scale - RAIL,
      y: (e.clientY - rect.top) / scale - RAIL,
    }
  }

  const updateAim = (p: { x: number; y: number }) => {
    const cue = propsRef.current.balls.find((b) => b.n === 0)
    if (!cue) return
    const dx = p.x - cue.x
    const dy = p.y - cue.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < BALL_R) return
    onAimChange({ x: dx / len, y: dy / len })
  }

  const moveCue = (p: { x: number; y: number }) => {
    const { balls: current, ballInHand: bih } = propsRef.current
    const x = Math.min(TABLE_W - BALL_R, Math.max(BALL_R, p.x))
    let y = Math.min(TABLE_H - BALL_R, Math.max(BALL_R, p.y))
    if (bih === "kitchen") y = Math.max(HEAD_STRING_Y, y)
    if (isFreeSpot(current, x, y, 0)) onCueMove({ x, y })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive || animRef.current) return
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    const p = toTable(e)
    const cue = balls.find((b) => b.n === 0)
    if (ballInHand && cue) {
      const dx = p.x - cue.x
      const dy = p.y - cue.y
      if (dx * dx + dy * dy < (BALL_R * 3) ** 2) {
        dragRef.current = "cue"
        return
      }
    }
    dragRef.current = "aim"
    updateAim(p)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const p = toTable(e)
    if (dragRef.current === "cue") moveCue(p)
    else updateAim(p)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={wrapperRef}
      className="mx-auto w-full"
      style={{ maxWidth: TABLE_MAX_WIDTH }}
    >
      <canvas
        ref={canvasRef}
        className="block rounded-[14px] touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  )
}
