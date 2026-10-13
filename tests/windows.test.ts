/**
 * Deteção da melhor janela para surfar.
 *
 * O comportamento mais importante a fixar não é encontrar a janela óbvia, mas
 * o que acontece quando não há nenhuma: a função devolve `null` e a interface
 * diz que não há janela, em vez de apresentar a menos má como recomendação.
 */

import { describe, expect, it } from "vitest";
import { findBestHour, findBestWindow } from "@/lib/surf/windows";
import { HOUR_MS, makeScored, pt } from "./helpers";
import type { ScoredHour } from "@/lib/types";

const NOW = pt("2026-10-13T06:00");

/** Série avaliada a partir de `NOW`, com uma pontuação por hora. */
function series(values: readonly (number | null)[]): ScoredHour[] {
  return values.map((value, index) =>
    value === null
      ? makeScored(NOW + index * HOUR_MS, 0, "indisponivel")
      : makeScored(NOW + index * HOUR_MS, value),
  );
}

describe("findBestWindow", () => {
  it("encontra o troço contínuo de horas boas", () => {
    const window = findBestWindow(series([3, 3, 3, 8, 8, 8, 8, 3, 3]), NOW);
    expect(window).not.toBeNull();
    expect(window!.startEpochMs).toBe(NOW + 3 * HOUR_MS);
    expect(window!.hours).toBe(4);
    expect(window!.averageScore).toBeCloseTo(8, 6);
    expect(window!.peakScore).toBeCloseTo(8, 6);
    expect(window!.band).toBe("bom");
  });

  it("a hora final é exclusiva: uma janela 07h–09h são 2 horas", () => {
    const window = findBestWindow(series([8, 8, 2, 2]), NOW);
    expect(window!.hours).toBe(2);
    expect(window!.endEpochMs).toBe(NOW + 2 * HOUR_MS);
  });

  it("devolve null quando nenhuma hora atinge o mínimo", () => {
    expect(findBestWindow(series([4, 5, 5.5, 4, 3]), NOW)).toBeNull();
  });

  it("devolve null quando o troço bom é mais curto do que o mínimo", () => {
    // Uma única hora boa isolada não é uma janela.
    expect(findBestWindow(series([3, 3, 9, 3, 3]), NOW)).toBeNull();
  });

  it("não junta horas separadas por uma interrupção", () => {
    // 8, 8, [falha], 8, 8 -> dois troços de 2 horas, não um de 4.
    const window = findBestWindow(series([8, 8, 3, 8, 8]), NOW, { minScore: 6.5 });
    expect(window!.hours).toBe(2);
  });

  it("não deixa um buraco nos dados criar uma janela inexistente", () => {
    const withGap = [
      makeScored(NOW, 9),
      makeScored(NOW + HOUR_MS, 9),
      makeScored(NOW + 5 * HOUR_MS, 9),
      makeScored(NOW + 6 * HOUR_MS, 9),
    ];
    const window = findBestWindow(withGap, NOW);
    expect(window).not.toBeNull();
    expect(window!.hours).toBe(2);
  });

  it("trata as horas sem pontuação como interrupção, nunca como favoráveis", () => {
    const window = findBestWindow(series([8, 8, null, null, 8, 8]), NOW);
    expect(window!.hours).toBe(2);
    expect(window!.averageScore).toBeCloseTo(8, 6);
  });

  it("recorta um troço longo demais para o máximo reportado", () => {
    const values = [2, 2, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 2, 2];
    const window = findBestWindow(series(values), NOW, { maxHours: 4 });
    expect(window!.hours).toBe(4);
    expect(window!.averageScore).toBeCloseTo(9, 6);
  });

  it("prefere o troço de melhor média, mesmo que não seja o primeiro", () => {
    const window = findBestWindow(series([7, 7, 7, 3, 3, 9.5, 9.5]), NOW);
    expect(window!.startEpochMs).toBe(NOW + 5 * HOUR_MS);
    expect(window!.averageScore).toBeCloseTo(9.5, 6);
  });

  it("ignora horas fora do horizonte de procura", () => {
    const values = [3, 3, 3, 9, 9, 9];
    // Com um horizonte de 3 horas, as horas boas ficam de fora.
    expect(findBestWindow(series(values), NOW, { horizonHours: 3 })).toBeNull();
  });

  it("ignora horas anteriores a agora", () => {
    const past = [
      makeScored(NOW - 3 * HOUR_MS, 9),
      makeScored(NOW - 2 * HOUR_MS, 9),
      makeScored(NOW - 1 * HOUR_MS, 9),
    ];
    expect(findBestWindow(past, NOW)).toBeNull();
  });

  it("produz um cabeçalho legível em PT-PT", () => {
    const window = findBestWindow(series([8, 8, 8]), NOW);
    expect(window!.headline).toContain("Hoje");
    expect(window!.headline).toContain("h");
  });

  it("devolve null para uma série vazia", () => {
    expect(findBestWindow([], NOW)).toBeNull();
  });
});

describe("findBestHour", () => {
  it("devolve a melhor hora mesmo abaixo do mínimo de janela", () => {
    const best = findBestHour(series([3, 6, 4]), NOW);
    expect(best).not.toBeNull();
    expect(best!.score.value).toBe(6);
  });

  it("nunca devolve uma hora sem dados", () => {
    const mixed = [
      makeScored(NOW, 0, "indisponivel"),
      makeScored(NOW + HOUR_MS, 4),
    ];
    const best = findBestHour(mixed, NOW);
    expect(best!.score.value).toBe(4);
  });

  it("devolve null quando só há horas sem dados", () => {
    expect(findBestHour([makeScored(NOW, 0, "indisponivel")], NOW)).toBeNull();
  });

  it("respeita o horizonte", () => {
    const best = findBestHour(series([3, 3, 3, 9]), NOW, 2);
    expect(best!.score.value).toBe(3);
  });
});
