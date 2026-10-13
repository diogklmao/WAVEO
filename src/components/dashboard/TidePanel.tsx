/**
 * WAVEO — painel de maré.
 *
 * A maré é o dado que os fornecedores de ondas não dão de forma fiável, por
 * isso este painel foi escrito para o caso de falha: quando não há dados,
 * di-lo com todas as letras e explica porquê, em vez de mostrar uma curva
 * estimada que pareceria tão credível como as verdadeiras.
 */

import { IconArrowDown, IconArrowUp, IconTide } from "@/components/icons";
import { Chip, cx } from "@/components/ui/Surface";
import { tideStageLabel, formatDecimal } from "@/lib/format";
import { formatPortugalTime } from "@/lib/time";
import type { TideExtreme, TideState } from "@/lib/types";

export function TidePanel({
  tide,
  extremes,
  className,
}: {
  tide: TideState;
  extremes: TideExtreme[];
  className?: string;
}) {
  if (!tide.available) {
    return (
      <div className={cx("flex flex-col gap-3", className)}>
        <div className="flex items-center gap-2">
          <span className="text-mist-500">
            <IconTide size={17} />
          </span>
          <h3 className="font-display text-sm font-semibold text-mist-100">
            Maré indisponível
          </h3>
        </div>
        <p className="rounded-xl border border-abyss-500/50 bg-abyss-800/50 px-3 py-2.5 text-xs leading-relaxed text-mist-400">
          {tide.reason ??
            "O fornecedor de dados não devolveu informação de nível do mar para este ponto."}{" "}
          O fator maré é excluído da pontuação e o seu peso é redistribuído pelos
          restantes fatores. Não é interpretado como maré desfavorável.
        </p>
      </div>
    );
  }

  const level = tide.normalizedLevel;
  const stage = tide.stage;

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">Maré agora</p>
          <p className="font-display mt-1 text-2xl font-semibold text-mist-50 tabular-nums">
            {tide.height === null ? "—" : `${formatDecimal(tide.height)} m`}
          </p>
          <p className="mt-0.5 text-xs text-mist-400">
            {stage === null ? "Estágio indeterminado" : `Maré ${tideStageLabel(stage)}`}
          </p>
        </div>

        {/* Escala vertical: baixa-mar em baixo, preia-mar em cima. */}
        {level !== null ? (
          <div className="flex items-center gap-2">
            <div className="relative h-24 w-3 overflow-hidden rounded-full border border-abyss-500/50 bg-abyss-800">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full"
                style={{
                  height: `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%`,
                  background:
                    "linear-gradient(180deg, rgba(34,211,238,0.85), rgba(13,148,136,0.6))",
                }}
              />
              <div
                className="absolute inset-x-[-3px] h-0.5 bg-mist-50"
                style={{ bottom: `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%` }}
              />
            </div>
            <div className="flex h-24 flex-col justify-between text-[0.5625rem] tracking-wide text-mist-500 uppercase">
              <span>preia</span>
              <span>baixa</span>
            </div>
          </div>
        ) : null}
      </div>

      <dl className="grid gap-2.5 sm:grid-cols-2">
        <ExtremeReading
          label="Próxima preia-mar"
          extreme={tide.nextHigh}
          direction="up"
        />
        <ExtremeReading
          label="Próxima baixa-mar"
          extreme={tide.nextLow}
          direction="down"
        />
      </dl>

      {tide.range ? (
        <p className="text-[0.6875rem] leading-relaxed text-mist-500">
          Amplitude observada na série disponível: {formatDecimal(tide.range.min)} m
          a {formatDecimal(tide.range.max)} m ({formatDecimal(tide.range.max - tide.range.min)} m).
          {extremes.length > 0
            ? ` ${extremes.length} extremos identificados no período.`
            : ""}
        </p>
      ) : null}

      <p className="rounded-xl border border-abyss-500/40 bg-abyss-800/30 px-3 py-2 text-[0.6875rem] leading-relaxed text-mist-500">
        As horas de preia e baixa-mar são derivadas da série de nível do mar do
        fornecedor, com deteção de extremos locais. Não provêm de um modelo
        astronómico dedicado e não devem ser usadas para navegação.
      </p>
    </div>
  );
}

function ExtremeReading({
  label,
  extreme,
  direction,
}: {
  label: string;
  extreme: TideExtreme | null;
  direction: "up" | "down";
}) {
  if (!extreme) {
    return (
      <div className="rounded-[var(--radius-tile)] border border-abyss-500/40 bg-abyss-800/40 p-3">
        <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
          {label}
        </dt>
        <dd className="mt-1.5 text-sm text-mist-500">—</dd>
        <dd className="text-[0.6875rem] text-mist-500">
          Fora do período de previsão disponível
        </dd>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-tile)] border border-abyss-500/40 bg-abyss-800/40 p-3">
      <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
        {direction === "up" ? (
          <IconArrowUp size={12} className="text-tide-300" />
        ) : (
          <IconArrowDown size={12} className="text-mist-400" />
        )}
        {label}
      </dt>
      <dd className="font-display mt-1.5 text-lg font-semibold text-mist-50 tabular-nums">
        {formatPortugalTime(extreme.epochMs)}
      </dd>
      <dd className="mt-0.5 flex items-center gap-2 text-xs text-mist-400">
        <span className="font-mono tabular-nums">{formatDecimal(extreme.height)} m</span>
        <Chip variant={direction === "up" ? "tide" : "default"}>
          {extreme.type}
        </Chip>
      </dd>
    </div>
  );
}
