/**
 * WAVEO — lista de spots.
 *
 * Grelha responsiva de cartões. A ordenação é responsabilidade de quem chama:
 * a lista não decide se faz mais sentido ordenar por pontuação ou por
 * proximidade.
 */

import { SpotCard } from "@/components/spots/SpotCard";
import { IconWave } from "@/components/icons";
import type { SpotSummary } from "@/lib/types";

export function SpotList({
  summaries,
  nowEpochMs,
  emptyTitle = "Ainda não há spots para mostrar",
  emptyMessage = "Não foi possível obter previsões para nenhum spot neste momento.",
}: {
  summaries: SpotSummary[];
  nowEpochMs: number;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (summaries.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="text-mist-500">
          <IconWave size={28} />
        </span>
        <h3 className="font-display text-base font-semibold text-mist-100">{emptyTitle}</h3>
        <p className="max-w-md text-sm leading-relaxed text-mist-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {summaries.map((summary) => (
        <li key={summary.spot.id} className="flex">
          <div className="flex w-full">
            <SpotCard summary={summary} nowEpochMs={nowEpochMs} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Estado de carregamento com a mesma geometria da lista final. */
export function SpotListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="surface flex flex-col gap-4 p-5">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
            <div className="flex items-center justify-between">
              <div className="skeleton h-7 w-24" />
              <div className="skeleton h-8 w-24" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-abyss-500/40 pt-4">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ordena resumos por pontuação, do melhor para o pior. Spots sem dados vão
 * para o fim — nunca para o princípio, e nunca tratados como "maus".
 */
export function sortByScore(summaries: SpotSummary[]): SpotSummary[] {
  return [...summaries].sort((a, b) => {
    const aUnavailable = a.score.band === "indisponivel";
    const bUnavailable = b.score.band === "indisponivel";
    if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
    if (aUnavailable && bUnavailable) return a.spot.name.localeCompare(b.spot.name, "pt");
    return b.score.value - a.score.value;
  });
}
