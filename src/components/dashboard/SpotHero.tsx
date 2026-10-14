/**
 * WAVEO — hero do spot.
 *
 * Sem moldura: o título e a descrição assentam diretamente sobre a fotografia
 * de pôr do sol da página. O nome do spot vem em letra manuscrita com um traço
 * de onda por baixo, e à direita a frase "Same ocean, new stories" dá o tom de
 * praia. As características ficam em pílulas de vidro escuro.
 */

import type { ReactNode } from "react";

function Flourish({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 14"
      className={`flourish ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M3 9 Q 15 2 27 9 T 51 9 T 75 9 T 93 7" />
    </svg>
  );
}

export function SpotHero({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] px-1 py-2">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-white/85 uppercase">
              {eyebrow}
            </p>
            <h1 className="font-script mt-2 text-5xl leading-tight font-bold text-white sm:text-6xl">
              {title}
            </h1>
            <Flourish className="mt-1 h-3.5 w-28 text-white/85" />
            {description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          <p className="font-script hidden shrink-0 pt-2 pr-2 text-right text-xl leading-snug text-white/90 lg:block">
            Same ocean,
            <br />
            new stories
            <Flourish className="mt-1 ml-auto h-3 w-20 text-white/80" />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {children}
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
