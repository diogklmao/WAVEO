/**
 * WAVEO — mostrador de pontuação.
 *
 * Anel SVG que comunica, num relance, a qualidade das condições. A cor vem da
 * mesma função que colore o mapa e as barras, pelo que a escala é consistente
 * em toda a aplicação.
 */

import { formatScore, scoreBandHint, scoreBandLabel, scoreColor } from "@/lib/format";
import type { ScoreBand } from "@/lib/types";

export function ScoreDial({
  score,
  band,
  size = 156,
  thickness = 11,
  confidence,
  showLabel = true,
}: {
  score: number;
  band: ScoreBand;
  size?: number;
  thickness?: number;
  /** Fração 0–1 do peso com dados disponíveis. */
  confidence?: number;
  showLabel?: boolean;
}) {
  const unavailable = band === "indisponivel";
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = unavailable ? 0 : Math.min(1, Math.max(0, score / 10));
  const dashOffset = circumference * (1 - fraction);
  const colour = scoreColor(unavailable ? null : score);
  const centre = size / 2;
  // Identificador determinístico: valores iguais partilham o mesmo gradiente,
  // o que permite manter este componente sem estado e utilizável no servidor.
  const gradientId = `waveo-score-${Math.round((unavailable ? 0 : score) * 10)}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={
            unavailable
              ? "Pontuação indisponível por falta de dados"
              : `Pontuação de surf ${formatScore(score)} em 10 — ${scoreBandLabel(band)}`
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity="0.65" />
              <stop offset="100%" stopColor={colour} />
            </linearGradient>
          </defs>

          {/* Pista de fundo */}
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke="rgba(23, 53, 83, 0.75)"
            strokeWidth={thickness}
          />

          {/* Arco da pontuação, começando no topo */}
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke={unavailable ? "rgba(100, 116, 139, 0.5)" : `url(#${gradientId})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={unavailable ? circumference : dashOffset}
            transform={`rotate(-90 ${centre} ${centre})`}
            style={
              unavailable
                ? { strokeDasharray: `${thickness * 1.6} ${thickness * 2.2}` }
                : undefined
            }
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums"
            style={{ color: unavailable ? "#64748b" : colour }}
          >
            {unavailable ? "—" : formatScore(score)}
          </span>
          <span className="mt-1 text-[0.6875rem] font-semibold tracking-[0.14em] text-mist-500 uppercase">
            {unavailable ? "sem dados" : "de 10"}
          </span>
        </div>
      </div>

      {showLabel ? (
        <div className="text-center">
          <p
            className="font-display text-base font-semibold tracking-tight"
            style={{ color: unavailable ? "#7d9cba" : colour }}
          >
            {scoreBandLabel(band)}
          </p>
          <p className="mt-1 max-w-[22rem] text-xs leading-relaxed text-mist-400">
            {scoreBandHint(band)}
          </p>
        </div>
      ) : null}

      {confidence !== undefined ? <ConfidenceMeter confidence={confidence} /> : null}
    </div>
  );
}

/**
 * Medidor de confiança. É deliberadamente distinto do mostrador de pontuação:
 * comunica quanto sabemos, não quão boas estão as condições.
 */
export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const tone =
    pct >= 80 ? "text-signal-good" : pct >= 55 ? "text-signal-fair" : "text-signal-marginal";

  return (
    <div className="w-full max-w-[13rem]">
      <div className="flex items-center justify-between text-[0.6875rem] font-semibold tracking-wide uppercase">
        <span className="text-mist-500">Confiança dos dados</span>
        <span className={`tabular-nums ${tone}`}>{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-abyss-700/80"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Proporção do peso da pontuação com dados disponíveis"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(34,211,238,0.55), rgba(45,212,191,0.95))",
          }}
        />
      </div>
      <p className="mt-1 text-[0.6875rem] leading-snug text-mist-500">
        Proporção dos fatores com dados. Não mede a qualidade das condições.
      </p>
    </div>
  );
}
