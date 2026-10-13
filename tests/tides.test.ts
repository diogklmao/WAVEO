/**
 * Análise de marés.
 *
 * A série de teste é uma onda semidiurna perfeita (período de 12 h, para que
 * os extremos caiam exatamente em horas cheias). Assim os valores esperados
 * são calculáveis à mão, e qualquer erro na deteção de extremos, na
 * alternação ou no nível normalizado aparece como uma falha concreta em vez de
 * uma diferença de vírgula flutuante.
 */

import { describe, expect, it } from "vitest";
import {
  buildTideSeries,
  extremesByDay,
  tidalAmplitude,
  tideStateAt,
  upcomingExtremes,
} from "@/lib/surf/tides";
import { HOUR_MS, hourlySeries, pt } from "./helpers";

const BASE = pt("2026-10-13T00:00");

/** Altura do nível do mar: senoide de amplitude 1 m e período de 12 h. */
function sineHeight(index: number): number {
  return Math.sin((2 * Math.PI * index) / 12);
}

/** 73 amostras horárias (3 dias) de uma maré semidiurna limpa. */
function sineSeries() {
  return buildTideSeries(hourlySeries(BASE, 73, (index) => ({ seaLevelHeight: sineHeight(index) })));
}

describe("buildTideSeries com dados", () => {
  const series = sineSeries();

  it("marca a série como disponível", () => {
    expect(series.available).toBe(true);
    expect(series.reason).toBeUndefined();
    expect(series.sampleCount).toBe(73);
  });

  it("deteta os extremos nas horas certas", () => {
    // Máximos em t = 3, 15, 27, ... e mínimos em t = 9, 21, 33, ... — ou seja,
    // um extremo a cada 6 horas, alternando: 12 extremos em 72 horas.
    expect(series.extremes.length).toBe(12);
    expect(series.extremes[0]!.type).toBe("cheia");
    expect(series.extremes[0]!.epochMs).toBe(BASE + 3 * HOUR_MS);
    expect(series.extremes[0]!.height).toBeCloseTo(1, 6);
    expect(series.extremes[1]!.type).toBe("baixa");
    expect(series.extremes[1]!.epochMs).toBe(BASE + 9 * HOUR_MS);
    expect(series.extremes[1]!.height).toBeCloseTo(-1, 6);
  });

  it("alterna sempre entre preia-mar e baixa-mar", () => {
    for (let i = 1; i < series.extremes.length; i += 1) {
      expect(series.extremes[i]!.type).not.toBe(series.extremes[i - 1]!.type);
    }
  });

  it("mantém os extremos a cerca de meio ciclo de distância", () => {
    for (let i = 1; i < series.extremes.length; i += 1) {
      const hours = (series.extremes[i]!.epochMs - series.extremes[i - 1]!.epochMs) / HOUR_MS;
      expect(hours).toBeGreaterThan(5);
      expect(hours).toBeLessThan(7.5);
    }
  });

  it("a amplitude da série é a esperada", () => {
    expect(series.range!.min).toBeCloseTo(-1, 6);
    expect(series.range!.max).toBeCloseTo(1, 6);
    expect(tidalAmplitude(series)).toBeCloseTo(2, 6);
  });

  it("num extremo a maré está estagnada e o nível é 1 ou 0", () => {
    const high = series.sampleAt(BASE + 3 * HOUR_MS);
    expect(high.height).toBeCloseTo(1, 6);
    expect(high.normalizedLevel).toBeCloseTo(1, 6);
    expect(high.stage).toBe("estagnada");

    const low = series.sampleAt(BASE + 9 * HOUR_MS);
    expect(low.height).toBeCloseTo(-1, 6);
    expect(low.normalizedLevel).toBeCloseTo(0, 6);
    expect(low.stage).toBe("estagnada");
  });

  it("a caminho da baixa-mar o estágio é descida", () => {
    const sample = series.sampleAt(BASE + 6 * HOUR_MS);
    expect(sample.normalizedLevel).toBeCloseTo(0.5, 6);
    expect(sample.stage).toBe("descida");
  });

  it("a caminho da preia-mar o estágio é subida", () => {
    const sample = series.sampleAt(BASE + 12 * HOUR_MS);
    expect(sample.normalizedLevel).toBeCloseTo(0.5, 6);
    expect(sample.stage).toBe("subida");
  });

  it("interpola a altura entre amostras", () => {
    const mid = series.sampleAt(BASE + 1.5 * HOUR_MS);
    // Interpolação linear entre sin(30°) e sin(60°), não o seno a 45°.
    const expected = (Math.sin(Math.PI / 6) + Math.sin(Math.PI / 3)) / 2;
    expect(mid.height).toBeCloseTo(expected, 6);
  });
});

describe("buildTideSeries sem dados", () => {
  it("devolve uma série indisponível com motivo, em vez de estimar", () => {
    const series = buildTideSeries(hourlySeries(BASE, 48));
    expect(series.available).toBe(false);
    expect(series.reason).toBeTruthy();
    expect(series.extremes).toEqual([]);
    expect(series.range).toBeNull();
    expect(series.sampleCount).toBe(0);

    const sample = series.sampleAt(BASE);
    expect(sample.height).toBeNull();
    expect(sample.normalizedLevel).toBeNull();
    expect(sample.stage).toBeNull();
  });

  it("ignora amostras nulas em vez de as tratar como zero", () => {
    const hours = hourlySeries(BASE, 48, (index) =>
      index % 2 === 0 ? { seaLevelHeight: sineHeight(index) } : {},
    );
    const series = buildTideSeries(hours);
    expect(series.sampleCount).toBe(24);
    // Só as 24 amostras pares contam: a amplitude tem de vir delas, e não de
    // zeros introduzidos nas horas em falta.
    expect(series.range!.min).toBeCloseTo(-Math.sqrt(3) / 2, 6);
    expect(series.range!.max).toBeCloseTo(Math.sqrt(3) / 2, 6);
    expect(series.available).toBe(true);
  });

  it("com poucas amostras não inventa extremos mas continua a interpolar", () => {
    const hours = hourlySeries(BASE, 6, (index) => ({ seaLevelHeight: sineHeight(index) }));
    const series = buildTideSeries(hours);
    expect(series.available).toBe(true);
    expect(series.extremes).toEqual([]);
    expect(series.sampleAt(BASE + 3 * HOUR_MS).height).toBeCloseTo(1, 6);
  });
});

describe("tideStateAt", () => {
  const series = sineSeries();

  it("encontra a próxima preia-mar e a próxima baixa-mar", () => {
    const at = BASE + 4 * HOUR_MS;
    const state = tideStateAt(series, at);
    expect(state.available).toBe(true);
    expect(state.nextHigh!.epochMs).toBe(BASE + 15 * HOUR_MS);
    expect(state.nextLow!.epochMs).toBe(BASE + 9 * HOUR_MS);
  });

  it("devolve o estado indisponível com o motivo quando não há série", () => {
    const empty = buildTideSeries([]);
    const state = tideStateAt(empty, BASE);
    expect(state.available).toBe(false);
    expect(state.height).toBeNull();
    expect(state.nextHigh).toBeNull();
    expect(state.nextLow).toBeNull();
    expect(state.reason).toBeTruthy();
  });
});

describe("upcomingExtremes", () => {
  const series = sineSeries();

  it("devolve apenas extremos a partir do instante pedido", () => {
    const reference = BASE + 10 * HOUR_MS;
    const upcoming = upcomingExtremes(series, reference);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.length).toBeLessThanOrEqual(8);
    for (const extreme of upcoming) {
      expect(extreme.epochMs).toBeGreaterThanOrEqual(reference - HOUR_MS);
    }
  });

  it("devolve uma lista vazia quando a maré é indisponível", () => {
    expect(upcomingExtremes(buildTideSeries([]), BASE)).toEqual([]);
  });
});

describe("extremesByDay", () => {
  it("agrupa os extremos pelo dia local de Portugal", () => {
    const series = sineSeries();
    const byDay = extremesByDay(series.extremes);
    expect(byDay.size).toBe(3);
    for (const [key, list] of byDay) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(list.length).toBeGreaterThan(0);
    }
  });
});
