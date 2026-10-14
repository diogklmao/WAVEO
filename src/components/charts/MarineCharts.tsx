/**
 * WAVEO — gráficos marinhos.
 *
 * Cada gráfico acrescenta ao `AreaChart` genérico aquilo que só faz sentido
 * para a sua variável: a unidade, o fundo do eixo e — o mais importante — a
 * janela que aquele spot em particular prefere. Sem essa referência, um
 * gráfico de altura de onda é apenas um número maior ou menor; com ela, o
 * utilizador vê de imediato se o mar está dentro do que a praia pede.
 *
 * São Server Components. Constroem as séries a partir das horas completas e
 * entregam ao `AreaChart` apenas pares de números — a previsão inteira nunca
 * atravessa para o browser.
 */

import { AreaChart, type ChartAnnotation, type ValueBand } from "./AreaChart";
import type { ChartSeries } from "./chart-utils";
import { formatPortugalTime } from "@/lib/time";
import type { HourlyForecast, Range, SurfWindow, TideExtreme } from "@/lib/types";

/**
 * Paleta das séries. O ciano é a assinatura da aplicação; o âmbar é reservado
 * ao vento, que é o fator que mais rapidamente estraga um dia de surf e por
 * isso merece a única cor quente do sistema.
 */
export const CHART_COLORS = {
  wave: "#0b7b92",
  swell: "#0e7c63",
  windWave: "#63879a",
  period: "#6366f1",
  wind: "#b45309",
  gust: "#c2410c",
  tide: "#0e8fa8",
} as const;

function toPoints(
  hours: readonly HourlyForecast[],
  pick: (hour: HourlyForecast) => number | null,
) {
  return hours.map((hour) => ({ epochMs: hour.epochMs, value: pick(hour) }));
}

function highlightFrom(window: SurfWindow | null) {
  if (!window) return null;
  return {
    fromEpochMs: window.startEpochMs,
    toEpochMs: window.endEpochMs,
    label: "melhor janela",
  };
}

/* =============================================================================
   Altura de onda
   ============================================================================= */

export function WaveHeightChart({
  hours,
  nowEpochMs,
  bestWindow = null,
  idealRange,
}: {
  hours: readonly HourlyForecast[];
  nowEpochMs: number;
  bestWindow?: SurfWindow | null;
  idealRange?: Range;
}) {
  const series: ChartSeries[] = [
    {
      id: "waveHeight",
      label: "Altura total",
      color: CHART_COLORS.wave,
      kind: "area",
      points: toPoints(hours, (hour) => hour.waveHeight),
    },
    {
      id: "swellHeight",
      label: "Componente de swell",
      color: CHART_COLORS.swell,
      kind: "line",
      points: toPoints(hours, (hour) => hour.swellHeight),
    },
  ];

  const bands: ValueBand[] = idealRange
    ? [
        {
          from: idealRange.min,
          to: idealRange.max,
          label: "janela ideal do spot",
          color: "rgba(45, 212, 191, 0.12)",
        },
      ]
    : [];

  return (
    <AreaChart
      series={series}
      nowEpochMs={nowEpochMs}
      highlight={highlightFrom(bestWindow)}
      yBands={bands}
      yFloor={0}
      yUnit="m"
      yFormat="decimal"
      ariaLabel="Altura de onda significativa ao longo do tempo, com a componente de swell e a janela ideal do spot assinalada."
    />
  );
}

/* =============================================================================
   Período
   ============================================================================= */

export function PeriodChart({
  hours,
  nowEpochMs,
  idealRange,
}: {
  hours: readonly HourlyForecast[];
  nowEpochMs: number;
  idealRange?: Range;
}) {
  const series: ChartSeries[] = [
    {
      id: "wavePeriod",
      label: "Período de pico",
      color: CHART_COLORS.period,
      kind: "area",
      points: toPoints(hours, (hour) => hour.wavePeriod),
    },
    {
      id: "swellPeriod",
      label: "Período do swell",
      color: CHART_COLORS.wave,
      kind: "line",
      points: toPoints(hours, (hour) => hour.swellPeriod),
    },
  ];

  const bands: ValueBand[] = idealRange
    ? [
        {
          from: idealRange.min,
          to: idealRange.max,
          label: "período preferido",
          color: "rgba(165, 180, 252, 0.12)",
        },
      ]
    : [];

  return (
    <AreaChart
      series={series}
      nowEpochMs={nowEpochMs}
      yBands={bands}
      yFloor={0}
      yUnit="s"
      yFormat="integer"
      ariaLabel="Período de pico da ondulação ao longo do tempo, com o período preferido do spot assinalado."
    />
  );
}

/* =============================================================================
   Vento
   ============================================================================= */

export function WindChart({
  hours,
  nowEpochMs,
  windTolerance,
}: {
  hours: readonly HourlyForecast[];
  nowEpochMs: number;
  windTolerance?: number;
}) {
  const series: ChartSeries[] = [
    {
      id: "windSpeed",
      label: "Velocidade",
      color: CHART_COLORS.wind,
      kind: "area",
      points: toPoints(hours, (hour) => hour.windSpeed),
    },
    {
      id: "windGust",
      label: "Rajadas",
      color: CHART_COLORS.gust,
      kind: "line",
      dashed: true,
      subdued: true,
      points: toPoints(hours, (hour) => hour.windGust),
    },
  ];

  const bands: ValueBand[] =
    windTolerance === undefined
      ? []
      : [
          {
            from: 0,
            to: windTolerance,
            label: "abaixo do limite do spot",
            color: "rgba(250, 204, 21, 0.07)",
          },
        ];

  // Uma seta a cada três horas: com uma por hora, o eixo enche-se de ruído.
  const bearingMarkers = hours
    .filter((_, index) => index % 3 === 0)
    .flatMap((hour) =>
      hour.windDirection === null
        ? []
        : [
            {
              epochMs: hour.epochMs,
              bearing: hour.windDirection,
              color: CHART_COLORS.wind,
            },
          ],
    );

  return (
    <AreaChart
      series={series}
      nowEpochMs={nowEpochMs}
      yBands={bands}
      bearingMarkers={bearingMarkers}
      yFloor={0}
      yUnit="km/h"
      yFormat="integer"
      ariaLabel="Velocidade do vento e rajadas ao longo do tempo, com a direção de onde sopra e o limite de tolerância do spot."
    />
  );
}

/* =============================================================================
   Marés
   ============================================================================= */

export function TideChart({
  hours,
  nowEpochMs,
  extremes = [],
}: {
  hours: readonly HourlyForecast[];
  nowEpochMs: number;
  extremes?: TideExtreme[];
}) {
  const series: ChartSeries[] = [
    {
      id: "seaLevel",
      label: "Nível do mar",
      color: CHART_COLORS.tide,
      kind: "area",
      points: toPoints(hours, (hour) => hour.seaLevelHeight),
    },
  ];

  const annotations: ChartAnnotation[] = extremes.map((extreme) => ({
    epochMs: extreme.epochMs,
    label: `${extreme.type === "cheia" ? "MA" : "MB"} ${formatPortugalTime(extreme.epochMs)}`,
    tone: extreme.type === "cheia" ? "high" : "low",
  }));

  return (
    <AreaChart
      series={series}
      nowEpochMs={nowEpochMs}
      annotations={annotations}
      showLegend={false}
      yUnit="m"
      yFormat="decimal"
      emptyMessage="O fornecedor não devolveu dados de nível do mar para este ponto. A maré aparece como indisponível em vez de estimada."
      ariaLabel="Nível do mar ao longo do tempo, com maré alta (MA) e maré baixa (MB) assinaladas."
    />
  );
}
