/**
 * WAVEO — avaliação de uma série horária.
 *
 * Passo intermédio entre os fornecedores e as vistas: pega nas horas já
 * normalizadas e produz, para cada uma, o estado de maré e o Surf Score.
 * Tanto a deteção da melhor janela como os resumos diários consomem esta
 * estrutura, o que garante que todos os ecrãs mostram exatamente os mesmos
 * números para a mesma hora.
 */

import type { HourlyForecast, ScoredHour, SurfSpot, TideState } from "../types";
import { computeSurfScore } from "./score";
import type { TideSeries } from "./tides";
import { tideStateAt } from "./tides";

// `ScoredHour` é definido no modelo de domínio, para que as camadas de
// apresentação o possam importar sem depender deste módulo.
export type { ScoredHour };

export function evaluateHours(
  spot: SurfSpot,
  hours: readonly HourlyForecast[],
  tideSeries: TideSeries,
): ScoredHour[] {
  return hours.map((hour) => {
    const tide = tideStateAt(tideSeries, hour.epochMs);
    return {
      hour,
      tide,
      score: computeSurfScore({ spot, hour, tide }),
    };
  });
}

/** Filtra a avaliação a partir de um instante, mantendo a ordem cronológica. */
export function fromInstant(
  scored: readonly ScoredHour[],
  fromEpochMs: number,
): ScoredHour[] {
  return scored.filter((entry) => entry.hour.epochMs >= fromEpochMs);
}

/**
 * Hora avaliada mais próxima de um instante. Usada para o painel de condições
 * atuais, porque a previsão é horária e o instante presente cai entre amostras.
 */
export function nearestTo(
  scored: readonly ScoredHour[],
  epochMs: number,
): ScoredHour | null {
  let best: ScoredHour | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const entry of scored) {
    const delta = Math.abs(entry.hour.epochMs - epochMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = entry;
    }
  }
  return best;
}

/**
 * Hora avaliada que representa "agora": a amostra horária em que o instante
 * presente cai, ou seja, a última cuja hora é menor ou igual a `epochMs`.
 * Se não existir (estamos antes do início da previsão), usamos a primeira.
 */
export function currentEntry(
  scored: readonly ScoredHour[],
  epochMs: number,
): ScoredHour | null {
  if (scored.length === 0) return null;
  let candidate: ScoredHour | null = null;
  for (const entry of scored) {
    if (entry.hour.epochMs <= epochMs) candidate = entry;
    else break;
  }
  return candidate ?? scored[0] ?? null;
}
