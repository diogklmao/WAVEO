/**
 * WAVEO — resumos diários.
 *
 * Agrega a avaliação horária por dia local de Portugal. Só são consideradas as
 * horas a partir de agora: as horas já passadas não são apresentadas como
 * previsão, para não inflacionar nem desvalorizar o resumo do dia corrente.
 */

import { circularMean, maxOf, mean, minOf } from "../geo";
import {
  formatPortugalTimeShort,
  portugalDayKey,
  portugalWallClockToEpoch,
  toPortugalIso,
  weekdayAbbrev,
} from "../time";
import { scoreBandLabel } from "../format";
import type { DailySummary, SurfSpot } from "../types";
import { bandFor } from "./score";
import type { ScoredHour } from "./evaluate";

const HOUR_MS = 3_600_000;

export function buildDailySummaries(
  _spot: SurfSpot,
  scored: readonly ScoredHour[],
  nowEpochMs: number,
): DailySummary[] {
  const relevant = scored.filter((entry) => entry.hour.epochMs >= nowEpochMs);
  const groups = new Map<string, ScoredHour[]>();

  for (const entry of relevant) {
    const key = portugalDayKey(entry.hour.epochMs);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  const summaries: DailySummary[] = [];

  for (const [date, entries] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    summaries.push(summariseDay(date, entries));
  }

  return summaries;
}

function summariseDay(date: string, entries: readonly ScoredHour[]): DailySummary {
  const hours = entries.map((e) => e.hour);

  const waveHeights = hours.map((h) => h.waveHeight);
  const periods = hours.map((h) => h.swellPeriod ?? h.wavePeriod);
  const windSpeeds = hours.map((h) => h.windSpeed);
  const windGusts = hours.map((h) => h.windGust);
  const windDirections = hours.map((h) => h.windDirection);
  const airTemps = hours.map((h) => h.airTemperature);
  const waterTemps = hours.map((h) => h.seaSurfaceTemperature);

  const usable = entries.filter((e) => e.score.band !== "indisponivel");
  const scoreValues = usable.map((e) => e.score.value);

  const peak = usable.reduce<ScoredHour | null>(
    (best, entry) => (!best || entry.score.value > best.score.value ? entry : best),
    null,
  );

  const averageScore = mean(scoreValues);
  const roundedAverage = averageScore === null ? null : round1(averageScore);

  // O dia começa à meia-noite local, o que dá um rótulo estável mesmo quando a
  // primeira hora disponível é mais tarde.
  const dayStartEpoch = entries[0]!.hour.epochMs;

  return {
    date,
    weekday: weekdayAbbrev(dayStartEpoch),
    label: `${weekdayAbbrev(dayStartEpoch)} ${Number(date.slice(8, 10))}`,
    waveHeightMin: round1OrNull(minOf(waveHeights)),
    waveHeightMax: round1OrNull(maxOf(waveHeights)),
    wavePeriodAvg: round1OrNull(mean(periods)),
    windSpeedAvg: round1OrNull(mean(windSpeeds)),
    windGustMax: round1OrNull(maxOf(windGusts)),
    windDirectionDominant: round0OrNull(circularMean(windDirections)),
    airTempMin: round1OrNull(minOf(airTemps)),
    airTempMax: round1OrNull(maxOf(airTemps)),
    waterTempAvg: round1OrNull(mean(waterTemps)),
    scoreAvg: roundedAverage,
    scorePeak: peak ? round1(peak.score.value) : null,
    peakHour: peak ? toPortugalIso(peak.hour.epochMs) : null,
    peakHourScore: peak ? round1(peak.score.value) : null,
    band: roundedAverage === null ? "indisponivel" : bandFor(roundedAverage),
    confidence:
      usable.length === 0
        ? 0
        : usable.reduce((sum, e) => sum + e.score.confidence, 0) / usable.length,
    hoursWithData: usable.length,
  };
}

/**
 * Hora do melhor momento do dia, pronta a apresentar ("14h").
 *
 * `peakHour` é uma hora de parede de Portugal ("2026-10-13T14:00"), pelo que
 * tem de passar pela conversão explícita antes de ser formatada: interpretá-la
 * como UTC somaria o deslocamento do horário de verão e mostraria 15h.
 */
export function peakHourLabel(summary: DailySummary): string {
  if (!summary.peakHour) return "—";
  const epochMs = portugalWallClockToEpoch(summary.peakHour);
  if (!Number.isFinite(epochMs)) return "—";
  return formatPortugalTimeShort(epochMs);
}

/** Resumo textual curto de um dia, para listas e cartões. */
export function describeDay(summary: DailySummary): string {
  const parts: string[] = [scoreBandLabel(summary.band)];
  if (summary.waveHeightMin !== null && summary.waveHeightMax !== null) {
    parts.push(
      `ondas ${fmt(summary.waveHeightMin)}–${fmt(summary.waveHeightMax)} m`,
    );
  }
  if (summary.windSpeedAvg !== null) {
    parts.push(`vento médio ${Math.round(summary.windSpeedAvg)} km/h`);
  }
  return parts.join(" · ");
}

/** Número de dias completos abrangidos pela previsão. */
export function forecastDayCount(scored: readonly ScoredHour[]): number {
  const keys = new Set(scored.map((e) => portugalDayKey(e.hour.epochMs)));
  return keys.size;
}

/** Diferença, em horas, entre o fim e o início da série avaliada. */
export function forecastSpanHours(scored: readonly ScoredHour[]): number {
  if (scored.length < 2) return 0;
  const first = scored[0]!.hour.epochMs;
  const last = scored[scored.length - 1]!.hour.epochMs;
  return Math.round((last - first) / HOUR_MS) + 1;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round0OrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function round1OrNull(value: number | null): number | null {
  return value === null ? null : round1(value);
}

function fmt(value: number): string {
  return value.toFixed(1).replace(".", ",");
}
