/**
 * WAVEO — bússola de swell e vento.
 *
 * Este é o elemento que distingue a WAVEO de um painel meteorológico genérico:
 * em vez de mostrar números de direção soltos, mostra-os *no lugar certo* em
 * relação à praia. O setor turquesa é a janela de swell ideal do spot — a
 * informação que explica porque é que a mesma ondulação funciona em Peniche e
 * não funciona em Espinho.
 *
 * Convenção: a direção indica sempre DE ONDE vem o swell ou o vento. A seta
 * aponta no sentido do movimento (para dentro), e a etiqueta junto ao rebordo
 * indica a origem. Norte em cima, como em qualquer carta náutica.
 */

import { angularDistance, compassAbbreviation, compassName } from "@/lib/geo";
import { formatDirection, formatKmh, formatMeters, formatSeconds } from "@/lib/format";

const CARDINALS = [
  { angle: 0, label: "N" },
  { angle: 90, label: "E" },
  { angle: 180, label: "S" },
  { angle: 270, label: "O" },
] as const;

function polar(cx: number, cy: number, r: number, bearingDeg: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  // Rumo 0 = norte = topo do SVG; sentido horário.
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function wedgePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const sweep = (((endDeg - startDeg) % 360) + 360) % 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

export interface CompassDialProps {
  /** Direção de onde vem o swell, em graus. */
  swellDirection: number | null;
  swellPeriod: number | null;
  waveHeight: number | null;
  /** Direção de onde vem o vento, em graus. */
  windDirection: number | null;
  windSpeed: number | null;
  windGusts?: number | null;
  /** Orientação da praia: rumo para o mar aberto. */
  beachOrientation: number;
  /** Janela de swell preferida do spot. */
  swellWindow: { center: number; halfWidth: number };
  size?: number;
}

export function CompassDial({
  swellDirection,
  swellPeriod,
  waveHeight,
  windDirection,
  windSpeed,
  windGusts,
  beachOrientation,
  swellWindow,
  size = 268,
}: CompassDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const wedgeRadius = outer - 16;
  const inner = outer - 42;

  const windowStart = swellWindow.center - swellWindow.halfWidth;
  const windowEnd = swellWindow.center + swellWindow.halfWidth;

  const swellOffset =
    swellDirection === null
      ? null
      : angularDistance(swellDirection, swellWindow.center);
  const inWindow =
    swellOffset !== null && swellOffset <= swellWindow.halfWidth;

  const seaward = polar(cx, cy, outer - 2, beachOrientation);
  const seawardInner = polar(cx, cy, outer - 10, beachOrientation);

  const swellTip = swellDirection === null ? null : polar(cx, cy, wedgeRadius - 4, swellDirection);
  const swellTail = swellDirection === null ? null : polar(cx, cy, inner, swellDirection);

  const windTip = windDirection === null ? null : polar(cx, cy, wedgeRadius - 10, windDirection);
  const windTail = windDirection === null ? null : polar(cx, cy, inner + 6, windDirection);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={describeCompass({
          swellDirection,
          swellPeriod,
          waveHeight,
          windDirection,
          windSpeed,
          swellWindow,
          inWindow,
        })}
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="waveo-compass-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(11, 30, 51, 0.95)" />
            <stop offset="100%" stopColor="rgba(3, 12, 24, 0.95)" />
          </radialGradient>
          <linearGradient id="waveo-compass-wedge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.30)" />
            <stop offset="100%" stopColor="rgba(20, 184, 166, 0.14)" />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r={outer} fill="url(#waveo-compass-bg)" />
        <circle
          cx={cx}
          cy={cy}
          r={outer}
          fill="none"
          stroke="rgba(56, 100, 138, 0.55)"
          strokeWidth={1.25}
        />

        {/* Janela de swell ideal do spot */}
        <path
          d={wedgePath(cx, cy, wedgeRadius, windowStart, windowEnd)}
          fill="url(#waveo-compass-wedge)"
          stroke="rgba(103, 232, 249, 0.45)"
          strokeWidth={1}
        />

        {/* Rumo para o mar aberto */}
        <line
          x1={seawardInner.x}
          y1={seawardInner.y}
          x2={seaward.x}
          y2={seaward.y}
          stroke="rgba(226, 240, 255, 0.75)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Marcas de 45 em 45 graus */}
        {Array.from({ length: 8 }, (_, i) => i * 45).map((angle) => {
          const outerTick = polar(cx, cy, outer, angle);
          const innerTick = polar(cx, cy, outer - (angle % 90 === 0 ? 11 : 6), angle);
          return (
            <line
              key={angle}
              x1={innerTick.x}
              y1={innerTick.y}
              x2={outerTick.x}
              y2={outerTick.y}
              stroke={angle % 90 === 0 ? "rgba(160, 196, 226, 0.7)" : "rgba(96, 140, 178, 0.45)"}
              strokeWidth={angle % 90 === 0 ? 1.6 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {CARDINALS.map(({ angle, label }) => {
          const pos = polar(cx, cy, wedgeRadius - 20, angle);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-mist-400 font-mono text-[0.6875rem] font-semibold"
            >
              {label}
            </text>
          );
        })}

        {/* Vento: traço fino, atrás do swell */}
        {windTip && windTail ? (
          <g>
            <line
              x1={windTail.x}
              y1={windTail.y}
              x2={windTip.x}
              y2={windTip.y}
              stroke="rgba(250, 204, 21, 0.85)"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
            <circle cx={windTip.x} cy={windTip.y} r={3} fill="rgba(250, 204, 21, 0.95)" />
          </g>
        ) : null}

        {/* Swell: traço principal */}
        {swellTail && swellTip ? (
          <g>
            <line
              x1={swellTail.x}
              y1={swellTail.y}
              x2={swellTip.x}
              y2={swellTip.y}
              stroke="#22d3ee"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <circle cx={swellTip.x} cy={swellTip.y} r={6} fill="#22d3ee" />
            <circle cx={swellTip.x} cy={swellTip.y} r={2.4} fill="#03121f" />
          </g>
        ) : null}

        <circle cx={cx} cy={cy} r={3.5} fill="rgba(160, 196, 226, 0.9)" />

        {/* Rótulo de origem junto ao rebordo, para desambiguar a seta */}
        {swellDirection !== null ? (
          <text
            x={polar(cx, cy, outer + 1, swellDirection).x}
            y={polar(cx, cy, outer + 1, swellDirection).y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-tide-200 font-mono text-[0.625rem] font-semibold"
          >
            {compassAbbreviation(swellDirection)}
          </text>
        ) : null}
      </svg>

      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <CompassReading
          label="Swell"
          value={
            swellDirection === null ? null : `${compassAbbreviation(swellDirection)} · ${compassName(swellDirection)}`
          }
          detail={
            swellOffset === null
              ? "Direção indisponível"
              : inWindow
                ? `Dentro da janela ideal (${compassAbbreviation(swellWindow.center)} ±${swellWindow.halfWidth}°)`
                : `A ${Math.round(swellOffset)}° do centro da janela (${compassAbbreviation(swellWindow.center)})`
          }
          tone={swellOffset === null ? "muted" : inWindow ? "good" : "fair"}
          accent="#22d3ee"
        />
        <CompassReading
          label="Altura · Período"
          value={describeSwellSize(waveHeight, swellPeriod)}
          detail="Altura significativa e período de pico"
          tone="neutral"
          accent="rgba(160, 196, 226, 0.85)"
        />
        <CompassReading
          label="Vento"
          value={
            windDirection === null
              ? null
              : `${compassAbbreviation(windDirection)} · ${formatKmh(windSpeed)}${
                  windGusts !== null && windGusts !== undefined ? ` (raj. ${formatKmh(windGusts)})` : ""
                }`
          }
          detail={
            windSpeed === null
              ? "Intensidade indisponível"
              : windDirection === null
                ? "Direção indisponível"
                : `Vento de ${compassName(windDirection)} · ${formatDirection(windDirection)}`
          }
          tone="neutral"
          accent="rgba(250, 204, 21, 0.85)"
        />
      </dl>
    </div>
  );
}

function describeSwellSize(
  waveHeight: number | null,
  swellPeriod: number | null,
): string | null {
  if (waveHeight === null && swellPeriod === null) return null;
  if (waveHeight === null) return formatSeconds(swellPeriod);
  if (swellPeriod === null) return formatMeters(waveHeight);
  return `${formatMeters(waveHeight)} · ${formatSeconds(swellPeriod)}`;
}

function CompassReading({
  label,
  value,
  detail,
  tone,
  accent,
}: {
  label: string;
  value: string | null;
  detail: string;
  tone: "good" | "fair" | "muted" | "neutral";
  accent: string;
}) {
  const valueTone =
    tone === "muted" || value === null
      ? "text-mist-500"
      : tone === "good"
        ? "text-signal-good"
        : tone === "fair"
          ? "text-signal-fair"
          : "text-mist-50";

  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        {label}
      </dt>
      <dd className={`mt-1 font-mono text-sm font-semibold tabular-nums ${valueTone}`}>
        {value ?? "—"}
      </dd>
      <dd className="mt-0.5 text-[0.6875rem] leading-snug text-mist-500">{detail}</dd>
    </div>
  );
}

function describeCompass({
  swellDirection,
  swellPeriod,
  waveHeight,
  windDirection,
  windSpeed,
  swellWindow,
  inWindow,
}: {
  swellDirection: number | null;
  swellPeriod: number | null;
  waveHeight: number | null;
  windDirection: number | null;
  windSpeed: number | null;
  swellWindow: { center: number; halfWidth: number };
  inWindow: boolean;
}): string {
  const parts: string[] = [];
  parts.push(
    `Bússola de condições. Janela de swell ideal do spot: ${compassName(swellWindow.center)}, mais ou menos ${swellWindow.halfWidth} graus.`,
  );
  parts.push(
    swellDirection === null
      ? "Direção do swell indisponível."
      : `Swell de ${compassName(swellDirection)} (${describeSwellSize(waveHeight, swellPeriod) ?? "altura indisponível"}), ${
          inWindow ? "dentro" : "fora"
        } da janela ideal.`,
  );
  parts.push(
    windDirection === null
      ? "Direção do vento indisponível."
      : `Vento de ${compassName(windDirection)} a ${formatKmh(windSpeed)}.`,
  );
  return parts.join(" ");
}

/**
 * Indicador de direção compacto, para usar em linhas de estatísticas onde a
 * bússola completa seria excessiva.
 */
export function DirectionArrow({
  direction,
  size = 18,
  className,
}: {
  direction: number | null;
  size?: number;
  className?: string;
}) {
  if (direction === null) {
    return <span className={className ?? "text-mist-500"}>—</span>;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{ transform: `rotate(${direction}deg)` }}
    >
      <path
        d="M12 20V5M6.5 10.5 12 5l5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
