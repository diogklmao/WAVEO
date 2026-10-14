/**
 * WAVEO — seletor de spots.
 *
 * Uma faixa horizontal de cartões, um por praia, com a miniatura, o nome, a
 * região e a pontuação atual — a comparação entre spots, uma das três perguntas
 * que a WAVEO responde, faz-se sem abrir cada um. São ligações a sério, e não
 * um componente com estado: funcionam sem JavaScript, são indexáveis, e cada
 * spot tem um URL próprio que pode ser partilhado.
 */

import Link from "next/link";
import { IconArrowRight, IconWave } from "@/components/icons";
import { cx } from "@/components/ui/Surface";
import { scoreColor, formatScore } from "@/lib/format";
import { spotThumb } from "@/lib/spot-media";
import type { ScoreBand, SurfSpot } from "@/lib/types";

export function SpotTabs({
  spots,
  activeSlug,
  linkMode = "path",
  scores,
  className,
}: {
  spots: readonly SurfSpot[];
  activeSlug: string;
  /** `query` gera `/?spot=slug`; `path` gera `/spots/slug`. */
  linkMode?: "query" | "path";
  scores?: Record<string, { value: number; band: ScoreBand }>;
  className?: string;
}) {
  const hrefFor = (slug: string) =>
    linkMode === "query" ? `/?spot=${encodeURIComponent(slug)}` : `/spots/${slug}`;

  return (
    <nav aria-label="Escolher spot" className={className}>
      <ul className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 py-1">
        {spots.map((spot) => {
          const active = spot.slug === activeSlug;
          const score = scores?.[spot.slug];
          const unavailable = !score || score.band === "indisponivel";
          const colour = unavailable ? "#64748b" : scoreColor(score.value);

          return (
            <li key={spot.id} className="shrink-0 snap-start">
              <Link
                href={hrefFor(spot.slug)}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex w-56 items-center gap-3 rounded-2xl border p-2.5 transition-colors backdrop-blur-md",
                  active
                    ? "border-white/60 bg-white/55 shadow-[0_6px_18px_rgba(10,20,40,0.35)]"
                    : "border-white/25 bg-white/22 hover:border-white/45 hover:bg-white/32",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-12 shrink-0 rounded-full border-2 border-white/70 bg-cover bg-center shadow-sm"
                  style={{ backgroundImage: `url(${spotThumb(spot.slug)})` }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      "block truncate text-sm font-semibold whitespace-nowrap",
                      active ? "text-mist-50" : "text-white",
                    )}
                  >
                    {spot.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.5625rem] tracking-[0.08em] text-white/70 uppercase">
                    {spot.region}
                  </span>
                  <span
                    className="mt-1 flex items-center gap-1 text-xs font-semibold tabular-nums"
                    style={{ color: active ? colour : "rgba(255,255,255,0.95)" }}
                  >
                    <IconWave size={12} />
                    {unavailable ? "—" : formatScore(score.value)}
                  </span>
                </span>
                <IconArrowRight size={14} className="shrink-0 text-white/70" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
