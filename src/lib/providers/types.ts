/**
 * WAVEO — contratos dos fornecedores de dados.
 *
 * Cada fornecedor traduz a sua resposta para estes tipos intermédios. O resto
 * da aplicação nunca vê formatos específicos de fornecedor, o que permite
 * substituir um fornecedor sem tocar no motor de pontuação nem na interface.
 */

import type { ProviderReport } from "../types";

/** Hora de previsão marinha, já normalizada. */
export interface MarineHour {
  /** Hora local de Portugal, ISO sem fuso. */
  time: string;
  epochMs: number;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  swellPeriod: number | null;
  swellDirection: number | null;
  secondarySwellHeight: number | null;
  secondarySwellPeriod: number | null;
  secondarySwellDirection: number | null;
  windWaveHeight: number | null;
  windWavePeriod: number | null;
  windWaveDirection: number | null;
  seaSurfaceTemperature: number | null;
}

/** Hora de previsão meteorológica, já normalizada. */
export interface WeatherHour {
  time: string;
  epochMs: number;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  airTemperature: number | null;
  apparentTemperature: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
}

/** Hora de nível do mar, já normalizada. */
export interface TideHour {
  time: string;
  epochMs: number;
  seaLevelHeight: number | null;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

/** Série horária de um ponto geográfico. */
export interface LocationSeries<T> {
  /** Índice do ponto na ordem em que foi pedido. */
  index: number;
  /** Coordenadas efetivamente usadas pelo modelo, que podem diferir das pedidas. */
  latitude: number | null;
  longitude: number | null;
  hours: T[];
}

export interface ProviderResult<T> {
  series: LocationSeries<T>[];
  report: ProviderReport;
}

/**
 * Identidade de um fornecedor, independente do resultado do pedido. Existe para
 * que um fornecedor que falhou antes sequer de responder possa ainda ser
 * identificado pelo nome na interface — caso contrário o relatório de erro não
 * diria ao utilizador *qual* dos serviços falhou.
 */
export interface ProviderIdentity {
  id: string;
  name: string;
  role: string;
  endpoint: string;
  license: string;
  attribution: string;
}

export interface FetchContext {
  timeoutMs: number;
  forecastDays: number;
  signal?: AbortSignal;
}

/**
 * Interface de um fornecedor de marés.
 *
 * O MVP implementa-a sobre o Open-Meteo Marine. Se for necessário trocar para
 * um fornecedor dedicado (com chave de API e cobertura diferente), basta
 * criar outra implementação desta interface e devolvê-la a partir de
 * `getTideProvider()` em `openmeteo-tide.ts`. Nada mais na aplicação precisa
 * de mudar.
 */
export interface TideProvider {
  readonly id: string;
  readonly name: string;
  readonly attribution: string;
  readonly license: string;
  fetchTides(
    coordinates: readonly Coordinates[],
    context: FetchContext,
  ): Promise<ProviderResult<TideHour>>;
}

/** Identificadores estáveis dos fornecedores, usados em relatórios e testes. */
export const PROVIDER_IDS = {
  marine: "open-meteo-marine",
  weather: "open-meteo-weather",
  tide: "open-meteo-tide",
  demo: "demo-local",
} as const;
