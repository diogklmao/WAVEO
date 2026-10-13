/**
 * WAVEO — fornecedor de marés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO ATUAL E LIMITAÇÕES
 * ─────────────────────────────────────────────────────────────────────────────
 * O MVP obtém a altura do nível do mar a partir da variável
 * `sea_level_height_msl` da API Marine do Open-Meteo. Esta escolha tem
 * vantagens claras: não exige chave de API, cobre a costa portuguesa e cobre
 * o mesmo horizonte temporal da previsão de ondas, o que evita desalinhamentos
 * entre a série de maré e a série de ondas.
 *
 * Tem também uma limitação que é importante assumir: não é um modelo
 * astronómico de marés dedicado. Os valores servem para saber se a maré está a
 * subir ou a descer e onde se situa entre a baixa-mar e a preia-mar — que é o
 * que o motor de pontuação precisa — mas não devem ser usados para navegação,
 * para calcular a altura exata da água num porto, nem para decidir se se passa
 * num canal com pouca profundidade.
 *
 * Se a variável não estiver disponível para um ponto, a série é devolvida
 * vazia e a interface mostra "maré indisponível". Não estimamos marés a partir
 * de outras variáveis, nem usamos um modelo harmónico caseiro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO SUBSTITUIR POR UM FORNECEDOR DEDICADO
 * ─────────────────────────────────────────────────────────────────────────────
 * Basta criar um novo objeto que implemente `TideProvider` (ver
 * `providers/types.ts`) e devolvê-lo em `getTideProvider()`. O motor de
 * pontuação, a API e a interface não precisam de qualquer alteração, porque
 * todos consomem o tipo normalizado `TideHour`.
 */

import { portugalWallClockToEpoch } from "../time";
import type { ProviderReport } from "../types";
import { fetchJson, ProviderError, toNullableNumber } from "./http";
import {
  PROVIDER_IDS,
  type Coordinates,
  type FetchContext,
  type LocationSeries,
  type ProviderIdentity,
  type ProviderResult,
  type TideHour,
  type TideProvider,
} from "./types";

const DEFAULT_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";
const PROVIDER_ID = PROVIDER_IDS.tide;
const PROVIDER_NAME = "Open-Meteo Marine (nível do mar)";
const ATTRIBUTION = "Nível do mar: Open-Meteo Marine (CC BY 4.0)";
const LICENSE = "CC BY 4.0";
const ROLE = "Altura do nível do mar para determinação da maré";

/** Variável de que dependemos. Se falhar, não há maré — e dizemo-lo. */
const TIDE_VARIABLE = "sea_level_height_msl";

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  hourly?: Record<string, unknown>;
  reason?: string;
}

function baseUrl(): string {
  const raw = process.env.OPEN_METEO_MARINE_BASE_URL;
  return raw && raw.trim() !== "" ? raw.trim() : DEFAULT_BASE_URL;
}

export function buildTideUrl(
  coordinates: readonly Coordinates[],
  forecastDays: number,
): string {
  const params = new URLSearchParams({
    latitude: coordinates.map((c) => c.lat.toFixed(4)).join(","),
    longitude: coordinates.map((c) => c.lon.toFixed(4)).join(","),
    hourly: TIDE_VARIABLE,
    timezone: "Europe/Lisbon",
    forecast_days: String(Math.min(16, Math.max(1, forecastDays))),
    cell_selection: "sea",
  });
  return `${baseUrl()}?${params.toString()}`;
}

class OpenMeteoTideProvider implements TideProvider {
  readonly id = PROVIDER_ID;
  readonly name = PROVIDER_NAME;
  readonly attribution = ATTRIBUTION;
  readonly license = LICENSE;

  async fetchTides(
    coordinates: readonly Coordinates[],
    context: FetchContext,
  ): Promise<ProviderResult<TideHour>> {
    if (coordinates.length === 0) {
      return { series: [], report: this.report("desativado", "Nenhum ponto foi pedido.") };
    }

    const startedAt = Date.now();

    try {
      const payload = await fetchJson<OpenMeteoResponse | OpenMeteoResponse[]>(
        buildTideUrl(coordinates, context.forecastDays),
        {
          providerId: PROVIDER_ID,
          timeoutMs: context.timeoutMs,
          signal: context.signal,
          // A maré é um extra: se falhar, o resto da aplicação continua a
          // funcionar. Não gastamos tentativas adicionais com ela.
          retries: 0,
        },
      );

      const entries = Array.isArray(payload) ? payload : [payload];
      const series = entries.map((entry, index) => this.normalise(entry, index));
      const hasAnyData = series.some((location) =>
        location.hours.some((hour) => hour.seaLevelHeight !== null),
      );

      return {
        series,
        report: this.report(
          hasAnyData ? "ok" : "parcial",
          hasAnyData
            ? "Nível do mar obtido. A maré é derivada desta série por deteção de extremos."
            : "O fornecedor respondeu mas não devolveu valores de nível do mar para este ponto.",
          Date.now() - startedAt,
        ),
      };
    } catch (error) {
      const message =
        error instanceof ProviderError
          ? error.message
          : "Não foi possível obter dados de maré.";
      return {
        series: [],
        report: this.report("erro", message, Date.now() - startedAt),
      };
    }
  }

  private normalise(entry: OpenMeteoResponse, index: number): LocationSeries<TideHour> {
    const hourly = entry.hourly ?? {};
    const times = Array.isArray(hourly.time) ? (hourly.time as unknown[]) : [];
    const levels = Array.isArray(hourly[TIDE_VARIABLE])
      ? (hourly[TIDE_VARIABLE] as unknown[])
      : [];

    const hours: TideHour[] = [];

    for (let i = 0; i < times.length; i += 1) {
      const rawTime = times[i];
      if (typeof rawTime !== "string") continue;
      const epochMs = portugalWallClockToEpoch(rawTime);
      if (!Number.isFinite(epochMs)) continue;

      hours.push({
        time: rawTime,
        epochMs,
        seaLevelHeight: toNullableNumber(levels[i]),
      });
    }

    return {
      index,
      latitude: toNullableNumber(entry.latitude),
      longitude: toNullableNumber(entry.longitude),
      hours,
    };
  }

  private report(
    status: ProviderReport["status"],
    message: string,
    durationMs?: number,
  ): ProviderReport {
    return {
      ...tideIdentity(),
      status,
      message,
      durationMs,
    };
  }
}

/**
 * Identidade do fornecedor de marés, disponível mesmo quando o pedido falha
 * antes de haver resposta.
 */
export function tideIdentity(): ProviderIdentity {
  return {
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    role: ROLE,
    endpoint: baseUrl(),
    license: LICENSE,
    attribution: ATTRIBUTION,
  };
}

let instance: TideProvider | null = null;

/**
 * Devolve o fornecedor de marés ativo.
 * Ponto único de substituição: trocar a implementação devolvida aqui é
 * suficiente para mudar de fornecedor em toda a aplicação.
 */
export function getTideProvider(): TideProvider {
  if (!instance) instance = new OpenMeteoTideProvider();
  return instance;
}

export const tideVariable = TIDE_VARIABLE;
