/**
 * WAVEO — faixa horária.
 *
 * A leitura que um surfista faz antes de sair de casa é sequencial: "a partir
 * de que hora é que isto compõe?". A faixa responde a isso numa linha, com
 * scroll horizontal no telemóvel, sem obrigar a interpretar um gráfico.
 *
 * É um Server Component: não tem estado nem interatividade, apenas scroll
 * nativo do browser.
 */

import { DirectionArrow } from "@/components/ui/CompassDial";
import { scoreColor, formatDecimal, formatInteger, scoreBandLabel } from "@/lib/format";
import { formatPortugalTimeShort, portugalDayKey, relativeDayLabel, weekdayAbbrev } from "@/lib/time";
import type { ScoredHour } from "@/lib/surf/evaluate";

export function HourlyStrip({
  scored,
  nowEpochMs,
  maxHours = 24,
  label = "Próximas 24 horas",
}: {
  scored: ScoredHour[];
  nowEpochMs: number;
  maxHours?: number;
  label?: string;
}) {
  const entries = scored.filter((entry) => entry.hour.epochMs >= nowEpochMs).slice(0, maxHours);

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-abyss-500/60 bg-abyss-800/40 px-4 py-6 text-center text-sm text-mist-400">
        Não há horas de previsão futuras para apresentar.
      </p>
    );
  }

  const heights = entries
    .map((entry) => entry.hour.waveHeight)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxHeight = heights.length > 0 ? Math.max(...heights) : 1;

  return (
    <div
      className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label={`${label}: ${entries.length} horas de previsão`}
    >
      {entries.map((entry, index) => {
        const previous = index > 0 ? (entries[index - 1] ?? null) : null;
        const startsNewDay =
          previous === null ||
          portugalDayKey(previous.hour.epochMs) !== portugalDayKey(entry.hour.epochMs);
        const isNow = entry.hour.epochMs <= nowEpochMs + 3_600_000 && index === 0;
        const waveHeight = entry.hour.waveHeight;
        const barFraction =
          waveHeight !== null && Number.isFinite(waveHeight)
            ? Math.max(0.06, Math.min(1, waveHeight / maxHeight))
            : 0;
        const colour = entry.score.band === "indisponivel" ? "#64748b" : scoreColor(entry.score.value);

        return (
          <div key={entry.hour.epochMs} className="flex shrink-0 snap-start flex-col">
            <div className="h-4 text-center text-[0.625rem] font-semibold tracking-wide text-tide-300 uppercase">
              {startsNewDay ? relativeDayLabel(entry.hour.epochMs, nowEpochMs) : null}
            </div>

            <div
              className={`flex w-[4.5rem] flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2 transition-colors ${
                isNow
                  ? "border-tide-400/50 bg-tide-600/10"
                  : "border-abyss-500/40 bg-abyss-800/40"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-mono text-[0.6875rem] font-semibold text-mist-200 tabular-nums">
                  {formatPortugalTimeShort(entry.hour.epochMs)}
                </span>
                {isNow ? (
                  <span className="rounded-full bg-tide-500/25 px-1 text-[0.5625rem] font-bold tracking-wide text-tide-200 uppercase">
                    agora
                  </span>
                ) : null}
              </div>

              {/* Barra de altura de onda, proporcional ao máximo da janela */}
              <div
                className="flex h-11 w-full items-end justify-center"
                aria-hidden="true"
              >
                <div
                  className="w-6 rounded-t-md"
                  style={{
                    height: `${Math.round(barFraction * 100)}%`,
                    background: `linear-gradient(180deg, ${colour} 0%, ${colour}55 100%)`,
                  }}
                />
              </div>

              <span className="font-mono text-xs font-semibold text-mist-100 tabular-nums">
                {waveHeight === null ? "—" : `${formatDecimal(waveHeight)}`}
                <span className="text-[0.625rem] font-normal text-mist-500"> m</span>
              </span>

              <div className="flex items-center gap-0.5 text-mist-300">
                <DirectionArrow
                  direction={entry.hour.windDirection}
                  size={13}
                  className="text-signal-fair"
                />
                <span className="font-mono text-[0.6875rem] tabular-nums">
                  {entry.hour.windSpeed === null ? "—" : formatInteger(entry.hour.windSpeed)}
                </span>
              </div>

              <span
                className="mt-0.5 w-full rounded-md border py-0.5 text-center font-mono text-[0.6875rem] font-bold tabular-nums"
                style={{ borderColor: `${colour}66`, color: colour }}
                title={scoreBandLabel(entry.score.band)}
              >
                {entry.score.band === "indisponivel" ? "—" : formatDecimal(entry.score.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
