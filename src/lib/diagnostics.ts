/**
 * WAVEO — diagnóstico dos fornecedores.
 *
 * Executa os mesmos pedidos que a aplicação faz em produção, mas devolve
 * informação sobre a cobertura obtida em vez de previsões. Serve para
 * responder a "o que é que o fornecedor devolveu realmente para esta costa?",
 * que é a primeira pergunta a fazer quando uma variável aparece como
 * indisponível na interface.
 */

import { configuredForecastDays, configuredTimeoutMs } from "./cache";
import { mergeHours, coverageReport } from "./providers/merge";
import { fetchMarine, marineIdentity } from "./providers/openmeteo-marine";
import { getTideProvider, tideIdentity } from "./providers/openmeteo-tide";
import { fetchWeather, weatherIdentity } from "./providers/openmeteo-weather";
import type { LocationSeries, ProviderIdentity } from "./providers/types";
import type { ProviderReport } from "./types";
import { SPOTS } from "./spots";

export interface SpotDiagnostics {
  slug: string;
  name: string;
  coordinates: { lat: number; lon: number };
  modelCoordinates: { lat: number | null; lon: number | null };
  coverage: ReturnType<typeof coverageReport>;
  sample: {
    time: string | null;
    waveHeight: number | null;
    wavePeriod: number | null;
    swellHeight: number | null;
    swellPeriod: number | null;
    seaSurfaceTemperature: number | null;
    seaLevelHeight: number | null;
    windSpeed: number | null;
    windDirection: number | null;
  } | null;
}

export interface Diagnostics {
  checkedAt: string;
  durationMs: number;
  providers: ProviderReport[];
  spots: SpotDiagnostics[];
}

export async function getForecastBundleDiagnostics(): Promise<Diagnostics> {
  const startedAt = Date.now();
  const coordinates = SPOTS.map((spot) => ({ lat: spot.lat, lon: spot.lon }));
  const context = {
    timeoutMs: configuredTimeoutMs(),
    forecastDays: configuredForecastDays(),
  };

  const [marineResult, weatherResult, tideResult] = await Promise.allSettled([
    fetchMarine(coordinates, context),
    fetchWeather(coordinates, context),
    getTideProvider().fetchTides(coordinates, context),
  ]);

  const providers: ProviderReport[] = [];

  const marine = collect(marineResult, providers, marineIdentity());
  const weather = collect(weatherResult, providers, weatherIdentity());
  const tide = collect(tideResult, providers, tideIdentity());

  const marineSeries = marine.series;
  const weatherSeries = weather.series;
  const tideSeries = tide.series;

  const spots: SpotDiagnostics[] = SPOTS.map((spot, index) => {
    const hours = mergeHours(
      marineSeries[index]?.hours ?? [],
      weatherSeries[index]?.hours ?? [],
      tideSeries[index]?.hours ?? [],
    );
    const first = hours[0];

    return {
      slug: spot.slug,
      name: spot.name,
      coordinates: { lat: spot.lat, lon: spot.lon },
      modelCoordinates: {
        lat: marineSeries[index]?.latitude ?? null,
        lon: marineSeries[index]?.longitude ?? null,
      },
      coverage: coverageReport(hours),
      sample: first
        ? {
            time: first.time,
            waveHeight: first.waveHeight,
            wavePeriod: first.wavePeriod,
            swellHeight: first.swellHeight,
            swellPeriod: first.swellPeriod,
            seaSurfaceTemperature: first.seaSurfaceTemperature,
            seaLevelHeight: first.seaLevelHeight,
            windSpeed: first.windSpeed,
            windDirection: first.windDirection,
          }
        : null,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    providers,
    spots,
  };
}

/**
 * Acrescenta o relatório do fornecedor à lista e devolve a série obtida.
 *
 * A identidade é passada à parte porque uma promessa rejeitada não traz
 * relatório: sem ela, um fornecedor em baixo apareceria no diagnóstico como um
 * erro anónimo, quando o objetivo desta página é precisamente identificar qual
 * dos serviços falhou.
 */
function collect<T>(
  result: PromiseSettledResult<{ series: LocationSeries<T>[]; report: ProviderReport }>,
  providers: ProviderReport[],
  identity: ProviderIdentity,
): { series: LocationSeries<T>[] } {
  if (result.status === "fulfilled") {
    providers.push(result.value.report);
    return { series: result.value.series };
  }
  providers.push({
    ...identity,
    status: "erro",
    message: result.reason instanceof Error ? result.reason.message : String(result.reason),
  });
  return { series: [] };
}
