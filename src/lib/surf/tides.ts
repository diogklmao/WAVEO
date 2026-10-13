/**
 * WAVEO — análise de marés.
 *
 * O Open-Meteo Marine devolve a altura do nível do mar relativamente ao nível
 * médio (`sea_level_height_msl`) como uma série horária. A partir dessa série
 * derivamos:
 *
 *  - as horas e alturas da preia-mar e da baixa-mar, por deteção de extremos
 *    locais com refinamento parabólico (o que dá precisão de minutos, em vez
 *    de arredondar à hora);
 *  - o estágio da maré (a subir / a descer / estagnada);
 *  - o nível normalizado entre a baixa-mar e a preia-mar que enquadram o
 *    instante em causa — que é a grandeza que as preferências de cada spot
 *    usam.
 *
 * Se a variável não vier do fornecedor, a série é marcada como indisponível e
 * o motor de pontuação exclui o fator maré em vez de assumir um valor. Não
 * estimamos marés a partir de outras variáveis.
 */

import { clamp } from "../geo";
import { portugalDayKey, toPortugalIso } from "../time";
import type { HourlyForecast, Range, TideExtreme, TideStage, TideState } from "../types";

/** Número mínimo de amostras para tentar detetar extremos com confiança. */
const MIN_SAMPLES_FOR_EXTREMES = 12;

/** Separação mínima aceitável entre dois extremos do mesmo tipo (horas). */
const MIN_EXTREME_SEPARATION_H = 3;

/** Janela em torno de um extremo considerada "maré estagnada" (horas). */
const SLACK_WINDOW_H = 0.5;

interface Sample {
  epochMs: number;
  height: number;
}

export interface TideSample {
  height: number | null;
  normalizedLevel: number | null;
  stage: TideStage | "estagnada" | null;
}

export interface TideSeries {
  available: boolean;
  reason?: string;
  extremes: TideExtreme[];
  range: Range | null;
  /** Número de amostras com dados de maré. */
  sampleCount: number;
  sampleAt(epochMs: number): TideSample;
}

const UNAVAILABLE: TideSample = {
  height: null,
  normalizedLevel: null,
  stage: null,
};

/**
 * Constrói a série de maré a partir das horas já normalizadas.
 * Nunca lança: em caso de dados insuficientes devolve uma série indisponível
 * com o motivo preenchido.
 */
export function buildTideSeries(hours: readonly HourlyForecast[]): TideSeries {
  const samples: Sample[] = hours
    .filter(
      (h): h is HourlyForecast & { seaLevelHeight: number } =>
        h.seaLevelHeight !== null && Number.isFinite(h.seaLevelHeight),
    )
    .map((h) => ({ epochMs: h.epochMs, height: h.seaLevelHeight }))
    .sort((a, b) => a.epochMs - b.epochMs);

  if (samples.length === 0) {
    return unavailableSeries(
      "O fornecedor não devolveu altura do nível do mar para este ponto. A maré não entra no cálculo.",
      0,
    );
  }

  const range = computeRange(samples);

  if (samples.length < MIN_SAMPLES_FOR_EXTREMES) {
    return {
      available: true,
      extremes: [],
      range,
      sampleCount: samples.length,
      sampleAt: (epochMs) => sampleWithoutExtremes(samples, range, epochMs),
      reason: undefined,
    };
  }

  const extremes = enforceAlternation(detectExtremes(samples));

  if (extremes.length < 2) {
    return {
      available: true,
      extremes,
      range,
      sampleCount: samples.length,
      sampleAt: (epochMs) => sampleWithoutExtremes(samples, range, epochMs),
    };
  }

  return {
    available: true,
    extremes,
    range,
    sampleCount: samples.length,
    sampleAt: (epochMs) => sampleWithExtremes(samples, extremes, range, epochMs),
  };
}

function unavailableSeries(reason: string, sampleCount: number): TideSeries {
  return {
    available: false,
    reason,
    extremes: [],
    range: null,
    sampleCount,
    sampleAt: () => UNAVAILABLE,
  };
}

/* =============================================================================
   Deteção de extremos
   ============================================================================= */

function detectExtremes(samples: readonly Sample[]): TideExtreme[] {
  const found: TideExtreme[] = [];

  for (let i = 1; i < samples.length - 1; i += 1) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;
    const next = samples[i + 1]!;

    const isHigh = curr.height > prev.height && curr.height >= next.height;
    const isLow = curr.height < prev.height && curr.height <= next.height;
    if (!isHigh && !isLow) continue;

    // Refinamento parabólico: permite reportar a hora do extremo com precisão
    // melhor do que a hora cheia da série.
    const { offsetHours, height } = parabolicVertex(prev, curr, next);
    const epochMs = curr.epochMs + offsetHours * 3_600_000;

    found.push({
      time: toPortugalIso(epochMs),
      epochMs,
      type: isHigh ? "cheia" : "baixa",
      height: Number.isFinite(height) ? height : curr.height,
    });
  }

  return found.sort((a, b) => a.epochMs - b.epochMs);
}

/**
 * Vértice da parábola que passa por três pontos igualmente espaçados.
 * Devolve o deslocamento em horas face ao ponto central e a altura refinada.
 */
function parabolicVertex(
  prev: Sample,
  curr: Sample,
  next: Sample,
): { offsetHours: number; height: number } {
  const denominator = prev.height - 2 * curr.height + next.height;
  if (Math.abs(denominator) < 1e-9) {
    return { offsetHours: 0, height: curr.height };
  }
  const rawOffset = (0.5 * (prev.height - next.height)) / denominator;
  // O vértice tem de estar entre os pontos vizinhos; caso contrário o sinal
  // está mal condicionado e preferimos não refinar.
  const offsetHours = clamp(rawOffset, -0.5, 0.5);
  const height = curr.height - 0.25 * (prev.height - next.height) * offsetHours;
  return { offsetHours, height };
}

/**
 * Garante que a sequência alterna entre cheia e baixa, mantendo o extremo
 * mais pronunciado quando dois do mesmo tipo aparecem seguidos, e descartando
 * extremos demasiado próximos (ruído da série).
 */
function enforceAlternation(extremes: readonly TideExtreme[]): TideExtreme[] {
  const result: TideExtreme[] = [];

  for (const extreme of extremes) {
    const last = result[result.length - 1];

    if (!last) {
      result.push(extreme);
      continue;
    }

    const hoursApart = (extreme.epochMs - last.epochMs) / 3_600_000;

    if (last.type === extreme.type) {
      // Dois extremos do mesmo tipo seguidos: mantemos o mais pronunciado.
      const keepNew =
        extreme.type === "cheia"
          ? extreme.height > last.height
          : extreme.height < last.height;
      if (keepNew) result[result.length - 1] = extreme;
      continue;
    }

    if (hoursApart < MIN_EXTREME_SEPARATION_H) {
      // Demasiado próximos para serem um ciclo real; mantemos o mais extremo.
      const lastIsMoreExtreme =
        last.type === "cheia" ? last.height >= extreme.height : last.height <= extreme.height;
      if (!lastIsMoreExtreme) result[result.length - 1] = extreme;
      continue;
    }

    result.push(extreme);
  }

  return result;
}

/* =============================================================================
   Amostragem
   ============================================================================= */

function computeRange(samples: readonly Sample[]): Range | null {
  if (samples.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of samples) {
    if (s.height < min) min = s.height;
    if (s.height > max) max = s.height;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/** Interpola linearmente a altura do nível do mar num instante arbitrário. */
function interpolateHeight(samples: readonly Sample[], epochMs: number): number | null {
  if (samples.length === 0) return null;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (epochMs <= first.epochMs) return first.height;
  if (epochMs >= last.epochMs) return last.height;

  for (let i = 1; i < samples.length; i += 1) {
    const b = samples[i]!;
    if (epochMs <= b.epochMs) {
      const a = samples[i - 1]!;
      const span = b.epochMs - a.epochMs;
      if (span <= 0) return b.height;
      const t = (epochMs - a.epochMs) / span;
      return a.height + t * (b.height - a.height);
    }
  }
  return last.height;
}

function sampleWithExtremes(
  samples: readonly Sample[],
  extremes: readonly TideExtreme[],
  range: Range | null,
  epochMs: number,
): TideSample {
  const height = interpolateHeight(samples, epochMs);
  if (height === null) return UNAVAILABLE;

  const before = lastExtremeBefore(extremes, epochMs);
  const after = firstExtremeAfter(extremes, epochMs);

  // Maré estagnada: estamos praticamente em cima de um extremo.
  let stage: TideStage | "estagnada" | null = null;
  const nearest = nearestExtreme(extremes, epochMs);
  if (nearest && Math.abs(nearest.epochMs - epochMs) <= SLACK_WINDOW_H * 3_600_000) {
    stage = "estagnada";
  } else if (after) {
    stage = after.type === "cheia" ? "subida" : "descida";
  } else if (before) {
    stage = before.type === "baixa" ? "subida" : "descida";
  }

  // Nível normalizado face ao par baixa-mar/preia-mar que enquadra o instante.
  let normalizedLevel: number | null = null;
  const low = pickReference(before, after, "baixa");
  const high = pickReference(before, after, "cheia");
  if (low && high && Math.abs(high.height - low.height) > 1e-6) {
    normalizedLevel = clamp((height - low.height) / (high.height - low.height), 0, 1);
  } else if (range && Math.abs(range.max - range.min) > 1e-6) {
    normalizedLevel = clamp((height - range.min) / (range.max - range.min), 0, 1);
  }

  return { height, normalizedLevel, stage };
}

function sampleWithoutExtremes(
  samples: readonly Sample[],
  range: Range | null,
  epochMs: number,
): TideSample {
  const height = interpolateHeight(samples, epochMs);
  if (height === null) return UNAVAILABLE;

  // Sem extremos detetados, o estágio é estimado pela variação ao longo de
  // uma hora. É uma aproximação, e é apresentada como tal.
  const before = interpolateHeight(samples, epochMs - 3_600_000);
  const after = interpolateHeight(samples, epochMs + 3_600_000);
  let stage: TideStage | "estagnada" | null = null;
  if (before !== null && after !== null) {
    const delta = after - before;
    const threshold = 0.01;
    if (Math.abs(delta) < threshold) stage = "estagnada";
    else stage = delta > 0 ? "subida" : "descida";
  }

  const normalizedLevel =
    range && Math.abs(range.max - range.min) > 1e-6
      ? clamp((height - range.min) / (range.max - range.min), 0, 1)
      : null;

  return { height, normalizedLevel, stage };
}

function lastExtremeBefore(
  extremes: readonly TideExtreme[],
  epochMs: number,
): TideExtreme | null {
  let found: TideExtreme | null = null;
  for (const e of extremes) {
    if (e.epochMs <= epochMs) found = e;
    else break;
  }
  return found;
}

function firstExtremeAfter(
  extremes: readonly TideExtreme[],
  epochMs: number,
): TideExtreme | null {
  for (const e of extremes) {
    if (e.epochMs > epochMs) return e;
  }
  return null;
}

function nearestExtreme(
  extremes: readonly TideExtreme[],
  epochMs: number,
): TideExtreme | null {
  let best: TideExtreme | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const e of extremes) {
    const delta = Math.abs(e.epochMs - epochMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = e;
    }
  }
  return best;
}

function pickReference(
  before: TideExtreme | null,
  after: TideExtreme | null,
  type: TideExtreme["type"],
): TideExtreme | null {
  if (before?.type === type) return before;
  if (after?.type === type) return after;
  return null;
}

/* =============================================================================
   Estados de maré prontos a apresentar
   ============================================================================= */

/** Estado de maré completo para um instante concreto. */
export function tideStateAt(series: TideSeries, epochMs: number): TideState {
  if (!series.available) {
    return {
      available: false,
      height: null,
      normalizedLevel: null,
      stage: null,
      range: null,
      nextHigh: null,
      nextLow: null,
      reason: series.reason ?? "Dados de maré indisponíveis para este ponto.",
    };
  }

  const sample = series.sampleAt(epochMs);
  const nextHigh = series.extremes.find(
    (e) => e.type === "cheia" && e.epochMs > epochMs,
  ) ?? null;
  const nextLow = series.extremes.find(
    (e) => e.type === "baixa" && e.epochMs > epochMs,
  ) ?? null;

  return {
    available: sample.height !== null,
    height: sample.height,
    normalizedLevel: sample.normalizedLevel,
    stage: sample.stage,
    range: series.range,
    nextHigh,
    nextLow,
    reason:
      sample.height === null
        ? "Não foi possível interpolar a altura da maré neste instante."
        : undefined,
  };
}

/** Extremos a apresentar, limitados a um horizonte a partir de agora. */
export function upcomingExtremes(
  series: TideSeries,
  fromEpochMs: number,
  maxCount = 8,
): TideExtreme[] {
  if (!series.available) return [];
  return series.extremes
    .filter((e) => e.epochMs >= fromEpochMs - 3_600_000)
    .slice(0, maxCount);
}

/** Agrupa extremos por dia local de Portugal, útil para a vista de marés. */
export function extremesByDay(
  extremes: readonly TideExtreme[],
): Map<string, TideExtreme[]> {
  const map = new Map<string, TideExtreme[]>();
  for (const extreme of extremes) {
    const key = portugalDayKey(extreme.epochMs);
    const list = map.get(key);
    if (list) list.push(extreme);
    else map.set(key, [extreme]);
  }
  return map;
}

/**
 * Amplitude da maré (diferença entre a maior preia-mar e a menor baixa-mar
 * da série). Útil para distinguir marés vivas de marés mortas.
 */
export function tidalAmplitude(series: TideSeries): number | null {
  if (!series.available || series.extremes.length === 0) return null;
  const highs = series.extremes.filter((e) => e.type === "cheia");
  const lows = series.extremes.filter((e) => e.type === "baixa");
  if (highs.length === 0 || lows.length === 0) return null;
  const maxHigh = Math.max(...highs.map((e) => e.height));
  const minLow = Math.min(...lows.map((e) => e.height));
  return maxHigh - minLow;
}
