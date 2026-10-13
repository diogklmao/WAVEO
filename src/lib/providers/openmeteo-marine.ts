/**
 * WAVEO — fornecedor de previsão marinha (Open-Meteo Marine).
 *
 * Documentação: https://open-meteo.com/en/docs/marine-weather-api
 * Licença dos dados: CC BY 4.0 — atribuição obrigatória.
 *
 * Notas de integração relevantes:
 *
 *  - A API aceita vários pontos numa só chamada (`latitude=41.1,41.2`), o que
 *    permite obter todos os spots com um único pedido. Isto mantém o consumo
 *    muito abaixo do limite do plano gratuito (10 000 pedidos/dia).
 *  - Pedimos `timezone=Europe/Lisbon`, pelo que as horas devolvidas são horas
 *    locais de Portugal sem indicador de fuso.
 *  - `cell_selection=sea` evita que o modelo escolha um ponto de grelha em
 *    terra quando as coordenadas estão junto à costa — o que, de outra forma,
 *    devolveria valores nulos.
 *  - Se a API rejeitar o conjunto completo de variáveis, degradamos
 *    progressivamente para conjuntos menores, em vez de falhar por completo.
 *    As variáveis em falta são detetadas a partir da resposta real e
 *    reportadas; o motor de pontuação exclui os fatores correspondentes.
 *
 * A altura do nível do mar (maré) NÃO é pedida aqui: tem o seu próprio
 * fornecedor (`openmeteo-tide.ts`), para que uma indisponibilidade da maré não
 * afete a previsão de ondas.
 */

import { portugalWallClockToEpoch } from "../time";
import type { ProviderReport } from "../types";
import { fetchJson, ProviderError, toNullableNumber } from "./http";
import {
  PROVIDER_IDS,
  type Coordinates,
  type FetchContext,
  type LocationSeries,
  type MarineHour,
  type ProviderIdentity,
  type ProviderResult,
} from "./types";

const DEFAULT_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";
const PROVIDER_ID = PROVIDER_IDS.marine;
const PROVIDER_NAME = "Open-Meteo Marine";
const ATTRIBUTION = "Dados marinhos: Open-Meteo (CC BY 4.0)";
const LICENSE = "CC BY 4.0";
const ROLE = "Ondas, swell, onda de vento e temperatura da superfície do mar";

/** Nome da variável na API -> campo normalizado. */
const COLUMN_TO_FIELD: Record<string, keyof Omit<MarineHour, "time" | "epochMs">> = {
  wave_height: "waveHeight",
  wave_period: "wavePeriod",
  wave_direction: "waveDirection",
  swell_wave_height: "swellHeight",
  swell_wave_period: "swellPeriod",
  swell_wave_direction: "swellDirection",
  secondary_swell_wave_height: "secondarySwellHeight",
  secondary_swell_wave_period: "secondarySwellPeriod",
  secondary_swell_wave_direction: "secondarySwellDirection",
  wind_wave_height: "windWaveHeight",
  wind_wave_period: "windWavePeriod",
  wind_wave_direction: "windWaveDirection",
  sea_surface_temperature: "seaSurfaceTemperature",
};

/**
 * Conjuntos de variáveis, do mais completo para o mais reduzido. Cada nível só
 * é tentado se o anterior for rejeitado pelo fornecedor.
 */
const VARIABLE_TIERS: readonly {
  id: string;
  variables: readonly string[];
}[] = [
  {
    id: "completo",
    variables: Object.keys(COLUMN_TO_FIELD),
  },
  {
    id: "essencial",
    variables: [
      "wave_height",
      "wave_period",
      "wave_direction",
      "swell_wave_height",
      "swell_wave_period",
      "swell_wave_direction",
      "sea_surface_temperature",
    ],
  },
  {
    id: "minimo",
    variables: ["wave_height", "wave_period", "wave_direction"],
  },
];

/** Sem estas três variáveis não há pontuação possível. */
const REQUIRED_VARIABLES = new Set(["wave_height", "wave_period", "wave_direction"]);

interface OpenMeteoMarineResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  hourly?: Record<string, unknown>;
  reason?: string;
}

function baseUrl(): string {
  const raw = process.env.OPEN_METEO_MARINE_BASE_URL;
  return raw && raw.trim() !== "" ? raw.trim() : DEFAULT_BASE_URL;
}

export function buildMarineUrl(
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
    cell_selection: "sea",
  });
  return `${baseUrl()}?${params.toString()}`;
}

export async function fetchMarine(
  coordinates: readonly Coordinates[],
  context: FetchContext,
): Promise<ProviderResult<MarineHour>> {
  if (coordinates.length === 0) {
    return { series: [], report: report("desativado", "Nenhum ponto foi pedido.") };
  }

  const startedAt = Date.now();
  let lastError: ProviderError | null = null;
  let degradedFrom: string | null = null;

  for (const tier of VARIABLE_TIERS) {
    const url = buildMarineUrl(coordinates, tier.variables, context.forecastDays);
    try {
      const payload = await fetchJson<
        OpenMeteoMarineResponse | OpenMeteoMarineResponse[]
      >(url, {
        providerId: PROVIDER_ID,
        timeoutMs: context.timeoutMs,
        signal: context.signal,
      });

      const entries = Array.isArray(payload) ? payload : [payload];
      const series = entries.map((entry, index) => normaliseLocation(entry, index));

      if (tier.id !== "completo") degradedFrom = tier.id;

      const { missing, essentialMissing } = detectMissingVariables(series, tier.variables);

      return {
        series,
        report: {
          ...marineIdentity(),
          status: missing.length > 0 ? "parcial" : "ok",
          message: buildMessage(tier.id, missing, degradedFrom, essentialMissing),
          durationMs: Date.now() - startedAt,
          missingVariables: missing.length > 0 ? missing : undefined,
        },
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        throw error;
      }
      lastError = error;
      // Só tentamos um conjunto mais pequeno quando o problema pode ser
      // uma variável indisponível. Falhas de rede repetem-se inutilmente.
      const worthRetryingSmaller =
        error.code === "fora_de_cobertura" || error.code === "resposta_invalida";
      if (!worthRetryingSmaller) break;
    }
  }

  return {
    series: [],
    report: report(
      "erro",
      lastError?.message ?? "Não foi possível obter a previsão marítima para este ponto.",
      Date.now() - startedAt,
    ),
  };
}

function normaliseLocation(
  entry: OpenMeteoMarineResponse,
  index: number,
): LocationSeries<MarineHour> {
  const hourly = entry.hourly ?? {};
  const times = Array.isArray(hourly.time) ? (hourly.time as unknown[]) : [];

  const columns: Record<string, unknown[]> = {};
  for (const variable of Object.keys(COLUMN_TO_FIELD)) {
    const raw = hourly[variable];
    columns[variable] = Array.isArray(raw) ? raw : [];
  }

  const hours: MarineHour[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const rawTime = times[i];
    if (typeof rawTime !== "string") continue;
    const epochMs = portugalWallClockToEpoch(rawTime);
    if (!Number.isFinite(epochMs)) continue;

    const hour: MarineHour = {
      time: rawTime,
      epochMs,
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
    };

    for (const [variable, field] of Object.entries(COLUMN_TO_FIELD)) {
      hour[field] = toNullableNumber(columns[variable]?.[i]);
    }

    hours.push(hour);
  }

  return {
    index,
    latitude: toNullableNumber(entry.latitude),
    longitude: toNullableNumber(entry.longitude),
    hours,
  };
}

/**
 * Deteta variáveis que não trouxeram um único valor utilizável.
 *
 * A distinção entre "não foi pedida" e "foi pedida mas não veio" é o que
 * permite dizer ao utilizador exatamente o que falta, em vez de assumir.
 */
function detectMissingVariables(
  series: readonly LocationSeries<MarineHour>[],
  requested: readonly string[],
): { missing: string[]; essentialMissing: string[] } {
  const missing: string[] = [];

  for (const variable of requested) {
    const field = COLUMN_TO_FIELD[variable];
    if (!field) continue;
    const hasAnyValue = series.some((location) =>
      location.hours.some((hour) => hour[field] !== null),
    );
    if (!hasAnyValue) missing.push(variable);
  }

  return {
    missing,
    essentialMissing: missing.filter((v) => REQUIRED_VARIABLES.has(v)),
  };
}

function buildMessage(
  tierId: string,
  missing: readonly string[],
  degradedFrom: string | null,
  essentialMissing: readonly string[] = [],
): string {
  if (missing.length === 0) {
    return tierId === "completo"
      ? "Conjunto completo de variáveis marinhas obtido."
      : "Previsão marítima obtida com um conjunto reduzido de variáveis.";
  }
  const degraded = degradedFrom
    ? ` O fornecedor rejeitou o conjunto completo e foi usado o conjunto "${degradedFrom}".`
    : "";
  const critical =
    essentialMissing.length > 0
      ? ` Sem ${essentialMissing.join(", ")} não é possível calcular a pontuação principal.`
      : "";
  return `Variáveis sem dados: ${missing.join(", ")}. Os fatores correspondentes foram excluídos da pontuação.${critical}${degraded}`;
}

export function marineIdentity(): ProviderIdentity {
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
    ...marineIdentity(),
    status,
    message,
    durationMs,
  };
}
