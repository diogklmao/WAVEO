/**
 * WAVEO — decomposição da pontuação.
 *
 * É o componente que torna o motor de pontuação verificável. Em vez de um
 * número que aparece do nada, mostra cada fator, o peso que teve, o valor que
 * lhe foi atribuído e a frase que explica porquê. Quando um fator não tem
 * dados, diz-se explicitamente que foi excluído e que o seu peso passou para os
 * outros — que é a diferença entre "não sabemos" e "está mau".
 */

import { IconArrowDown, IconArrowRight, IconArrowUp, IconInfo } from "@/components/icons";
import { cx } from "@/components/ui/Surface";
import { formatScore, scoreColor } from "@/lib/format";
import type { FactorImpact, ScoreFactor, SurfScore } from "@/lib/types";

const IMPACT_ICON: Record<FactorImpact, typeof IconArrowUp> = {
  positivo: IconArrowUp,
  neutro: IconArrowRight,
  negativo: IconArrowDown,
  indisponivel: IconInfo,
};

const IMPACT_LABEL: Record<FactorImpact, string> = {
  positivo: "a favor",
  neutro: "neutro",
  negativo: "contra",
  indisponivel: "sem dados",
};

const IMPACT_TONE: Record<FactorImpact, string> = {
  positivo: "text-signal-good",
  neutro: "text-mist-400",
  negativo: "text-signal-bad",
  indisponivel: "text-mist-500",
};

export function FactorBreakdown({
  score,
  className,
}: {
  score: SurfScore;
  className?: string;
}) {
  const maxEffective = Math.max(
    1,
    ...score.factors.map((factor) => factor.effectiveWeight),
  );
  const redistributed = score.factors.some(
    (factor) => Math.abs(factor.effectiveWeight - factor.weight) > 0.05,
  );

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <ul className="flex flex-col gap-3">
        {score.factors.map((factor) => (
          <FactorRow key={factor.key} factor={factor} maxEffective={maxEffective} />
        ))}
      </ul>

      <div className="border-t border-abyss-500/40 pt-3 text-[0.6875rem] leading-relaxed text-mist-500">
        {redistributed ? (
          <p>
            Os fatores sem dados foram <strong className="font-semibold text-mist-400">
              excluídos do cálculo
            </strong>{" "}
            e o peso respetivo foi redistribuído pelos restantes. Um fator em
            falta nunca é tratado como condição desfavorável.
          </p>
        ) : (
          <p>Todos os fatores tinham dados disponíveis para esta hora.</p>
        )}
        <p className="mt-1.5">
          Peso de cada fator no total disponível:{" "}
          {score.factors
            .map(
              (factor) =>
                `${factor.label} ${Math.round(factor.effectiveWeight)} %`,
            )
            .join(" · ")}
          .
        </p>
      </div>
    </div>
  );
}

function FactorRow({
  factor,
  maxEffective,
}: {
  factor: ScoreFactor;
  maxEffective: number;
}) {
  const unavailable = factor.impact === "indisponivel" || factor.score === null;
  const colour = unavailable ? "#64748b" : scoreColor(factor.score);
  const barWidth = Math.max(4, (factor.effectiveWeight / maxEffective) * 100);
  const Icon = IMPACT_ICON[factor.impact];
  const weightShifted =
    !unavailable && Math.abs(factor.effectiveWeight - factor.weight) > 0.05;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-mist-100">
            {factor.label}
          </span>
          <span className="shrink-0 font-mono text-xs text-mist-400 tabular-nums">
            {factor.reading}
          </span>
        </div>

        <div className="flex shrink-0 items-baseline gap-2">
          <span
            className={cx("inline-flex items-center gap-1 text-[0.625rem] font-semibold tracking-wide uppercase", IMPACT_TONE[factor.impact])}
          >
            <Icon size={12} />
            {IMPACT_LABEL[factor.impact]}
          </span>
          <span
            className="w-10 text-right font-mono text-sm font-bold tabular-nums"
            style={{ color: colour }}
          >
            {unavailable ? "—" : formatScore(factor.score)}
          </span>
        </div>
      </div>

      {/* Barra: largura = peso efetivo, cor = qualidade do fator */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-abyss-700/70">
        <div
          className={cx("h-full rounded-full", unavailable && "opacity-40")}
          style={{
            width: `${barWidth}%`,
            background: unavailable
              ? "repeating-linear-gradient(90deg, #64748b 0 4px, transparent 4px 8px)"
              : `linear-gradient(90deg, ${colour}66, ${colour})`,
          }}
        />
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-mist-400">{factor.detail}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-mist-500">
        <span>
          peso base {Math.round(factor.weight)} %
          {weightShifted
            ? ` → ${Math.round(factor.effectiveWeight)} % após redistribuição`
            : ""}
        </span>
      </div>

      {factor.breakdown && factor.breakdown.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {factor.breakdown.map((part) => (
            <li
              key={part.label}
              className="flex items-center gap-1.5 text-[0.6875rem] text-mist-400"
            >
              <span className="text-mist-500">{part.label}</span>
              <span className="font-mono tabular-nums">{part.reading}</span>
              <span
                className="font-mono font-semibold tabular-nums"
                style={{
                  color: part.score === null ? "#5b7793" : scoreColor(part.score),
                }}
              >
                {part.score === null ? "—" : formatScore(part.score)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Resumo em duas linhas: o que ajudou e o que atrapalhou. É a leitura que um
 * surfista faz antes de ler os números.
 */
export function ScoreHighlights({ score }: { score: SurfScore }) {
  if (score.band === "indisponivel") {
    return (
      <p className="text-sm leading-relaxed text-mist-400">
        Não há dados suficientes para identificar o que está a favor ou contra.
      </p>
    );
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-[var(--radius-tile)] border border-signal-good/30 bg-signal-good/8 p-3">
        <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-signal-good uppercase">
          <IconArrowUp size={12} />
          A favor
        </dt>
        <dd className="mt-1.5 text-sm leading-snug text-mist-100">
          {score.biggestStrength ?? "Nenhum fator se destaca positivamente."}
        </dd>
      </div>
      <div className="rounded-[var(--radius-tile)] border border-signal-bad/30 bg-signal-bad/8 p-3">
        <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-signal-bad uppercase">
          <IconArrowDown size={12} />
          Contra
        </dt>
        <dd className="mt-1.5 text-sm leading-snug text-mist-100">
          {score.biggestLimiter ?? "Nenhum fator limita as condições."}
        </dd>
      </div>
    </dl>
  );
}
