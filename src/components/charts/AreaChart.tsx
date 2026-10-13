"use client";

/**
 * WAVEO — gráfico de séries temporais.
 *
 * Um único componente cobre ondas, período, vento e marés. As decisões que
 * importam:
 *
 *  - desenha em píxeis reais (largura medida) e não a partir de um `viewBox`
 *    esticado, para que as etiquetas dos eixos continuem legíveis no telemóvel;
 *  - quebra a linha nos valores em falta em vez de interpolar, porque uma linha
 *    contínua sobre um vazio afirmaria um valor que não conhecemos;
 *  - assinala a hora atual e a melhor janela, para ligar o gráfico à leitura
 *    que o utilizador faz do resto do painel.
 */

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  closeToBaseline,
  dayBoundaryIndices,
  indexNearestTo,
  labelIndices,
  linearScale,
  niceTicks,
  padDomain,
  segmentise,
  smoothPath,
  type ChartSeries,
} from "./chart-utils";
import { useElementWidth } from "./useElementWidth";
import { formatDecimal, formatInteger } from "@/lib/format";
import { formatPortugalTime, portugalDayKey, relativeDayLabel, weekdayAbbrev } from "@/lib/time";

export interface HighlightBand {
  fromEpochMs: number;
  toEpochMs: number;
  label?: string;
}

export interface BearingMarker {
  epochMs: number;
  bearing: number;
  color?: string;
  label?: string;
}

/** Marca pontual no topo do gráfico — usado para preia-mar e baixa-mar. */
export interface ChartAnnotation {
  epochMs: number;
  label: string;
  tone?: "high" | "low" | "neutral";
}

/**
 * Faixa horizontal de referência. É como o gráfico comunica o que o spot
 * *prefere* — a janela ideal de altura de onda ou de período — em vez de
 * mostrar apenas o que o mar está a fazer.
 */
export interface ValueBand {
  from: number;
  to: number;
  label?: string;
  color?: string;
}

export interface AreaChartProps {
  series: ChartSeries[];
  ariaLabel: string;
  nowEpochMs: number;
  height?: number;
  yTickCount?: number;
  /** Força o fundo do eixo a este valor (0 para alturas de onda). */
  yFloor?: number;
  /** Valor usado como base do preenchimento. Por omissão, o mínimo do eixo. */
  baselineValue?: number;
  highlight?: HighlightBand | null;
  bearingMarkers?: BearingMarker[];
  annotations?: ChartAnnotation[];
  /** Faixas horizontais de referência (janela ideal do spot). */
  yBands?: ValueBand[];
  /**
   * Como formatar as marcas do eixo vertical. É um descritor, e não uma função,
   * para que o gráfico possa ser alimentado por um Server Component — funções
   * não atravessam a fronteira servidor/cliente.
   */
  yFormat?: "decimal" | "integer";
  /**
   * Unidade das ordenadas. É apresentada uma vez, no canto do eixo, em vez de
   * repetida em cada marca — mantém as etiquetas estreitas e a unidade
   * explícita, como o resto da aplicação.
   */
  yUnit?: string;
  /** Mostra a legenda por cima do gráfico. */
  showLegend?: boolean;
  emptyMessage?: string;
}

const PADDING = { top: 22, right: 18, bottom: 30, left: 48 } as const;

/**
 * Identificador do gradiente de preenchimento. Inclui a cor para que duas
 * séries com o mesmo `id` mas cores diferentes — em gráficos distintos na
 * mesma página — não colidam no `<defs>` do SVG.
 */
function gradientIdFor(item: ChartSeries): string {
  return `waveo-fill-${item.id}-${item.color.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function AreaChart({
  series,
  ariaLabel,
  nowEpochMs,
  height = 240,
  yTickCount = 4,
  yFloor,
  baselineValue,
  highlight = null,
  bearingMarkers,
  annotations,
  yBands,
  yFormat = "decimal",
  yUnit,
  showLegend = true,
  emptyMessage = "Sem dados para apresentar neste período.",
}: AreaChartProps) {
  const { ref: containerRef, width } = useElementWidth<HTMLDivElement>(720);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const epochs = useMemo(() => {
    let longest: number[] = [];
    for (const item of series) {
      if (item.points.length > longest.length) {
        longest = item.points.map((point) => point.epochMs);
      }
    }
    return longest;
  }, [series]);

  const values = useMemo(() => {
    const collected: number[] = [];
    for (const item of series) {
      for (const point of item.points) {
        if (point.value !== null && Number.isFinite(point.value)) collected.push(point.value);
      }
    }
    return collected;
  }, [series]);

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(0, height - PADDING.top - PADDING.bottom);

  const domain = useMemo((): [number, number] => {
    if (values.length === 0) return [0, 1];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (yFloor !== undefined) min = Math.min(yFloor, min);
    [min, max] = padDomain(min, max, 0.12);
    if (yFloor !== undefined && min > yFloor) min = yFloor;
    return [min, max];
  }, [values, yFloor]);

  const yScale = useMemo(
    () => linearScale(domain[0], domain[1], PADDING.top + plotHeight, PADDING.top),
    [domain, plotHeight],
  );

  const formatY = yFormat === "integer" ? formatInteger : formatDecimal;

  const xForIndex = (index: number): number => {
    if (epochs.length <= 1) return PADDING.left + plotWidth / 2;
    return PADDING.left + (index / (epochs.length - 1)) * plotWidth;
  };

  const fractionForEpoch = (epochMs: number): number | null => {
    const first = epochs[0];
    const last = epochs[epochs.length - 1];
    if (first === undefined || last === undefined || last === first) return null;
    return (epochMs - first) / (last - first);
  };

  const xForFraction = (fraction: number): number => PADDING.left + fraction * plotWidth;

  const ticks = useMemo(() => niceTicks(domain[0], domain[1], yTickCount), [domain, yTickCount]);

  const dayBoundaries = useMemo(
    () => dayBoundaryIndices(epochs, portugalDayKey),
    [epochs],
  );

  const xLabels = useMemo(() => labelIndices(epochs.length, width < 520 ? 4 : 7), [epochs.length, width]);

  const baselineY = yScale(baselineValue ?? domain[0]);
  const nowIndex = indexNearestTo(epochs, nowEpochMs);
  const nowFraction = fractionForEpoch(nowEpochMs);

  const hasData = values.length > 0 && epochs.length > 0;

  const hoverEpoch = hoverIndex === null ? null : (epochs[hoverIndex] ?? null);

  const handlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || epochs.length === 0 || plotWidth <= 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (localX - PADDING.left) / plotWidth;
    const index = Math.round(ratio * (epochs.length - 1));
    setHoverIndex(Math.min(epochs.length - 1, Math.max(0, index)));
  };

  return (
    <div className="w-full">
      {/* Leitura do ponto sob o cursor. Fica acima do gráfico, e não numa
          bolha flutuante, para não tapar a série que está a descrever. */}
      <div className="mb-2 flex min-h-[1.5rem] flex-wrap items-baseline gap-x-4 gap-y-1">
        {hoverEpoch !== null ? (
          <>
            <span className="font-mono text-xs font-semibold text-mist-100 tabular-nums">
              {relativeDayLabel(hoverEpoch, nowEpochMs)} · {formatPortugalTime(hoverEpoch)}
            </span>
            {series.map((item) => {
              const point = item.points[hoverIndex ?? -1];
              const value = point?.value ?? null;
              return (
                <span key={item.id} className="flex items-center gap-1.5 text-xs text-mist-300">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-mist-500">{item.label}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {value === null || !Number.isFinite(value)
                      ? "—"
                      : yUnit
                        ? `${formatY(value)} ${yUnit}`
                        : formatY(value)}
                  </span>
                </span>
              );
            })}
          </>
        ) : (
          <span className="text-xs text-mist-500">
            Passe o cursor sobre o gráfico para ler valores hora a hora.
          </span>
        )}
      </div>

      <div ref={containerRef} className="w-full">
        {hasData ? (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={ariaLabel}
            className="touch-pan-y select-none"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.id}
                  id={gradientIdFor(item)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={item.subdued ? 0.12 : 0.32} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            {/* Período já passado: mais apagado, para deixar claro que a
                previsão começa agora. */}
            {nowFraction !== null && nowFraction > 0 ? (
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={Math.max(0, xForFraction(Math.min(1, nowFraction)) - PADDING.left)}
                height={plotHeight}
                fill="rgba(2, 8, 18, 0.45)"
              />
            ) : null}

            {/* Janela ideal do spot, como faixa de fundo */}
            {yBands && yBands.length > 0 ? (
              <g pointerEvents="none">
                {yBands.map((band) => {
                  const yTop = yScale(Math.max(band.from, band.to));
                  const yBottom = yScale(Math.min(band.from, band.to));
                  return (
                    <g key={`band-${band.from}-${band.to}`}>
                      <rect
                        x={PADDING.left}
                        y={yTop}
                        width={plotWidth}
                        height={Math.max(1, yBottom - yTop)}
                        fill={band.color ?? "rgba(45, 212, 191, 0.10)"}
                      />
                      {band.label ? (
                        <text
                          x={PADDING.left + plotWidth - 6}
                          y={yTop + 11}
                          textAnchor="end"
                          className="fill-foam-300/80 text-[0.625rem] font-semibold tracking-wide"
                        >
                          {band.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            ) : null}

            {/* Melhor janela para surfar */}
            {highlight
              ? (() => {
                  const fromF = fractionForEpoch(highlight.fromEpochMs);
                  const toF = fractionForEpoch(highlight.toEpochMs);
                  if (fromF === null || toF === null) return null;
                  const x1 = xForFraction(Math.max(0, Math.min(fromF, toF)));
                  const x2 = xForFraction(Math.min(1, Math.max(fromF, toF)));
                  return (
                    <g>
                      <rect
                        x={x1}
                        y={PADDING.top}
                        width={Math.max(2, x2 - x1)}
                        height={plotHeight}
                        fill="rgba(34, 211, 238, 0.13)"
                        stroke="rgba(34, 211, 238, 0.4)"
                        strokeWidth={1}
                        rx={4}
                      />
                      {highlight.label ? (
                        <text
                          x={(x1 + x2) / 2}
                          y={PADDING.top - 7}
                          textAnchor="middle"
                          className="fill-tide-200 text-[0.625rem] font-semibold tracking-wide"
                        >
                          {highlight.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })()
              : null}

            {/* Unidade do eixo vertical */}
            {yUnit ? (
              <text
                x={PADDING.left - 8}
                y={PADDING.top - 10}
                textAnchor="end"
                className="fill-mist-500 text-[0.625rem] font-semibold tracking-wide"
              >
                {yUnit}
              </text>
            ) : null}

            {/* Grelha horizontal */}
            {ticks.map((tick) => {
              const y = yScale(tick);
              if (y < PADDING.top - 1 || y > PADDING.top + plotHeight + 1) return null;
              return (
                <g key={tick}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={PADDING.left + plotWidth}
                    y2={y}
                    stroke="rgba(56, 100, 138, 0.28)"
                    strokeWidth={1}
                  />
                  <text
                    x={PADDING.left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-mist-500 font-mono text-[0.625rem] tabular-nums"
                  >
                    {formatY(tick)}
                  </text>
                </g>
              );
            })}

            {/* Fronteiras de dia */}
            {dayBoundaries.map((index) => {
              const x = xForIndex(index);
              const epoch = epochs[index];
              if (epoch === undefined) return null;
              return (
                <g key={`day-${index}`}>
                  <line
                    x1={x}
                    y1={PADDING.top}
                    x2={x}
                    y2={PADDING.top + plotHeight}
                    stroke="rgba(56, 100, 138, 0.4)"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={x + 5}
                    y={PADDING.top + 10}
                    className="fill-mist-500 text-[0.625rem] font-semibold tracking-wide"
                  >
                    {weekdayAbbrev(epoch)}
                  </text>
                </g>
              );
            })}

            {/* Séries. A posição horizontal é derivada do instante e não do
                índice, para que uma série mais curta do que o eixo continue
                alinhada com as restantes. */}
            {series.map((item) => {
              const segments = segmentise(
                item.points,
                (epochMs) => {
                  const fraction = fractionForEpoch(epochMs);
                  return fraction === null ? PADDING.left : xForFraction(fraction);
                },
                yScale,
              );
              return (
                <g key={item.id}>
                  {item.kind !== "line"
                    ? segments.map((segment, index) => (
                        <path
                          key={`fill-${index}`}
                          d={closeToBaseline(smoothPath(segment), segment, baselineY)}
                          fill={`url(#${gradientIdFor(item)})`}
                        />
                      ))
                    : null}
                  {segments.map((segment, index) => (
                    <path
                      key={`line-${index}`}
                      d={smoothPath(segment)}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={item.subdued ? 1.4 : 2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={item.dashed ? "5 4" : undefined}
                      opacity={item.subdued ? 0.85 : 1}
                    />
                  ))}
                </g>
              );
            })}

            {/* Preia-mar e baixa-mar. O marcador fica encostado ao topo ou ao
                fundo da área de desenho, porque é aí que a maré está. */}
            {annotations && annotations.length > 0 ? (
              <g pointerEvents="none">
                {annotations.map((annotation) => {
                  const fraction = fractionForEpoch(annotation.epochMs);
                  if (fraction === null || fraction < 0 || fraction > 1) return null;
                  const x = xForFraction(fraction);
                  const isHigh = annotation.tone !== "low";
                  const y = isHigh ? PADDING.top : PADDING.top + plotHeight;
                  const direction = isHigh ? 1 : -1;
                  return (
                    <g key={`annotation-${annotation.epochMs}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r={3}
                        fill={isHigh ? "#67e8f9" : "#7d9cba"}
                      />
                      <text
                        x={x}
                        y={y + direction * 11}
                        textAnchor="middle"
                        dominantBaseline={isHigh ? "hanging" : "auto"}
                        className={`text-[0.625rem] font-semibold tabular-nums ${
                          isHigh ? "fill-tide-200" : "fill-mist-400"
                        }`}
                      >
                        {annotation.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            ) : null}

            {/* Direções do vento ao longo do tempo */}
            {bearingMarkers && bearingMarkers.length > 0
              ? bearingMarkers.map((marker) => {
                  const index = indexNearestTo(epochs, marker.epochMs);
                  if (index === null) return null;
                  const x = xForIndex(index);
                  const y = PADDING.top + plotHeight + 11;
                  return (
                    <g
                      key={`bearing-${marker.epochMs}`}
                      transform={`translate(${x} ${y}) rotate(${marker.bearing})`}
                      opacity={0.85}
                    >
                      <path
                        d="M0 5 L0 -5 M-2.4 -2.2 L0 -5 L2.4 -2.2"
                        fill="none"
                        stroke={marker.color ?? "rgba(250, 204, 21, 0.9)"}
                        strokeWidth={1.3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })
              : null}

            {/* Hora atual */}
            {nowFraction !== null && nowFraction >= 0 && nowFraction <= 1 ? (
              <g>
                <line
                  x1={xForFraction(nowFraction)}
                  y1={PADDING.top - 4}
                  x2={xForFraction(nowFraction)}
                  y2={PADDING.top + plotHeight}
                  stroke="rgba(226, 240, 255, 0.75)"
                  strokeWidth={1.5}
                />
                <text
                  x={xForFraction(nowFraction)}
                  y={PADDING.top - 8}
                  textAnchor="middle"
                  className="fill-mist-100 text-[0.625rem] font-semibold tracking-wide"
                >
                  agora
                </text>
              </g>
            ) : null}

            {/* Etiquetas do eixo horizontal */}
            {xLabels.map((index) => {
              const epoch = epochs[index];
              if (epoch === undefined) return null;
              const x = xForIndex(index);
              const anchor = index === 0 ? "start" : index === epochs.length - 1 ? "end" : "middle";
              return (
                <text
                  key={`x-${index}`}
                  x={x}
                  y={PADDING.top + plotHeight + 22}
                  textAnchor={anchor}
                  className="fill-mist-500 font-mono text-[0.625rem] tabular-nums"
                >
                  {formatPortugalTime(epoch)}
                </text>
              );
            })}

            {/* Marcador do ponto sob o cursor */}
            {hoverIndex !== null && hoverEpoch !== null ? (
              <g pointerEvents="none">
                <line
                  x1={xForIndex(hoverIndex)}
                  y1={PADDING.top}
                  x2={xForIndex(hoverIndex)}
                  y2={PADDING.top + plotHeight}
                  stroke="rgba(226, 240, 255, 0.5)"
                  strokeWidth={1}
                />
                {series.map((item) => {
                  const value = item.points[hoverIndex]?.value ?? null;
                  if (value === null || !Number.isFinite(value)) return null;
                  return (
                    <circle
                      key={`dot-${item.id}`}
                      cx={xForIndex(hoverIndex)}
                      cy={yScale(value)}
                      r={3.5}
                      fill={item.color}
                      stroke="#03121f"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </g>
            ) : null}
          </svg>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-abyss-500/60 bg-abyss-800/40 px-4 text-center text-sm text-mist-400"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        )}
      </div>

      {showLegend && series.length > 0 ? (
        <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 text-xs text-mist-400">
              <span
                aria-hidden="true"
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundColor: item.color,
                  opacity: item.subdued ? 0.7 : 1,
                }}
              />
              {item.label}
            </li>
          ))}
          {bearingMarkers && bearingMarkers.length > 0 ? (
            <li className="flex items-center gap-1.5 text-xs text-mist-500">
              <span aria-hidden="true" className="text-signal-fair">
                ↑
              </span>
              Direção do vento (aponta de onde sopra)
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
