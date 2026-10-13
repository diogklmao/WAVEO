/**
 * Interpolação por troços. É a peça de que todos os fatores do Surf Score
 * dependem, pelo que os casos-limite (fora do intervalo, pontos desordenados,
 * entradas inválidas) são testados explicitamente.
 */

import { describe, expect, it } from "vitest";
import { piecewise, piecewiseScore, type CurvePoint } from "@/lib/curve";

const LINE: CurvePoint[] = [
  [0, 0],
  [10, 10],
];

const PLATEAU: CurvePoint[] = [
  [0, 0],
  [5, 10],
  [10, 10],
];

describe("piecewise", () => {
  it("interpola linearmente entre dois pontos", () => {
    expect(piecewise(5, LINE)).toBeCloseTo(5, 10);
    expect(piecewise(2.5, LINE)).toBeCloseTo(2.5, 10);
    expect(piecewise(7.5, LINE)).toBeCloseTo(7.5, 10);
  });

  it("devolve a pontuação do extremo fora do intervalo, sem extrapolar", () => {
    expect(piecewise(-100, LINE)).toBe(0);
    expect(piecewise(100, LINE)).toBe(10);
  });

  it("respeita um patamar horizontal", () => {
    expect(piecewise(7.5, PLATEAU)).toBe(10);
    expect(piecewise(2.5, PLATEAU)).toBeCloseTo(5, 10);
  });

  it("ordena pontos desordenados em vez de produzir lixo", () => {
    const shuffled: CurvePoint[] = [
      [10, 10],
      [0, 0],
      [5, 5],
    ];
    expect(piecewise(5, shuffled)).toBeCloseTo(5, 10);
    expect(piecewise(2.5, shuffled)).toBeCloseTo(2.5, 10);
  });

  it("devolve 0 sem pontos ou com um valor não finito", () => {
    expect(piecewise(5, [])).toBe(0);
    expect(piecewise(Number.NaN, LINE)).toBe(0);
    expect(piecewise(Number.POSITIVE_INFINITY, LINE)).toBe(10);
  });

  it("com um único ponto devolve sempre a pontuação desse ponto", () => {
    const single: CurvePoint[] = [[7, 4]];
    expect(piecewise(0, single)).toBe(4);
    expect(piecewise(100, single)).toBe(4);
  });

  it("não salta com valores de x fracionários", () => {
    let previous = -Infinity;
    for (let x = 0; x <= 10; x += 0.1) {
      const value = piecewise(x, LINE);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });
});

describe("piecewise com suavização", () => {
  it("preserva os extremos da curva", () => {
    expect(piecewise(0, LINE, { smooth: true })).toBe(0);
    expect(piecewise(10, LINE, { smooth: true })).toBe(10);
  });

  it("mantém o ponto médio no meio (smoothstep(0,5) = 0,5)", () => {
    expect(piecewise(5, LINE, { smooth: true })).toBeCloseTo(5, 10);
  });

  it("continua monótona entre pontos", () => {
    let previous = -Infinity;
    for (let x = 0; x <= 10; x += 0.05) {
      const value = piecewise(x, LINE, { smooth: true });
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it("achata a derivada junto aos extremos, que é o objetivo da suavização", () => {
    const nearStart = piecewise(0.5, LINE, { smooth: true });
    const linear = piecewise(0.5, LINE);
    expect(nearStart).toBeLessThan(linear);
  });
});

describe("piecewiseScore", () => {
  it("limita o resultado ao intervalo 0–10", () => {
    const runaway: CurvePoint[] = [
      [0, -50],
      [10, 50],
    ];
    expect(piecewiseScore(10, runaway)).toBe(10);
    expect(piecewiseScore(0, runaway)).toBe(0);
    expect(piecewiseScore(5, runaway)).toBeCloseTo(0, 10);
  });

  it("nunca devolve um valor negativo nem acima de 10", () => {
    const values = [-10, -1, 0, 3, 7, 10, 11, 100];
    for (const value of values) {
      const score = piecewiseScore(value, PLATEAU);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    }
  });
});
