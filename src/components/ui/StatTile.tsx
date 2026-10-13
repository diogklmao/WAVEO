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
    neutral: "text-mist-50",
    good: "text-signal-good",
    fair: "text-signal-fair",
    warning: "text-signal-marginal",
    bad: "text-signal-bad",
  }[tone];

  return (
    <div
      className={cx(
        "rounded-[var(--radius-tile)] border border-abyss-500/40 bg-abyss-800/40 p-3.5",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cx(
            "font-display text-xl leading-none font-semibold tabular-nums",
            unavailable ? "text-mist-500" : toneClass,
          )}
        >
          {value}
        </span>
        {unit && !unavailable ? (
          <span className="text-xs font-medium text-mist-500">{unit}</span>
        ) : null}
      </div>

      {sub ? (
        <div className="mt-1.5 text-[0.6875rem] leading-snug text-mist-500">{sub}</div>
      ) : null}
    </div>
  );
}
