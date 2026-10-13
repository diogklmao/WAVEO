/**
 * WAVEO — camada de orquestração da previsão.
 *
 * Responsabilidades:
 *
 *  1. Pedir todos os spots numa só chamada a cada fornecedor. Como o
 *     Open-Meteo aceita vários pontos por pedido, obter seis spots custa o
 *     mesmo que obter um — o que mantém o consumo muito abaixo do limite do
 *     plano gratuito.
 *  2. Guardar o resultado em cache e partilhar pedidos concorrentes.
 *  3. Se um fornecedor falhar, servir a última versão conhecida (marcada como
 *     desatualizada) em vez de deixar o utilizador sem nada.
 *  4. Se todos falharem e os dados de demonstração estiverem ativos, gerar
 *     dados sintéticos claramente identificados.
 *
 * A pontuação é recalculada em cada pedido, a partir das horas em cache. Isto
 * garante que "agora" está sempre correto, mesmo quando os dados têm alguns
 * minutos, sem custo relevante: pontuar 6 spots × 168 horas é uma operação
 * trivial em memória.
 */

import { configuredForecastDays, configuredTimeoutMs, configuredTtlMs, demoDataEnabled, TtlCache } from "./cache";
import { SPOTS, getSpotBySlug } from "./spots";
import { buildDailySummaries } from "./surf/daily";
import { currentEntry, evaluateHours, type ScoredHour } from "./surf/evaluate";
import { findBestHour, findBestWindow } from "./surf/windows";
import { buildTideSeries, tideStateAt, upcomingExtremes, type TideSeries } from "./surf/tides";
import type {
  DataMode,
  DataSourceInfo,
  HourlyForecast,
  ProviderReport,
  SpotForecast,
  SpotSummary,
  SurfScore,
  SurfSpot,
  SurfWindow,
} from "./types";
import { generateDemoHours } from "./providers/demo";
import { mergeHours } from "./providers/merge";
import { fetchMarine, marineIdentity } from "./providers/openmeteo-marine";
import { getTideProvider, tideIdentity } from "./providers/openmeteo-tide";
import { fetchWeather, weatherIdentity } from "./providers/openmeteo-weather";
import {
  PROVIDER_IDS,
  type Coordinates,
  type ProviderIdentity,
} from "./providers/types";

/* =============================================================================
   Estruturas internas
   ============================================================================= */

interface SpotBundleEntry {
  spot: SurfSpot;
  hours: HourlyForecast[];
}

interface ForecastBundle {
  entries: SpotBundleEntry[];
  reports: ProviderReport[];
  unavailable: string[];
  notes: string[];
  mode: DataMode;
  fetchedAt: number;
  fetchedAtIso: string;
}

const bundleCache = new TtlCache<ForecastBundle>(8);

/* =============================================================================
   API pública
   ============================================================================= */

/** Previsão completa de um spot, pronta a apresentar. */
export async function getSpotForecast(
  slug: string,
  nowMs: number = Date.now(),
): Promise<SpotForecast | null> {
  const spot = getSpotBySlug(slug);
  if (!spot) return null;

  const bundle = await getForecastBundle();
  const entry = bundle.entries.find((e) => e.spot.id === spot.id);
  if (!entry) return null;

  return assembleSpotForecast(entry, bundle, nowMs);
}

/**
 * Resumos de todos os spots. Usado pelo mapa, pela lista de spots e pela
 * comparação, para que todos mostrem exatamente a mesma pontuação.
 */
export async function getAllSpotSummaries(
  nowMs: number = Date.now(),
): Promise<{ summaries: SpotSummary[]; source: DataSourceInfo }> {
  const bundle = await getForecastBundle();
  const summaries = bundle.entries.map((entry) =>
    assembleSpotSummary(entry, bundle, nowMs),
  );
  return {
    summaries,
    source: buildSourceInfo(bundle, bundle.entries[0]),
  };
}

/** Lista de slugs disponíveis, para rotas estáticas. */
export function availableSpotSlugs(): string[] {
  return SPOTS.map((s) => s.slug);
}

/** Limpa a cache de previsão. Usado em testes e em desenvolvimento. */
export function clearForecastCache(): void {
  bundleCache.clear();
}

/* =============================================================================
   Construção do pacote de dados
   ============================================================================= */

async function getForecastBundle(): Promise<ForecastBundle> {
  const forecastDays = configuredForecastDays();
  const key = `bundle:v1:${forecastDays}`;

  const cached = bundleCache.get(key);
  if (cached) return cached;

  try {
    const fresh = await bundleCache.resolve(key, configuredTtlMs(), () =>
      buildBundle(forecastDays),
    );
    return fresh;
  } catch (error) {
    // O fornecedor falhou. Se tivermos uma versão recente em cache,
    // servimo-la marcada como desatualizada — é mais útil do que um erro.
    const stale = bundleCache.getStale(key);
    if (stale) {
      return {
        ...stale.value,
        // Um pacote de demonstração continua a ser demonstração: rebaixá-lo a
        // "parcial" faria desaparecer o aviso que impede estes valores de
        // serem lidos como previsão real.
        mode: stale.value.mode === "demo" ? "demo" : "parcial",
        notes: stalenessNotes(stale.value),
      };
    }
    throw error;
  }
}

async function buildBundle(forecastDays: number): Promise<ForecastBundle> {
  const coordinates: Coordinates[] = SPOTS.map((spot) => ({
    lat: spot.lat,
    lon: spot.lon,
  }));

  const context = {
    timeoutMs: configuredTimeoutMs(),
    forecastDays,
  };

  const [marineResult, weatherResult, tideResult] = await Promise.allSettled([
    fetchMarine(coordinates, context),
    fetchWeather(coordinates, context),
    getTideProvider().fetchTides(coordinates, context),
  ]);

  const reports: ProviderReport[] = [];
  const marine = settled(marineResult, reports, marineIdentity());
  const weather = settled(weatherResult, reports, weatherIdentity());
  const tide = settled(tideResult, reports, tideIdentity());

  const marineOk = marine.series.some((s) => s.hours.length > 0);
  const weatherOk = weather.series.some((s) => s.hours.length > 0);

  // Nenhum fornecedor essencial respondeu: ou usamos demonstração, ou falhamos.
  if (!marineOk && !weatherOk) {
    if (demoDataEnabled()) {
      return buildDemoBundle(forecastDays, reports);
    }
    throw new Error(
      "Não foi possível obter dados de nenhum fornecedor. Verifique a ligação à Internet ou ative os dados de demonstração com WAVEO_ENABLE_DEMO_DATA=true.",
    );
  }

  const entries: SpotBundleEntry[] = SPOTS.map((spot, index) => ({
    spot,
    hours: mergeHours(
      marine.series[index]?.hours ?? [],
      weather.series[index]?.hours ?? [],
      tide.series[index]?.hours ?? [],
    ),
  }));

  const unavailable = collectUnavailable(reports);
  const mode: DataMode =
    marineOk && weatherOk && unavailable.length === 0 ? "real" : "parcial";

  return {
    entries,
    reports,
    unavailable,
    notes: buildNotes({ mode, marineOk, weatherOk, tideOk: tide.series.some((s) => s.hours.length > 0) }),
    mode,
    fetchedAt: Date.now(),
    fetchedAtIso: new Date().toISOString(),
  };
}

function buildDemoBundle(
  forecastDays: number,
  providerReports: readonly ProviderReport[],
): ForecastBundle {
  const now = Date.now();
  return {
    entries: SPOTS.map((spot) => ({
      spot,
      hours: generateDemoHours(spot, { nowMs: now, forecastDays }),
    })),
    reports: [
      ...providerReports,
      {
        id: PROVIDER_IDS.demo,
        name: "Dados de demonstração (WAVEO)",
        role: "Séries sintéticas geradas localmente para pré-visualização da interface",
        endpoint: "local",
        license: "N/A — dados gerados",
        attribution: "Valores gerados por WAVEO. Não são previsões.",
        status: "ok",
        message:
          "Nenhum fornecedor real respondeu. Estão a ser apresentados dados de demonstração, que não descrevem o mar real.",
      },
    ],
    unavailable: [],
    notes: [
      "Os fornecedores de dados não responderam. Estes valores são gerados localmente para demonstrar a interface e não são previsões.",
      "Para desativar os dados de demonstração, defina WAVEO_ENABLE_DEMO_DATA=false.",
    ],
    mode: "demo",
    fetchedAt: now,
    fetchedAtIso: new Date(now).toISOString(),
  };
}

/**
 * Converte um resultado de `Promise.allSettled` no relatório correspondente.
 *
 * A identidade do fornecedor é passada explicitamente porque uma promessa
 * rejeitada não traz consigo relatório nenhum: sem isto, o utilizador veria um
 * erro atribuído a um "Fornecedor" sem nome, sem saber qual dos serviços
 * falhou.
 */
function settled<T>(
  result: PromiseSettledResult<{ series: { hours: T[] }[]; report: ProviderReport }>,
  reports: ProviderReport[],
  identity: ProviderIdentity,
): { series: { hours: T[] }[] } {
  if (result.status === "fulfilled") {
    reports.push(result.value.report);
    return { series: result.value.series };
  }
  const message =
    result.reason instanceof Error ? result.reason.message : String(result.reason);
  reports.push({
    ...identity,
    status: "erro",
    message,
  });
  return { series: [] };
}

/* =============================================================================
   Montagem por spot
   ============================================================================= */

function assembleSpotForecast(
  entry: SpotBundleEntry,
  bundle: ForecastBundle,
  nowMs: number,
): SpotForecast {
  const { spot, hours } = entry;
  const tideSeries = buildTideSeries(hours);
  const scored = evaluateHours(spot, hours, tideSeries);
  const current = currentEntry(scored, nowMs);

  const bestWindow = findBestWindow(scored, nowMs);
  const bestWindow24h = findBestWindow(scored, nowMs, { horizonHours: 24 });

  return {
    spot,
    hours,
    scored,
    current: current?.hour ?? null,
    score: current?.score ?? unavailableScore(),
    tide: current?.tide ?? tideStateAt(tideSeries, nowMs),
    tideExtremes: upcomingExtremes(tideSeries, nowMs),
    bestWindow,
    bestWindow24h,
    daily: buildDailySummaries(spot, scored, nowMs),
    source: buildSourceInfo(bundle, entry),
  };
}

function assembleSpotSummary(
  entry: SpotBundleEntry,
  bundle: ForecastBundle,
  nowMs: number,
): SpotSummary {
  const { spot, hours } = entry;
  const tideSeries = buildTideSeries(hours);
  const scored = evaluateHours(spot, hours, tideSeries);
  const current = currentEntry(scored, nowMs);

  return {
    spot,
    current: current?.hour ?? null,
    score: current?.score ?? unavailableScore(),
    tide: current?.tide ?? tideStateAt(tideSeries, nowMs),
    bestWindow: findBestWindow(scored, nowMs),
    daily: buildDailySummaries(spot, scored, nowMs),
    source: buildSourceInfo(bundle, entry),
  };
}

/** Pontuação vazia, usada quando não há sequer uma hora para avaliar. */
export function unavailableScore(): SurfScore {
  return {
    value: 0,
    band: "indisponivel",
    label: "Sem dados",
    confidence: 0,
    factors: [],
    summary:
      "Não foi possível obter dados para este spot. Isto não significa que as condições sejam más — significa que não sabemos.",
    biggestLimiter: null,
    biggestStrength: null,
    provisional: true,
  };
}

/* =============================================================================
   Proveniência
   ============================================================================= */

function buildSourceInfo(
  bundle: ForecastBundle,
  entry: SpotBundleEntry | undefined,
): DataSourceInfo {
  const isDemo = bundle.mode === "demo";
  const hours = entry?.hours ?? [];
  const first = hours[0];
  const last = hours[hours.length - 1];

  const unavailable = [...bundle.unavailable];
  if (hours.length > 0 && !hours.some((h) => h.seaLevelHeight !== null)) {
    unavailable.push("Maré");
  }

  const notes = [...bundle.notes];
  if (isDemo) {
    notes.unshift(
      "DADOS DE DEMONSTRAÇÃO: estes valores foram gerados localmente e não são previsões reais.",
    );
  }

  return {
    mode: isDemo ? "demo" : bundle.mode,
    fetchedAt: bundle.fetchedAtIso,
    fetchedAtEpochMs: bundle.fetchedAt,
    forecastStart: first ? first.time : null,
    forecastEnd: last ? last.time : null,
    timezone: "Europe/Lisbon",
    providers: bundle.reports,
    modelRunAvailable: false,
    notes,
    unavailable: dedupe(unavailable),
    stale: Date.now() - bundle.fetchedAt > configuredTtlMs(),
  };
}

function buildNotes(context: {
  mode: DataMode;
  marineOk: boolean;
  weatherOk: boolean;
  tideOk: boolean;
}): string[] {
  const notes: string[] = [
    "O Open-Meteo não expõe o ciclo de execução do modelo na API pública. É apresentada a hora em que os dados foram obtidos, em vez de uma hora de execução que não podemos verificar.",
  ];
  if (!context.marineOk) {
    notes.push(
      "Não foi possível obter a previsão marítima. Sem altura e período de onda não há pontuação de surf.",
    );
  }
  if (!context.weatherOk) {
    notes.push(
      "Não foi possível obter a previsão meteorológica. O vento não entra na pontuação e a confiança é reduzida.",
    );
  }
  if (!context.tideOk) {
    notes.push(
      "Não foi possível obter a altura do nível do mar. A maré é apresentada como indisponível e não entra na pontuação.",
    );
  }
  return notes;
}

function stalenessNotes(bundle: ForecastBundle): string[] {
  return [
    ...bundle.notes,
    "Os fornecedores estão inacessíveis neste momento. Estão a ser apresentados os últimos dados obtidos, que podem já não refletir as condições atuais.",
  ];
}

/** Nomes em PT-PT para as variáveis que os fornecedores não devolveram. */
const VARIABLE_LABELS: Record<string, string> = {
  wave_height: "Altura de onda",
  wave_period: "Período da onda",
  wave_direction: "Direção da onda",
  swell_wave_height: "Altura do swell",
  swell_wave_period: "Período do swell",
  swell_wave_direction: "Direção do swell",
  secondary_swell_wave_height: "Swell secundário",
  secondary_swell_wave_period: "Período do swell secundário",
  secondary_swell_wave_direction: "Direção do swell secundário",
  wind_wave_height: "Onda de vento",
  wind_wave_period: "Período da onda de vento",
  wind_wave_direction: "Direção da onda de vento",
  sea_surface_temperature: "Temperatura da água",
  sea_level_height_msl: "Maré",
  wind_speed_10m: "Vento",
  wind_gusts_10m: "Rajadas",
  wind_direction_10m: "Direção do vento",
  temperature_2m: "Temperatura do ar",
  apparent_temperature: "Temperatura aparente",
  precipitation: "Precipitação",
  cloud_cover: "Nebulosidade",
  weather_code: "Estado do tempo",
  is_day: "Indicador dia/noite",
};

function collectUnavailable(reports: readonly ProviderReport[]): string[] {
  const labels: string[] = [];
  for (const report of reports) {
    for (const variable of report.missingVariables ?? []) {
      labels.push(VARIABLE_LABELS[variable] ?? variable);
    }
  }
  return dedupe(labels);
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/* =============================================================================
   Reexportações convenientes
   ============================================================================= */

export { findBestHour };
export type { ScoredHour, TideSeries, SurfWindow };
