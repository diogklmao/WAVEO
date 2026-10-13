"use client";

/**
 * WAVEO — painel de favoritos.
 *
 * Os favoritos estão no `localStorage`, logo a filtragem tem de acontecer no
 * cliente. O servidor entrega todas as previsões já calculadas e este
 * componente limita-se a escolher quais mostrar — não faz pedidos próprios,
 * pelo que mudar de separador ou marcar um favorito é instantâneo.
 */

import Link from "next/link";
import { useMemo } from "react";
import { IconHeart, IconWave } from "@/components/icons";
import { sortByScore } from "@/components/spots/SpotList";
import { SpotCard } from "@/components/spots/SpotCard";
import { useFavourites } from "@/hooks/useFavourites";
import type { SpotSummary } from "@/lib/types";

export function FavouritesBoard({
  summaries,
  nowEpochMs,
}: {
  summaries: SpotSummary[];
  nowEpochMs: number;
}) {
  const { favourites, ready } = useFavourites();

  const ordered = useMemo(() => {
    const bySlug = new Map(summaries.map((summary) => [summary.spot.slug, summary]));
    const selected = favourites
      .map((slug) => bySlug.get(slug))
      .filter((summary): summary is SpotSummary => summary !== undefined);
    return sortByScore(selected);
  }, [favourites, summaries]);

  // Antes de o `localStorage` ser lido não sabemos se há favoritos. Mostrar um
  // estado vazio aqui seria mentir; mostramos um esqueleto.
  if (!ready) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index}>
            <div className="surface flex flex-col gap-4 p-5">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-7 w-24" />
              <div className="skeleton h-24" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (ordered.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-abyss-500/50 bg-abyss-800/60 text-mist-500">
          <IconHeart size={24} />
        </span>
        <h2 className="font-display text-lg font-semibold text-mist-100">
          Ainda não guardou nenhum spot
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-mist-400">
          Toque no coração de qualquer praia para a guardar aqui. Os favoritos
          ficam guardados neste dispositivo e neste browser — não são
          sincronizados entre dispositivos nem recuperáveis se apagar os dados
          do site.
        </p>
        <Link
          href="/spots"
          className="inline-flex items-center gap-2 rounded-xl border border-tide-400/50 bg-tide-600/15 px-4 py-2.5 text-sm font-semibold text-tide-100 transition-colors hover:bg-tide-600/25"
        >
          <IconWave size={16} />
          Explorar spots
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs leading-relaxed text-mist-500">
        {ordered.length === 1
          ? "1 spot guardado neste dispositivo."
          : `${ordered.length} spots guardados neste dispositivo.`}{" "}
        Os favoritos são locais a este browser e não são sincronizados.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((summary) => (
          <li key={summary.spot.id} className="flex">
            <SpotCard summary={summary} nowEpochMs={nowEpochMs} />
          </li>
        ))}
      </ul>
    </>
  );
}
