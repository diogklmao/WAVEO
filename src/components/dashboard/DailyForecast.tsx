/**
 * WAVEO — previsão multi-dia.
 *
 * Uma tabela, porque é uma comparação entre dias ao longo das mesmas
 * grandezas. A ordenação das colunas segue a ordem por que um surfista decide:
 * primeiro o mar, depois o vento, depois o conforto, e só no fim a pontuação
 * que resume tudo.
 */

import type { ReactNode } from "react";
import { cx } from "@/components/ui/Surface";
import {
  formatDirectionShort,
  formatInteger,
  formatMeterRange,
  formatScore,
  scoreBandLabel,
  scoreColor,
} from "@/lib/format";
import { peakHourLabel } from "@/lib/surf/daily";
import type { DailySummary } from "@/lib/types";

export function DailyForecast({
  daily,
  className,
}: {
  daily: DailySummary[];
  className?: string;
}) {
  if (daily.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-abyss-500/60 bg-abyss-800/40 px-4 py-6 text-center text-sm text-mist-400">
        Não há dias de previsão disponíveis.
      </p>
    );
  }

  return (
    <div className={cx("-mx-1 overflow-x-auto px-1", className)}>
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">
          Resumo diário da previsão: altura de onda, período, vento,
          temperaturas, pontuação e melhor hora de cada dia.
        </caption>
        <thead>
          <tr className="border-b border-abyss-500/50 text-left">
            <Th className="w-[8.5rem]">Dia</Th>
            <Th>Ondulação</Th>
            <Th>Período</Th>
            <Th>Vento</Th>
            <Th>Ar</Th>
            <Th>Água</Th>
            <Th className="w-[9rem]">Pontuação</Th>
            <Th>Melhor hora</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-abyss-500/25">
          {daily.map((day) => {
            const unavailable = day.band === "indisponivel";
            const colour = unavailable ? "#64748b" : scoreColor(day.scoreAvg ?? 0);

            return (
              <tr key={day.date} className="align-middle transition-colors hover:bg-abyss-700/25">
                <td className="py-3 pr-4">
                  <span className="block font-semibold text-mist-100">{day.label}</span>
                  <span className="mt-0.5 block text-[0.625rem] tracking-wide text-mist-500 uppercase">
                    {day.weekday}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <span className="font-mono font-semibold text-mist-100 tabular-nums">
                    {formatMeterRange(day.waveHeightMin, day.waveHeightMax)}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <span className="font-mono text-mist-200 tabular-nums">
                    {day.wavePeriodAvg === null ? "—" : `${formatInteger(day.wavePeriodAvg)} s`}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="font-mono text-mist-100 tabular-nums">
                      {day.windSpeedAvg === null ? "—" : `${formatInteger(day.windSpeedAvg)}`}
                    </span>
                    <span className="text-[0.6875rem] text-mist-500">km/h</span>
                    {day.windDirectionDominant !== null ? (
                      <span className="text-[0.6875rem] font-semibold text-mist-400">
                        {formatDirectionShort(day.windDirectionDominant)}
                      </span>
                    ) : null}
                  </span>
                  {day.windGustMax !== null ? (
                    <span className="mt-0.5 block text-[0.6875rem] text-mist-500">
                      rajadas até {formatInteger(day.windGustMax)} km/h
                    </span>
                  ) : null}
                </td>

                <td className="py-3 pr-4">
                  <span className="font-mono text-mist-200 tabular-nums">
                    {day.airTempMin === null || day.airTempMax === null
                      ? "—"
                      : `${Math.round(day.airTempMin)}° / ${Math.round(day.airTempMax)}°`}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <span className="font-mono text-mist-200 tabular-nums">
                    {day.waterTempAvg === null
                      ? "—"
                      : `${Math.round(day.waterTempAvg)}°`}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-9 shrink-0 font-mono text-sm font-bold tabular-nums"
                      style={{ color: colour }}
                    >
                      {unavailable ? "—" : formatScore(day.scoreAvg)}
                    </span>
                    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-abyss-700/70">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${unavailable ? 0 : Math.round(((day.scoreAvg ?? 0) / 10) * 100)}%`,
                          background: colour,
                        }}
                      />
                    </span>
                  </div>
                  <span className="mt-0.5 block text-[0.625rem] text-mist-500">
                    {unavailable
                      ? "sem dados"
                      : `pico ${formatScore(day.scorePeak)} · ${scoreBandLabel(day.band)}`}
                  </span>
                </td>

                <td className="py-3">
                  {day.peakHour && day.peakHourScore !== null ? (
                    <>
                      <span className="font-mono font-semibold text-mist-100 tabular-nums">
                        {peakHourLabel(day)}
                      </span>
                      <span className="mt-0.5 block text-[0.625rem] text-mist-500">
                        {formatScore(day.peakHourScore)}/10
                      </span>
                    </>
                  ) : (
                    <span className="text-mist-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-[0.6875rem] leading-relaxed text-mist-500">
        As horas são sempre apresentadas em hora de Portugal continental
        (Europe/Lisbon), incluindo a mudança de hora. Dias com poucas horas de
        dados utilizáveis têm pontuação menos fiável — a coluna de pontuação
        indica o pico, que pode ocorrer numa única hora.
      </p>
    </div>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cx(
        "pb-2.5 text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}
