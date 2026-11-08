import { cn } from "@/lib/utils"

export function EightBallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="15" className="fill-zinc-900 dark:fill-zinc-100" />
      <circle cx="16" cy="16" r="7" className="fill-white dark:fill-zinc-900" />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="700"
        className="fill-zinc-900 dark:fill-zinc-100"
      >
        8
      </text>
    </svg>
  )
}
