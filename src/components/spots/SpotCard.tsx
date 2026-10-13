/**
 * WAVEO — cartão de spot.
 *
 * A comparação entre praias é uma das três perguntas centrais do produto, por
 * isso o cartão foi desenhado para ser lido em conjunto com os vizinhos: mesma
 * grelha, mesma ordem de informação, mesma escala de cor. O que muda entre
 * cartões é só o que os distingue — a pontuação, o mar e a janela
 * recomendada.
 *
 * O cartão inteiro é clicável através da técnica do link esticado, mantendo o
 * botão de favorito fora da ligação para não aninhar elementos interativos.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { MiniSparkline } from "@/components/charts/MiniSparkline";
import { IconArrowRight, IconClock, IconDroplet, IconThermometer, IconWave, IconWind } from "@/components/icons";
import { FavouriteButton } from "@/components/spots/FavouriteButton";
import { ScoreBadge, cx } from "@/components/ui/Surface";
import {
  formatCelsius,
  formatDirectionShort,
  formatKmh,
  formatMeters,
  formatSeconds,
  formatScore,
  scoreBandLabel,
} from "@/lib/format";
import { formatPortugalTime } from "@/lib/time";
import type { SpotSummary } from "@/lib/types";

export function SpotCard({
  summary,
  nowEpochMs,
  showFavourite = true,
}: {
  summary: SpotSummary;
  nowEpochMs: number;
  showFavourite?: boolean;
}) {
  const { spot, current, score, bestWindow, daily, source } = summary;
  const unavailable = score.band === "indisponivel";
  const peakSeries = daily.map((day) => day.scorePeak);

  return (
    <article className="surface surface-interactive group relative flex flex-col gap-4 p-4 sm:p-5">
      {/* Link esticado: torna o cartão inteiro clicável sem aninhar controlos. */}
      <Link
        href={`/spots/${spot.slug}`}
        className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-tide-400"
        aria-label={`Ver a previsão de ${spot.name}`}
      />

      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-base font-semibold tracking-tight text-mist-50">
            {spot.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-mist-500">
            {spot.municipality} · {spot.region}
          </p>
        </div>
        {showFavourite ? (
          <div className="pointer-events-auto z-20 shrink-0">
            <FavouriteButton slug={spot.slug} spotName={spot.name} />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <ScoreBadge score={score.value} band={score.band} />
          <p className="mt-1.5 text-xs text-mist-400">
            {unavailable ? "Sem dados suficientes" : scoreBandLabel(score.band)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <MiniSparkline
            values={peakSeries}
            width={104}
            height={30}
            ariaLabel={`Pico diário da pontuação em ${spot.name} nos próximos dias`}
          />
          <p className="mt-1 text-[0.625rem] tracking-wide text-mist-500 uppercase">
            pico diário
          </p>
        </div>
      </div>

      <dl className="pointer-events-none relative z-10 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-abyss-500/40 pt-4 text-sm">
        <Reading
          icon={<IconWave size={15} />}
          label="Ondulação"
          value={formatMeters(current?.waveHeight)}
          sub={formatSeconds(current?.swellPeriod ?? current?.wavePeriod)}
        />
        <Reading
          icon={<IconWind size={15} />}
          label="Vento"
          value={formatKmh(current?.windSpeed)}
          sub={
            current?.windDirection === null || current?.windDirection === undefined
              ? "direção indisponível"
              : `de ${formatDirectionShort(current.windDirection)}`
          }
        />
        <Reading
          icon={<IconDroplet size={15} />}
          label="Água"
          value={formatCelsius(current?.seaSurfaceTemperature)}
          sub={
            current?.airTemperature === null || current?.airTemperature === undefined
              ? "ar indisponível"
              : `ar ${formatCelsius(current.airTemperature)}`
          }
        />
        <Reading
          icon={<IconClock size={15} />}
          label="Melhor janela"
          value={bestWindow ? `≈ ${formatScore(bestWindow.averageScore)}` : "—"}
          sub={bestWindow ? bestWindow.headline : "sem janela recomendada"}
        />
      </dl>

      <div className="pointer-events-none relative z-10 mt-auto flex items-center justify-between border-t border-abyss-500/40 pt-3">
        <span className="text-[0.625rem] tracking-wide text-mist-500 uppercase">
          {source.mode === "demo"
            ? "dados de demonstração"
            : source.stale
              ? "dados em cache"
              : `atualizado às ${formatPortugalTime(source.fetchedAtEpochMs)}`}
        </span>
        <span
          className={cx(
            "inline-flex items-center gap-1 text-xs font-medium text-tide-300 transition-transform",
            "group-hover:translate-x-0.5",
          )}
        >
          Ver previsão
          <IconArrowRight size={14} />
        </span>
      </div>
    </article>
  );
}

function Reading({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
        <span className="text-mist-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-sm font-semibold text-mist-100 tabular-nums">
        {value}
      </dd>
      <dd className="truncate text-[0.6875rem] text-mist-500">{sub}</dd>
    </div>
  );
}

/** Marca de temperatura mínima/máxima, usada nas vistas de detalhe. */
export function TemperatureRangeReading({
  min,
  max,
}: {
  min: number | null;
  max: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-mist-200">
      <IconThermometer size={15} className="text-mist-500" />
      <span className="font-mono tabular-nums">
        {formatCelsius(min)} / {formatCelsius(max)}
      </span>
    </span>
  );
}
