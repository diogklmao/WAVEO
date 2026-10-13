/**
 * WAVEO — fornecedor de previsão meteorológica (Open-Meteo Weather).
 *
 * Documentação: https://open-meteo.com/en/docs
 * Licença dos dados: CC BY 4.0 — atribuição obrigatória.
 *
 * Fornece o vento (que, a par da altura de onda, é o fator que mais decide se
 * vale a pena ir surfar), a temperatura do ar e a precipitação. Tal como no
 * fornecedor marinho, aceita vários pontos numa só chamada e devolve horas
 * locais de Portugal quando `timezone=Europe/Lisbon`.
 */

import { portugalWallClockToEpoch } from "../time";
import type { ProviderReport } from "../types";
import {
  fetchJson,
  ProviderError,
  toNullableBoolean,
  toNullableNumber,
} from "./http";
import {
  PROVIDER_IDS,
  type Coordinates,
  type FetchContext,
  type LocationSeries,
  type ProviderIdentity,
  type ProviderResult,
  type WeatherHour,
} from "./types";

const DEFAULT_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const PROVIDER_ID = PROVIDER_IDS.weather;
const PROVIDER_NAME = "Open-Meteo Weather";
const ATTRIBUTION = "Dados meteorológicos: Open-Meteo (CC BY 4.0)";
const LICENSE = "CC BY 4.0";
const ROLE = "Vento, rajadas, temperatura do ar e precipitação";

const FULL_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "cloud_cover",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "is_day",
] as const;

const TIERS: readonly { id: string; variables: readonly string[] }[] = [
  { id: "completo", variables: FULL_VARIABLES },
  {
    id: "essencial",
    variables: [
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "temperature_2m",
    ],
  },
  { id: "minimo", variables: ["wind_speed_10m", "wind_direction_10m"] },
];

/** Variáveis cuja ausência impede o cálculo da pontuação. */
const REQUIRED_VARIABLES = new Set(["wind_speed_10m", "wind_direction_10m"]);

interface OpenMeteoWeatherResponse {
  latitude?: number;
  longitude?: number;
  hourly?: Record<string, unknown>;
  reason?: string;
}

function baseUrl(): string {
  const raw = process.env.OPEN_METEO_WEATHER_BASE_URL;
  return raw && raw.trim() !== "" ? raw.trim() : DEFAULT_BASE_URL;
}

export function buildWeatherUrl(
  coordinates: readonly Coordinates[],
  variables: readonly string[],
  forecastDays: number,
): string {
  const params = new URLSearchParams({
    latitude: coordinates.map((c) => c.lat.toFixed(4)).join(","),
    longitude: coordinates.map((c) => c.lon.toFixed(4)).join(","),
    hourly: variables.join(","),
    timezone: "Europe/Lisbon",
    forecast_days: String(Math.min(16, Math.max(1, forecastDays))),
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  return `${baseUrl()}?${params.toString()}`;
}

export async function fetchWeather(
  coordinates: readonly Coordinates[],
  context: FetchContext,
): Promise<ProviderResult<WeatherHour>> {
  if (coordinates.length === 0) {
    return { series: [], report: report("desativado", "Nenhum ponto foi pedido.") };
  }

  const startedAt = Date.now();
  let lastError: ProviderError | null = null;

  for (const tier of TIERS) {
    const url = buildWeatherUrl(coordinates, tier.variables, context.forecastDays);
    try {
      const payload = await fetchJson<
        OpenMeteoWeatherResponse | OpenMeteoWeatherResponse[]
      >(url, {
        providerId: PROVIDER_ID,
        timeoutMs: context.timeoutMs,
        signal: context.signal,
      });

      const entries = Array.isArray(payload) ? payload : [payload];
      const series = entries.map((entry, index) => normaliseLocation(entry, index));
      const missing = detectMissing(series);
      const essentialMissing = missing.filter((v) => REQUIRED_VARIABLES.has(v));

      return {
        series,
        report: {
          ...weatherIdentity(),
          status: missing.length > 0 ? "parcial" : "ok",
          message: buildMessage(missing, essentialMissing),
          durationMs: Date.now() - startedAt,
          missingVariables: missing.length > 0 ? missing : undefined,
        },
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      lastError = error;
      const worthRetryingSmaller =
        error.code === "fora_de_cobertura" || error.code === "resposta_invalida";
      if (!worthRetryingSmaller) break;
    }
  }

  return {
    series: [],
    report: report(
      "erro",
      lastError?.message ??
        "Não foi possível obter a previsão meteorológica para este ponto.",
      Date.now() - startedAt,
    ),
  };
}

function normaliseLocation(
  entry: OpenMeteoWeatherResponse,
  index: number,
): LocationSeries<WeatherHour> {
  const hourly = entry.hourly ?? {};
  const times = Array.isArray(hourly.time) ? (hourly.time as unknown[]) : [];

  const column = (name: string): unknown[] => {
    const raw = hourly[name];
    return Array.isArray(raw) ? raw : [];
  };

  const windSpeed = column("wind_speed_10m");
  const windGust = column("wind_gusts_10m");
  const windDirection = column("wind_direction_10m");
  const airTemperature = column("temperature_2m");
  const apparentTemperature = column("apparent_temperature");
  const precipitation = column("precipitation");
  const cloudCover = column("cloud_cover");
  const weatherCode = column("weather_code");
  const isDay = column("is_day");

  const hours: WeatherHour[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const rawTime = times[i];
    if (typeof rawTime !== "string") continue;
    const epochMs = portugalWallClockToEpoch(rawTime);
    if (!Number.isFinite(epochMs)) continue;

    hours.push({
      time: rawTime,
      epochMs,
      windSpeed: toNullableNumber(windSpeed[i]),
      windGust: toNullableNumber(windGust[i]),
      windDirection: toNullableNumber(windDirection[i]),
      airTemperature: toNullableNumber(airTemperature[i]),
      apparentTemperature: toNullableNumber(apparentTemperature[i]),
      precipitation: toNullableNumber(precipitation[i]),
      cloudCover: toNullableNumber(cloudCover[i]),
      weatherCode: toNullableNumber(weatherCode[i]),
      isDay: toNullableBoolean(isDay[i]),
    });
  }

  return {
    index,
    latitude: toNullableNumber(entry.latitude),
    longitude: toNullableNumber(entry.longitude),
    hours,
  };
}

const MISSING_CHECKS: readonly { variable: string; field: keyof WeatherHour }[] = [
  { variable: "wind_speed_10m", field: "windSpeed" },
  { variable: "wind_direction_10m", field: "windDirection" },
  { variable: "wind_gusts_10m", field: "windGust" },
  { variable: "temperature_2m", field: "airTemperature" },
  { variable: "apparent_temperature", field: "apparentTemperature" },
  { variable: "precipitation", field: "precipitation" },
  { variable: "cloud_cover", field: "cloudCover" },
  { variable: "weather_code", field: "weatherCode" },
  { variable: "is_day", field: "isDay" },
];

function detectMissing(series: readonly LocationSeries<WeatherHour>[]): string[] {
  return MISSING_CHECKS.filter(
    ({ field }) =>
      !series.some((location) =>
        location.hours.some((hour) => hour[field] !== null),
      ),
  ).map(({ variable }) => variable);
}

function buildMessage(
  missing: readonly string[],
  essentialMissing: readonly string[],
): string {
  if (missing.length === 0) return "Dados meteorológicos obtidos.";
  const critical =
    essentialMissing.length > 0
      ? ` Sem ${essentialMissing.join(", ")} não é possível avaliar o vento, que é um dos fatores com mais peso.`
      : "";
  return `Variáveis sem dados: ${missing.join(", ")}. Os fatores correspondentes foram excluídos da pontuação.${critical}`;
}

export function weatherIdentity(): ProviderIdentity {
  return {
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    role: ROLE,
    endpoint: baseUrl(),
    license: LICENSE,
    attribution: ATTRIBUTION,
  };
}

function report(
  status: ProviderReport["status"],
  message: string,
  durationMs?: number,
): ProviderReport {
  return {
    ...weatherIdentity(),
    status,
    message,
    durationMs,
  };
}
