"use client";

/**
 * WAVEO — painel do mapa.
 *
 * Envolve o mapa num componente carregado apenas no cliente e mantém a lista de
 * spots ao lado. A lista não é decorativa: é a alternativa acessível ao mapa e
 * o que garante que a aplicação continua a servir para alguma coisa se o WebGL
 * não estiver disponível ou se o utilizador navegar só com o teclado.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import { ScoreBadge, cx } from "@/components/ui/Surface";
import { sortByScore } from "@/components/spots/SpotList";
import { formatDirectionShort, formatKmh, formatMeters, formatSeconds, formatScore } from "@/lib/format";
import type { SpotSummary } from "@/lib/types";
import type { SpotMapPoint } from "./SpotMap";

const SpotMap = dynamic(() => import("./SpotMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-[var(--radius-card)] border border-abyss-500/50 bg-abyss-900">
      <div className="flex flex-col items-center gap-3">
        <span className="skeleton size-11 rounded-full" />
        <p className="text-xs tracking-wide text-mist-500 uppercase">A carregar o mapa…</p>
      </div>
    </div>
  ),
});

export function SpotMapPanel({ summaries }: { summaries: SpotSummary[] }) {
  const ordered = useMemo(() => sortByScore(summaries), [summaries]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const points = useMemo<SpotMapPoint[]>(
    () =>
      summaries.map(({ spot, score }) => ({
        slug: spot.slug,
        name: spot.name,
        lat: spot.lat,
        lon: spot.lon,
        score: score.value,
        band: score.band,
      })),
    [summaries],
  );

  const selected = summaries.find((summary) => summary.spot.slug === selectedSlug) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <SpotMap
        points={points}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
        className="h-[24rem] sm:h-[30rem] lg:h-[38rem]"
      />

      <div className="flex min-h-0 flex-col gap-4">
        <div className="surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-abyss-500/40 px-4 py-3">
            <h2 className="font-display text-sm font-semibold tracking-wide text-mist-100">
              Spots por pontuação
            </h2>
            <span className="text-[0.625rem] tracking-wide text-mist-500 uppercase">
              agora
            </span>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-abyss-500/30 overflow-y-auto">
            {ordered.map((summary) => {
              const active = summary.spot.slug === selectedSlug;
              const { spot, current, score } = summary;
              return (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(spot.slug)}
                    aria-pressed={active}
                    className={cx(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      active ? "bg-tide-600/12" : "hover:bg-abyss-700/40",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "mt-0.5 shrink-0 transition-colors",
                        active ? "text-tide-300" : "text-mist-500",
                      )}
                    >
                      <IconMapPin size={16} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-mist-50">
                        {spot.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mist-500">
                        {formatMeters(current?.waveHeight)} ·{" "}
                        {formatSeconds(current?.swellPeriod ?? current?.wavePeriod)} ·{" "}
                        {formatKmh(current?.windSpeed)}
                        {current?.windDirection !== null && current?.windDirection !== undefined
                          ? ` ${formatDirectionShort(current.windDirection)}`
                          : ""}
                      </span>
                    </span>

                    <ScoreBadge score={score.value} band={score.band} showValue={false} />
                    <span
                      className="w-9 shrink-0 text-right font-mono text-sm font-semibold tabular-nums"
                      style={{ color: score.band === "indisponivel" ? "#63879a" : undefined }}
                    >
                      {score.band === "indisponivel" ? "—" : formatScore(score.value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selected ? (
          <div className="surface surface-accent animate-rise p-4">
            <p className="label-eyebrow">Spot selecionado</p>
            <h3 className="font-display mt-1.5 text-base font-semibold text-mist-50">
              {selected.spot.name}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-mist-400">
              {selected.spot.characteristics.summary}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-mist-500">Ondulação</dt>
                <dd className="font-mono font-semibold text-mist-100">
                  {formatMeters(selected.current?.waveHeight)}
                </dd>
              </div>
              <div>
                <dt className="text-mist-500">Vento</dt>
                <dd className="font-mono font-semibold text-mist-100">
                  {formatKmh(selected.current?.windSpeed)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-mist-500">Melhor janela</dt>
                <dd className="font-semibold text-mist-100">
                  {selected.bestWindow ? selected.bestWindow.headline : "Sem janela recomendada"}
                </dd>
              </div>
            </dl>
            <Link
              href={`/spots/${selected.spot.slug}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-tide-400/50 bg-tide-600/15 px-4 py-2.5 text-sm font-semibold text-tide-100 transition-colors hover:bg-tide-600/25"
            >
              Abrir previsão completa
              <IconArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="surface p-4">
            <p className="text-sm leading-relaxed text-mist-400">
              Selecione um marcador no mapa ou um spot na lista para ver o
              resumo e abrir a previsão completa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
