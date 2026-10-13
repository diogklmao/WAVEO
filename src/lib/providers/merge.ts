/**
 * WAVEO — alinhamento das séries dos vários fornecedores.
 *
 * Os fornecedores são independentes e podem cobrir intervalos ligeiramente
 * diferentes, ou ter horas em falta. Esta função constrói a união dos
 * instantes presentes em qualquer das séries e preenche cada campo com o valor
 * disponível — ou `null`, se genuinamente não existir.
 *
 * Um campo a `null` significa "não sabemos" e é tratado como tal em todo o
 * resto da aplicação. Nunca preenchemos lacunas com zero, com o valor da hora
 * anterior, nem com médias: qualquer dessas opções produziria uma previsão que
 * não existe.
 */

import { clamp } from "../geo";
import type { HourlyForecast } from "../types";
import type { MarineHour, TideHour, WeatherHour } from "./types";

export function mergeHours(
  marine: readonly MarineHour[],
  weather: readonly WeatherHour[],
  tide: readonly TideHour[],
): HourlyForecast[] {
  const marineByTime = new Map(marine.map((h) => [h.epochMs, h]));
  const weatherByTime = new Map(weather.map((h) => [h.epochMs, h]));
  const tideByTime = new Map(tide.map((h) => [h.epochMs, h]));

  const instants = new Set<number>();
  for (const h of marine) instants.add(h.epochMs);
  for (const h of weather) instants.add(h.epochMs);
  for (const h of tide) instants.add(h.epochMs);

  const sorted = [...instants].sort((a, b) => a - b);

  return sorted.map((epochMs) => {
    const m = marineByTime.get(epochMs);
    const w = weatherByTime.get(epochMs);
    const t = tideByTime.get(epochMs);

    const swellHeight = m?.swellHeight ?? null;
    const windWaveHeight = m?.windWaveHeight ?? null;
    const waveHeight = m?.waveHeight ?? null;

    return {
      // A hora de parede vem de qualquer série que tenha o instante; a maré
      // é a única que pode existir sem a marinha, pelo que a incluímos.
      time: m?.time ?? w?.time ?? t?.time ?? "",
      epochMs,

      waveHeight,
      wavePeriod: m?.wavePeriod ?? null,
      waveDirection: m?.waveDirection ?? null,
      swellHeight,
      swellPeriod: m?.swellPeriod ?? null,
      swellDirection: m?.swellDirection ?? null,
      secondarySwellHeight: m?.secondarySwellHeight ?? null,
      secondarySwellPeriod: m?.secondarySwellPeriod ?? null,
      secondarySwellDirection: m?.secondarySwellDirection ?? null,
      windWaveHeight,
      windWavePeriod: m?.windWavePeriod ?? null,
      windWaveDirection: m?.windWaveDirection ?? null,
      seaSurfaceTemperature: m?.seaSurfaceTemperature ?? null,
      seaLevelHeight: t?.seaLevelHeight ?? null,

      windSpeed: w?.windSpeed ?? null,
      windGust: w?.windGust ?? null,
      windDirection: w?.windDirection ?? null,
      airTemperature: w?.airTemperature ?? null,
      apparentTemperature: w?.apparentTemperature ?? null,
      precipitation: w?.precipitation ?? null,
      cloudCover: w?.cloudCover ?? null,
      weatherCode: w?.weatherCode ?? null,
      isDay: w?.isDay ?? null,

      swellEnergyShare: computeSwellEnergyShare(swellHeight, windWaveHeight, waveHeight),
    };
  });
}

/**
 * Fração da altura total atribuível ao swell. É um indicador qualitativo da
 * organização do mar, não um cálculo espectral: compara alturas, não energias.
 */
function computeSwellEnergyShare(
  swellHeight: number | null,
  windWaveHeight: number | null,
  _waveHeight: number | null,
): number | null {
  if (swellHeight === null || windWaveHeight === null) return null;
  const total = swellHeight + windWaveHeight;
  if (total <= 0.05) return null;
  return clamp(swellHeight / total, 0, 1);
}

/** Estatísticas rápidas de cobertura, usadas nos relatórios de proveniência. */
export function coverageReport(hours: readonly HourlyForecast[]): {
  total: number;
  withMarine: number;
  withWeather: number;
  withTide: number;
} {
  let withMarine = 0;
  let withWeather = 0;
  let withTide = 0;

  for (const hour of hours) {
    if (hour.waveHeight !== null) withMarine += 1;
    if (hour.windSpeed !== null) withWeather += 1;
    if (hour.seaLevelHeight !== null) withTide += 1;
  }

  return { total: hours.length, withMarine, withWeather, withTide };
}
