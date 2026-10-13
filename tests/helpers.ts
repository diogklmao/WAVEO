/**
 * WAVEO — auxiliares dos testes.
 *
 * Não é um ficheiro de teste (o `vitest.config.ts` só recolhe `*.test.ts`).
 * Existe para que os testes construam horas e spots reais sem repetirem vinte
 * campos nulos de cada vez, e para que qualquer campo novo em `HourlyForecast`
 * só tenha de ser declarado num sítio.
 */

import { bandFor } from "@/lib/surf/score";
import { getSpotBySlug } from "@/lib/spots";
import { portugalWallClockToEpoch, toPortugalIso } from "@/lib/time";
import type {
  HourlyForecast,
  ScoredHour,
  ScoreBand,
  SurfScore,
  SurfSpot,
  TideState,
} from "@/lib/types";

export const HOUR_MS = 3_600_000;

/** Instante absoluto a partir de uma hora de parede de Portugal. */
export function pt(localIso: string): number {
  const epochMs = portugalWallClockToEpoch(localIso);
  if (!Number.isFinite(epochMs)) throw new Error(`Data local inválida: ${localIso}`);
  return epochMs;
}

/** Um spot do catálogo real, para não testar contra uma configuração inventada. */
export function spot(slug = "matosinhos"): SurfSpot {
  const found = getSpotBySlug(slug);
  if (!found) throw new Error(`Spot desconhecido no catálogo: ${slug}`);
  return found;
}

/** `HourlyForecast` com todos os campos a `null`, ou seja, "não sabemos". */
const BLANK: Omit<HourlyForecast, "time" | "epochMs"> = {
  waveHeight: null,
  wavePeriod: null,
  waveDirection: null,
  swellHeight: null,
  swellPeriod: null,
  swellDirection: null,
  secondarySwellHeight: null,
  secondarySwellPeriod: null,
  secondarySwellDirection: null,
  windWaveHeight: null,
  windWavePeriod: null,
  windWaveDirection: null,
  seaSurfaceTemperature: null,
  seaLevelHeight: null,

  windSpeed: null,
  windGust: null,
  windDirection: null,
  airTemperature: null,
  apparentTemperature: null,
  precipitation: null,
  cloudCover: null,
  weatherCode: null,
  isDay: null,

  swellEnergyShare: null,
};

export function makeHour(
  epochMs: number,
  overrides: Partial<HourlyForecast> = {},
): HourlyForecast {
  return { ...BLANK, time: toPortugalIso(epochMs), epochMs, ...overrides };
}

/** Série horária contígua a partir de um instante base. */
export function hourlySeries(
  baseEpochMs: number,
  count: number,
  build: (index: number, epochMs: number) => Partial<HourlyForecast> = () => ({}),
): HourlyForecast[] {
  return Array.from({ length: count }, (_, index) => {
    const epochMs = baseEpochMs + index * HOUR_MS;
    return makeHour(epochMs, build(index, epochMs));
  });
}

/** Estado de maré utilizável, para isolar o fator maré nos testes de pontuação. */
export function tideState(overrides: Partial<TideState> = {}): TideState {
  return {
    available: true,
    height: 2,
    normalizedLevel: 0.5,
    stage: "subida",
    range: { min: 0.6, max: 3.4 },
    nextHigh: null,
    nextLow: null,
    ...overrides,
  };
}

/** Estado de maré indisponível, com o motivo preenchido. */
export function noTide(reason = "sem dados de maré nos testes"): TideState {
  return {
    available: false,
    height: null,
    normalizedLevel: null,
    stage: null,
    range: null,
    nextHigh: null,
    nextLow: null,
    reason,
  };
}

/** `SurfScore` mínimo, para testes que só se interessam pelo valor. */
export function fakeScore(value: number, band: ScoreBand = bandFor(value)): SurfScore {
  return {
    value,
    band,
    label: band,
    confidence: 1,
    factors: [],
    summary: "",
    biggestLimiter: null,
    biggestStrength: null,
    provisional: true,
  };
}

/** Hora avaliada, para os testes da deteção de janelas. */
export function makeScored(
  epochMs: number,
  value: number,
  band?: ScoreBand,
): ScoredHour {
  return {
    hour: makeHour(epochMs),
    tide: noTide(),
    score: fakeScore(value, band),
  };
}
