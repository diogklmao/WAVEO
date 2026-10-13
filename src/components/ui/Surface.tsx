/**
 * WAVEO — superfícies e elementos de estrutura.
 *
 * Componentes apresentacionais, sem estado: funcionam tanto em Server como em
 * Client Components.
 */

import type { ReactNode } from "react";
import { scoreBadgeClasses, scoreColor, formatScore } from "@/lib/format";
import type { ScoreBand } from "@/lib/types";

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/* =============================================================================
   Superfícies
   ============================================================================= */

export function Surface({
  children,
  className,
  accent = false,
  interactive = false,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  /** Adiciona um filete turquesa no topo, para cartões em destaque. */
  accent?: boolean;
  interactive?: boolean;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag
      className={cx(
        "surface relative",
        accent && "surface-accent overflow-hidden",
        interactive && "surface-interactive",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="font-display text-lg font-semibold tracking-tight text-mist-50 sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* =============================================================================
   Etiquetas
   ============================================================================= */

export function Chip({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "tide";
  className?: string;
}) {
  return (
    <span className={cx("chip", variant === "tide" && "chip-tide", className)}>
      {children}
    </span>
  );
}

export function ScoreBadge({
  score,
  band,
  showValue = true,
  className,
}: {
  score: number;
  band: ScoreBand;
  showValue?: boolean;
  className?: string;
}) {
  const unavailable = band === "indisponivel";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        scoreBadgeClasses(band),
        className,
      )}
    >
      {!unavailable ? (
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ backgroundColor: scoreColor(score) }}
        />
      ) : null}
      {showValue ? (
        <span className="font-mono tabular-nums">
          {unavailable ? "—" : `${formatScore(score)}/10`}
        </span>
      ) : null}
    </span>
  );
}

/* =============================================================================
   Avisos de dados
   ============================================================================= */

export function AvailabilityNote({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "positive";
  className?: string;
}) {
  const tones = {
    neutral: "border-abyss-500/50 bg-abyss-800/50 text-mist-400",
    warning: "border-signal-marginal/40 bg-signal-marginal/10 text-signal-marginal",
    positive: "border-tide-500/40 bg-tide-600/10 text-tide-200",
  } as const;

  return (
    <p
      className={cx(
        "rounded-xl border px-3 py-2 text-xs leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Marca visual para valores que não existem. Existe como componente para que
 * "sem dados" seja sempre apresentado da mesma forma — e nunca confundido com
 * um valor de zero.
 */
export function UnavailableValue({
  label = "Sem dados",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx("text-mist-500", className)}
      title={label}
      aria-label={label}
    >
      —
    </span>
  );
}
