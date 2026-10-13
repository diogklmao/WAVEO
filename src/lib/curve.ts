/**
 * WAVEO — interpolação por troços.
 *
 * O motor de pontuação exprime cada fator como uma curva definida por pontos
 * (valor observado → pontuação). Esta abordagem foi escolhida deliberadamente
 * em vez de fórmulas fechadas: as curvas são legíveis, discutíveis e fáceis de
 * ajustar sem reescrever código.
 */

import { clamp } from "./geo";

/** Um ponto da curva: `[valor observado, pontuação]`. */
export type CurvePoint = readonly [number, number];

export interface PiecewiseOptions {
  /**
   * Suaviza a transição entre pontos com uma função smoothstep, evitando
   * descontinuidades na derivada que fariam a pontuação "saltar".
   */
  smooth?: boolean;
}

/**
 * Interpola linearmente `x` sobre os pontos fornecidos.
 * Fora do intervalo, devolve a pontuação do ponto extremo mais próximo.
 *
 * Os pontos devem estar ordenados por valor observado crescente; pontos
 * fora de ordem são ignorados defensivamente.
 */
export function piecewise(
  x: number,
  points: readonly CurvePoint[],
  options: PiecewiseOptions = {},
): number {
  if (!Number.isFinite(x) || points.length === 0) return 0;

  const sorted = normalizePoints(points);
  const first = sorted[0]!;
  if (x <= first[0]) return first[1];

  const last = sorted[sorted.length - 1]!;
  if (x >= last[0]) return last[1];

  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    if (x <= b[0]) {
      const span = b[0] - a[0];
      if (span <= 0) return b[1];
      let t = (x - a[0]) / span;
      if (options.smooth) t = t * t * (3 - 2 * t);
      return a[1] + t * (b[1] - a[1]);
    }
  }

  return last[1];
}

/** Igual a `piecewise`, mas com o resultado limitado ao intervalo 0–10. */
export function piecewiseScore(
  x: number,
  points: readonly CurvePoint[],
  options: PiecewiseOptions = {},
): number {
  return clamp(piecewise(x, points, options), 0, 10);
}

function normalizePoints(points: readonly CurvePoint[]): readonly CurvePoint[] {
  let ordered = true;
  for (let i = 1; i < points.length; i += 1) {
    if ((points[i]?.[0] ?? 0) < (points[i - 1]?.[0] ?? 0)) {
      ordered = false;
      break;
    }
  }
  if (ordered) return points;
  return [...points].sort((a, b) => a[0] - b[0]);
}
