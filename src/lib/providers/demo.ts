/**
 * WAVEO — dados de demonstração.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO É, E O QUE NÃO É
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo gera séries sintéticas com um aspeto plausível, para que a
 * interface possa ser vista e avaliada sem ligação à Internet.
 *
 * NÃO SÃO PREVISÕES. Não vêm de nenhum modelo, não descrevem o mar real e não
 * devem ser usadas para decidir se se vai surfar. Sempre que estes dados são
 * usados, a aplicação:
 *
 *  - marca `DataSourceInfo.mode` como `"demo"`;
 *  - apresenta uma faixa de aviso destacada em todas as páginas;
 *  - identifica a origem como "Dados de demonstração" no rodapé de cada
 *    cartão de condições.
 *
 * O gerador é determinístico: a mesma hora e o mesmo spot produzem sempre os
 * mesmos valores, para que a interface não "salte" entre recarregamentos.
 *
 * Só é usado quando todos os fornecedores reais falham, e pode ser desativado
 * por completo com `WAVEO_ENABLE_DEMO_DATA=false`.
 */

import { clamp } from "../geo";
import { portugalWallClockToEpoch, toPortugalIso } from "../time";
import type { HourlyForecast, SurfSpot } from "../types";

const HOUR_MS = 3_600_000;

/* =============================================================================
   Aleatoriedade determinística
   ============================================================================= */

/** PRNG rápido e determinístico (mulberry32). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Soma de senos com fases semeadas — uma aproximação suave e estável. */
function wobble(
  hours: number,
  components: readonly { period: number; amplitude: number; phase: number }[],
): number {
  let total = 0;
  for (const { period, amplitude, phase } of components) {
    total += amplitude * Math.sin((2 * Math.PI * hours) / period + phase);
  }
  return total;
}

/* =============================================================================
   Geração
   ============================================================================= */

export interface DemoOptions {
  /** Instante de referência. A série começa na hora cheia anterior. */
  nowMs: number;
  /** Número de dias a gerar. */
  forecastDays: number;
}

/**
 * Gera uma série horária sintética para um spot.
 * Os valores são construídos de forma a respeitarem as relações físicas
 * básicas — período acompanha altura, vento marítimo acompanha mar mexido —
 * para que a interface e o motor de pontuação sejam exercitados de forma
 * realista.
 */
export function generateDemoHours(
  spot: SurfSpot,
  options: DemoOptions,
): HourlyForecast[] {
  const { nowMs, forecastDays } = options;
  const seed = hashString(`${spot.id}:${toPortugalIso(nowMs, false)}`);
  const random = mulberry32(seed);

  const phases = {
    swell: random() * Math.PI * 2,
    period: random() * Math.PI * 2,
    direction: random() * Math.PI * 2,
    wind: random() * Math.PI * 2,
    tide: random() * Math.PI * 2,
  };

  const baseSwell = 0.6 + random() * 0.9;
  const swellAmplitude = 0.5 + random() * 1.1;
  const baseWind = 6 + random() * 10;

  const startEpoch = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const totalHours = forecastDays * 24;
  const hours: HourlyForecast[] = [];

  const dayOfYear = Math.floor(
    (startEpoch - Date.UTC(new Date(startEpoch).getUTCFullYear(), 0, 1)) / 86_400_000,
  );

  for (let i = 0; i < totalHours; i += 1) {
    const epochMs = startEpoch + i * HOUR_MS;
    const hourOfDay = Number(toPortugalIso(epochMs).slice(11, 13));

    // --- Ondulação -------------------------------------------------------
    // Um swell de fundo com um evento mais forte a cada ~4 dias.
    const eventPhase = (i / (24 * 3.7)) * Math.PI * 2 + phases.swell;
    const event = Math.max(0, Math.sin(eventPhase)) ** 1.6;
    const waveHeight = clamp(
      baseSwell +
        wobble(i, [
          { period: 29, amplitude: 0.22, phase: phases.swell },
          { period: 11, amplitude: 0.1, phase: phases.period },
        ]) +
        event * swellAmplitude,
      0.2,
      5.5,
    );

    // Período correlacionado com a altura, como acontece com swell real.
    const swellPeriod = clamp(
      6 + waveHeight * 2.6 + wobble(i, [{ period: 37, amplitude: 0.9, phase: phases.period }]),
      4,
      20,
    );

    // Direção a oscilar em torno da janela ideal do spot.
    const swellDirection =
      (spot.characteristics.swellWindow.center +
        wobble(i, [{ period: 53, amplitude: 26, phase: phases.direction }]) +
        360) %
      360;

    // --- Vento -----------------------------------------------------------
    // Padrão diurno: mais forte a meio da tarde, mais fraco de madrugada.
    const diurnal = Math.max(
      0,
      Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) * 0.9,
    );
    const windSpeed = clamp(
      baseWind +
        diurnal * 14 +
        wobble(i, [{ period: 17, amplitude: 3.2, phase: phases.wind }]) +
        (random() - 0.5) * 2,
      1,
      46,
    );
    const windGust = windSpeed + 4 + diurnal * 8 + Math.abs(random() - 0.5) * 4;

    // O vento tende para terral de madrugada e marítimo à tarde.
    const offshore = (spot.characteristics.beachOrientation + 180 + 360) % 360;
    const onshore = spot.characteristics.beachOrientation;
    const windDirection =
      (offshore + (onshore - offshore) * clamp(diurnal, 0, 1) +
        wobble(i, [{ period: 23, amplitude: 22, phase: phases.wind }]) +
        360) %
      360;

    // --- Temperaturas ----------------------------------------------------
    // Sazonalidade anual: mínimo em fevereiro, máximo em agosto.
    const seasonal = Math.cos(((dayOfYear - 210) / 365) * 2 * Math.PI);
    const seaSurfaceTemperature = clamp(17.2 + seasonal * 2.6, 13, 22);
    const airTemperature = clamp(
      seaSurfaceTemperature +
        3.5 +
        Math.sin(((hourOfDay - 15) / 24) * 2 * Math.PI) * 5 +
        (random() - 0.5),
      4,
      34,
    );

    // --- Maré ------------------------------------------------------------
    // Ciclo semidiurno (12,42 h) com modulação de marés vivas/mortas (~14,8 d).
    const tidePhase = (i / 12.42) * 2 * Math.PI + phases.tide;
    const springNeap = 1 + 0.35 * Math.sin((i / (24 * 14.77)) * 2 * Math.PI);
    const seaLevelHeight = Math.sin(tidePhase) * 1.35 * springNeap;

    // --- Componentes derivadas -------------------------------------------
    const windWaveHeight = clamp(waveHeight * (0.15 + windSpeed / 110), 0, waveHeight);
    const swellHeight = clamp(waveHeight - windWaveHeight * 0.6, 0.05, waveHeight);

    hours.push({
      time: toPortugalIso(epochMs),
      epochMs,
      waveHeight: round2(waveHeight),
      wavePeriod: round1(swellPeriod + 0.6),
      waveDirection: Math.round(swellDirection),
      swellHeight: round2(swellHeight),
      swellPeriod: round1(swellPeriod),
      swellDirection: Math.round(swellDirection),
      secondarySwellHeight: round2(swellHeight * (0.2 + random() * 0.25)),
      secondarySwellPeriod: round1(clamp(swellPeriod * 0.72, 4, 14)),
      secondarySwellDirection: Math.round((swellDirection + 35 + random() * 30) % 360),
      windWaveHeight: round2(windWaveHeight),
      windWavePeriod: round1(clamp(3 + windSpeed / 9, 2, 8)),
      windWaveDirection: Math.round(windDirection),
      seaSurfaceTemperature: round1(seaSurfaceTemperature),
      seaLevelHeight: round2(seaLevelHeight),
      windSpeed: round1(windSpeed),
      windGust: round1(windGust),
      windDirection: Math.round(windDirection),
      airTemperature: round1(airTemperature),
      apparentTemperature: round1(airTemperature - windSpeed * 0.06),
      precipitation: round1(random() < 0.18 ? random() * 3 : 0),
      cloudCover: Math.round(clamp(30 + wobble(i, [{ period: 19, amplitude: 40, phase: phases.wind }]), 0, 100)),
      weatherCode: 1,
      isDay: hourOfDay >= 7 && hourOfDay <= 19,
      swellEnergyShare:
        waveHeight > 0.05 ? clamp(swellHeight / waveHeight, 0, 1) : null,
    });
  }

  return hours;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Hora de parede de Portugal a partir de um instante (reexportado para testes). */
export const demoHelpers = { mulberry32, hashString, portugalWallClockToEpoch };
