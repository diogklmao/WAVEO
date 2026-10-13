/**
 * WAVEO — deteção da melhor janela para surfar.
 *
 * A abordagem é deliberadamente simples e explicável: procuramos troços
 * contínuos de horas cuja pontuação atinge um mínimo, ordenamo-los por
 * qualidade média e, em caso de empate próximo, preferimos o mais longo.
 *
 * Não há aqui nenhuma tentativa de prever "a onda do dia" nem de prometer
 * horas exatas: a resolução é a da previsão horária, e as fronteiras da janela
 * são arredondadas a essa grelha.
 */

import { formatPortugalTimeShort, relativeDayLabel } from "../time";
import type { HourlyForecast, SurfWindow, SurfSpot } from "../types";
import { BEST_WINDOW_CONFIG } from "./config";
import { bandFor } from "./score";
import type { ScoredHour } from "./evaluate";

const HOUR_MS = 3_600_000;

export interface WindowSearchOptions {
  /** Horizonte de procura, em horas, a contar de agora. */
  horizonHours?: number;
  /** Pontuação mínima para uma hora contar como boa. */
  minScore?: number;
  /** Duração mínima da janela, em horas. */
  minHours?: number;
  /** Duração máxima reportada; troços maiores são recortados. */
  maxHours?: number;
}

interface Run {
  entries: ScoredHour[];
  averageScore: number;
  peakScore: number;
}

/**
 * Procura a melhor janela para surfar.
 * Devolve `null` quando nenhuma hora atinge o mínimo — nesse caso a interface
 * diz explicitamente que não há uma boa janela, em vez de apresentar a "menos
 * má" como se fosse uma recomendação.
 */
export function findBestWindow(
  scored: readonly ScoredHour[],
  nowEpochMs: number,
  options: WindowSearchOptions = {},
): SurfWindow | null {
  const {
    horizonHours = BEST_WINDOW_CONFIG.horizonHours,
    minScore = BEST_WINDOW_CONFIG.minScore,
    minHours = BEST_WINDOW_CONFIG.minHours,
    maxHours = BEST_WINDOW_CONFIG.maxHours,
  } = options;

  const runs = collectRuns(scored, nowEpochMs, horizonHours, minScore, minHours, maxHours);
  if (runs.length === 0) return null;

  // Ordena por qualidade média; empates até 0.3 pontos resolvem-se pelo troço
  // mais longo, porque uma janela mais longa dá mais flexibilidade a quem vai.
  const ranked = [...runs].sort((a, b) => {
    const qualityGap = b.averageScore - a.averageScore;
    if (Math.abs(qualityGap) > 0.3) return qualityGap;
    return b.entries.length - a.entries.length;
  });

  const best = ranked[0]!;
  return toWindow(best, nowEpochMs);
}

/** A melhor hora isolada, mesmo que abaixo do mínimo de janela. */
export function findBestHour(
  scored: readonly ScoredHour[],
  nowEpochMs: number,
  horizonHours = BEST_WINDOW_CONFIG.horizonHours,
): ScoredHour | null {
  const limit = nowEpochMs + horizonHours * HOUR_MS;
  const candidates = scored.filter(
    (entry) =>
      entry.hour.epochMs >= nowEpochMs &&
      entry.hour.epochMs <= limit &&
      entry.score.band !== "indisponivel",
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, entry) =>
    entry.score.value > best.score.value ? entry : best,
  );
}

/* =============================================================================
   Interno
   ============================================================================= */

function collectRuns(
  scored: readonly ScoredHour[],
  nowEpochMs: number,
  horizonHours: number,
  minScore: number,
  minHours: number,
  maxHours: number,
): Run[] {
  const limit = nowEpochMs + horizonHours * HOUR_MS;
  const inHorizon = scored.filter(
    (entry) => entry.hour.epochMs >= nowEpochMs && entry.hour.epochMs <= limit,
  );

  const runs: Run[] = [];
  let current: ScoredHour[] = [];
  let previousEpoch: number | null = null;

  const flush = () => {
    if (current.length >= minHours) {
      runs.push(summariseRun(current));
    }
    current = [];
  };

  for (const entry of inHorizon) {
    const good =
      entry.score.band !== "indisponivel" && entry.score.value >= minScore;
    const contiguous =
      previousEpoch === null || entry.hour.epochMs - previousEpoch <= HOUR_MS * 1.5;

    if (!good || !contiguous) {
      flush();
      if (!good) {
        previousEpoch = entry.hour.epochMs;
        continue;
      }
    }

    current.push(entry);
    previousEpoch = entry.hour.epochMs;
  }
  flush();

  return runs.map((run) => trimRun(run, maxHours));
}

function summariseRun(entries: ScoredHour[]): Run {
  const values = entries.map((e) => e.score.value);
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    entries,
    averageScore: sum / values.length,
    peakScore: Math.max(...values),
  };
}

/**
 * Se um troço for mais longo do que o máximo reportado, devolvemos a
 * sub-janela contígua com a melhor média. Assim, uma boa maré de fundo ao
 * longo de 12 horas não é apresentada como "12 horas excelentes".
 */
function trimRun(run: Run, maxHours: number): Run {
  if (run.entries.length <= maxHours) return run;

  let bestStart = 0;
  let bestAverage = -Infinity;

  for (let start = 0; start + maxHours <= run.entries.length; start += 1) {
    const slice = run.entries.slice(start, start + maxHours);
    const average =
      slice.reduce((acc, e) => acc + e.score.value, 0) / slice.length;
    if (average > bestAverage) {
      bestAverage = average;
      bestStart = start;
    }
  }

  const entries = run.entries.slice(bestStart, bestStart + maxHours);
  return summariseRun(entries);
}

function toWindow(run: Run, nowEpochMs: number): SurfWindow {
  const first = run.entries[0]!;
  const last = run.entries[run.entries.length - 1]!;
  // A hora final é inclusiva: uma janela de 07h a 09h termina às 10h.
  const endEpochMs = last.hour.epochMs + HOUR_MS;
  const hours = Math.round((endEpochMs - first.hour.epochMs) / HOUR_MS);
  const averageScore = Math.round(run.averageScore * 10) / 10;

  return {
    start: first.hour.time,
    startEpochMs: first.hour.epochMs,
    end: last.hour.time,
    endEpochMs,
    hours,
    averageScore,
    peakScore: Math.round(run.peakScore * 10) / 10,
    band: bandFor(averageScore),
    headline: buildHeadline(first.hour, endEpochMs, nowEpochMs),
  };
}

function buildHeadline(
  firstHour: HourlyForecast,
  endEpochMs: number,
  nowEpochMs: number,
): string {
  const day = relativeDayLabel(firstHour.epochMs, nowEpochMs);
  const start = formatPortugalTimeShort(firstHour.epochMs);
  const end = formatPortugalTimeShort(endEpochMs);
  return `${day}, ${start}–${end}`;
}

/**
 * Descrição textual de uma janela, pronta a apresentar.
 * Mantém a honestidade sobre o que é uma previsão horária: as fronteiras estão
 * na grelha de uma hora.
 */
export function describeWindow(window: SurfWindow): string {
  const hoursLabel = window.hours === 1 ? "1 hora" : `${window.hours} horas`;
  return `${window.headline} · ${hoursLabel} com pontuação média de ${window.averageScore.toFixed(1).replace(".", ",")}`;
}

/**
 * Alternativa quando não existe nenhuma janela que atinja o mínimo.
 * Descreve o melhor momento disponível sem o apresentar como recomendação.
 */
export function describeNoWindow(
  spot: SurfSpot,
  bestHour: ScoredHour | null,
  nowEpochMs: number,
): string {
  if (!bestHour) {
    return `Não há dados suficientes para identificar uma janela de surf em ${spot.name} nas próximas horas.`;
  }
  const when = relativeDayLabel(bestHour.hour.epochMs, nowEpochMs);
  const time = formatPortugalTimeShort(bestHour.hour.epochMs);
  return `Não há nenhuma janela claramente boa nas próximas horas em ${spot.name}. O melhor momento será ${when.toLowerCase()} por volta das ${time}, e ainda assim com condições fracas.`;
}
