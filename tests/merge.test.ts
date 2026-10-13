/**
 * Alinhamento das séries dos fornecedores.
 *
 * A regra crítica: uma lacuna é preenchida com `null`, nunca com zero, com o
 * valor da hora anterior nem com uma média. Qualquer dessas alternativas
 * produziria uma previsão que nenhum fornecedor fez.
 */

import { describe, expect, it } from "vitest";
import { coverageReport, mergeHours } from "@/lib/providers/merge";
import type { MarineHour, TideHour, WeatherHour } from "@/lib/providers/types";
import { HOUR_MS, pt } from "./helpers";

const T0 = pt("2026-10-13T06:00");

function marine(index: number, overrides: Partial<MarineHour> = {}): MarineHour {
  return {
    time: `2026-10-13T${String(6 + index).padStart(2, "0")}:00`,
    epochMs: T0 + index * HOUR_MS,
    waveHeight: 1.2,
    wavePeriod: 10,
    waveDirection: 295,
    swellHeight: 1.0,
    swellPeriod: 11,
    swellDirection: 295,
    secondarySwellHeight: 0.3,
    secondarySwellPeriod: 8,
    secondarySwellDirection: 320,
    windWaveHeight: 0.2,
    windWavePeriod: 5,
    windWaveDirection: 100,
    seaSurfaceTemperature: 16,
    ...overrides,
  };
}

function weather(index: number, overrides: Partial<WeatherHour> = {}): WeatherHour {
  return {
    time: `2026-10-13T${String(6 + index).padStart(2, "0")}:00`,
    epochMs: T0 + index * HOUR_MS,
    windSpeed: 12,
    windGust: 18,
    windDirection: 90,
    airTemperature: 17,
    apparentTemperature: 16,
    precipitation: 0,
    cloudCover: 40,
    weatherCode: 2,
    isDay: true,
    ...overrides,
  };
}

function tide(index: number, height: number | null = 2): TideHour {
  return {
    time: `2026-10-13T${String(6 + index).padStart(2, "0")}:00`,
    epochMs: T0 + index * HOUR_MS,
    seaLevelHeight: height,
  };
}

describe("mergeHours", () => {
  it("combina os campos das três séries na mesma hora", () => {
    const merged = mergeHours([marine(0)], [weather(0)], [tide(0)]);
    expect(merged).toHaveLength(1);

    const hour = merged[0]!;
    expect(hour.epochMs).toBe(T0);
    expect(hour.waveHeight).toBe(1.2);
    expect(hour.swellPeriod).toBe(11);
    expect(hour.seaSurfaceTemperature).toBe(16);
    expect(hour.windSpeed).toBe(12);
    expect(hour.windDirection).toBe(90);
    expect(hour.airTemperature).toBe(17);
    expect(hour.seaLevelHeight).toBe(2);
  });

  it("constrói a união dos instantes e ordena-os", () => {
    const merged = mergeHours(
      [marine(2), marine(0)],
      [weather(1)],
      [tide(3)],
    );
    expect(merged.map((h) => h.epochMs)).toEqual([
      T0,
      T0 + HOUR_MS,
      T0 + 2 * HOUR_MS,
      T0 + 3 * HOUR_MS,
    ]);
  });

  it("deixa a null os campos de um fornecedor que não cobriu aquela hora", () => {
    const merged = mergeHours([marine(0)], [], []);
    const hour = merged[0]!;
    expect(hour.waveHeight).toBe(1.2);
    // Sem meteorologia, o vento é desconhecido — não é calmo.
    expect(hour.windSpeed).toBeNull();
    expect(hour.windGust).toBeNull();
    expect(hour.windDirection).toBeNull();
    expect(hour.airTemperature).toBeNull();
    expect(hour.isDay).toBeNull();
    // Sem série de maré, o nível do mar é desconhecido.
    expect(hour.seaLevelHeight).toBeNull();
  });

  it("nunca preenche uma lacuna com zero nem com o valor da hora anterior", () => {
    const merged = mergeHours(
      [marine(0), marine(1, { waveHeight: null })],
      [weather(0), weather(1, { windSpeed: null })],
      [tide(0, 1.8), tide(1, null)],
    );

    expect(merged).toHaveLength(2);
    expect(merged[1]!.waveHeight).toBeNull();
    expect(merged[1]!.windSpeed).toBeNull();
    expect(merged[1]!.seaLevelHeight).toBeNull();
    // E não herdou os valores da hora anterior.
    expect(merged[1]!.waveHeight).not.toBe(merged[0]!.waveHeight);
  });

  it("mantém uma hora que só existe na série de maré", () => {
    const merged = mergeHours([], [], [tide(0)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.seaLevelHeight).toBe(2);
    expect(merged[0]!.waveHeight).toBeNull();
    expect(merged[0]!.time).toBe("2026-10-13T06:00");
  });

  it("calcula a fração de swell quando as duas componentes existem", () => {
    const merged = mergeHours(
      [marine(0, { swellHeight: 1.5, windWaveHeight: 0.5 })],
      [],
      [],
    );
    expect(merged[0]!.swellEnergyShare).toBeCloseTo(0.75, 10);
  });

  it("devolve null na fração de swell quando falta uma componente", () => {
    const noWindWave = mergeHours([marine(0, { windWaveHeight: null })], [], []);
    expect(noWindWave[0]!.swellEnergyShare).toBeNull();

    const noSwell = mergeHours([marine(0, { swellHeight: null })], [], []);
    expect(noSwell[0]!.swellEnergyShare).toBeNull();
  });

  it("devolve null na fração de swell quando o mar é praticamente plano", () => {
    const flat = mergeHours(
      [marine(0, { swellHeight: 0, windWaveHeight: 0 })],
      [],
      [],
    );
    expect(flat[0]!.swellEnergyShare).toBeNull();
  });

  it("devolve uma lista vazia quando não há séries nenhumas", () => {
    expect(mergeHours([], [], [])).toEqual([]);
  });
});

describe("coverageReport", () => {
  it("conta quantas horas têm cada tipo de dado", () => {
    const merged = mergeHours(
      [marine(0), marine(1), marine(2, { waveHeight: null })],
      [weather(0), weather(1)],
      [tide(0)],
    );
    const report = coverageReport(merged);
    expect(report.total).toBe(3);
    expect(report.withMarine).toBe(2);
    expect(report.withWeather).toBe(2);
    expect(report.withTide).toBe(1);
  });

  it("é tudo zero para uma série vazia", () => {
    expect(coverageReport([])).toEqual({
      total: 0,
      withMarine: 0,
      withWeather: 0,
      withTide: 0,
    });
  });
});
