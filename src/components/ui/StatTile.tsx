/**
 * WAVEO — mosaico de estatística.
 *
 * Uma leitura, uma unidade, um contexto. Existe para que os números do painel
 * sejam todos apresentados da mesma maneira, incluindo a forma como se diz
 * "não há dados" — que nunca é um zero.
 */

import type { ReactNode } from "react";
import { cx } from "@/components/ui/Surface";

export function StatTile({
  icon,
  label,
  value,
  unit,
  sub,
  tone = "neutral",
  unavailable = false,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  /** Unidade apresentada em corpo menor, junto ao valor. */
  unit?: string;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "fair" | "warning" | "bad";
  unavailable?: boolean;
  className?: string;
}) {
  const toneClass = {
    neutral: "text-white",
    good: "text-emerald-300",
    fair: "text-lime-300",
    warning: "text-amber-300",
    bad: "text-rose-300",
  }[tone];

  return (
    <div
      className={cx(
        "rounded-[var(--radius-tile)] border border-white/18 p-3.5",
        "bg-[linear-gradient(160deg,rgba(20,32,60,0.62),rgba(12,22,44,0.68))] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-white/65 uppercase">
        {icon ? <span className="shrink-0 text-tide-600">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cx(
            "font-display text-xl leading-none font-semibold tabular-nums",
            unavailable ? "text-white/50" : toneClass,
          )}
        >
          {value}
        </span>
        {unit && !unavailable ? (
          <span className="text-xs font-medium text-white/65">{unit}</span>
        ) : null}
      </div>

      {sub ? (
        <div className="mt-1.5 text-[0.6875rem] leading-snug text-white/65">{sub}</div>
      ) : null}
    </div>
  );
}
