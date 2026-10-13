/**
 * WAVEO — seletor de spots.
 *
 * São ligações a sério, e não um componente com estado: funciona sem
 * JavaScript, é indexável, e cada spot tem um URL próprio que pode ser
 * partilhado. O ponto colorido dá a pontuação atual de cada praia, para que a
 * comparação entre spots — uma das três perguntas que a WAVEO responde — se
 * faça sem abrir cada um.
 */

import Link from "next/link";
import { cx } from "@/components/ui/Surface";
import { scoreColor, formatScore } from "@/lib/format";
import type { ScoreBand, SurfSpot } from "@/lib/types";

export function SpotTabs({
  spots,
  activeSlug,
  linkMode = "path",
  scores,
  className,
}: {
  spots: SurfSpot[];
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
      <ul className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1">
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
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                  active
                    ? "border-tide-400/60 bg-tide-600/15"
                    : "border-abyss-500/50 bg-abyss-800/40 hover:border-abyss-400/70 hover:bg-abyss-700/50",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colour }}
                />
                <span className="flex flex-col leading-tight">
                  <span
                    className={cx(
                      "text-sm font-semibold whitespace-nowrap",
                      active ? "text-tide-100" : "text-mist-100",
                    )}
                  >
                    {spot.name}
                  </span>
                  <span className="text-[0.625rem] tracking-wide text-mist-500 uppercase">
                    {spot.region}
                  </span>
                </span>
                <span
                  className="ml-1 font-mono text-xs font-semibold tabular-nums"
                  style={{ color: colour }}
                >
                  {unavailable ? "—" : formatScore(score.value)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
