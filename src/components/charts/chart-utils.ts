/**
 * WAVEO — utilitários de gráficos.
 *
 * Matemática pura, sem React: escalas, marcas de eixo, construção de caminhos e
 * deteção de fronteiras de dia. Manter isto separado dos componentes permite
 * testar a lógica de desenho sem renderizar nada.
 */

export interface ChartPoint {
  epochMs: number;
  value: number | null;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
  /** `area` preenche até à base; `line` apenas traça. */
  kind?: "area" | "line";
  dashed?: boolean;
  /** Séries secundárias (rajadas, por exemplo) desenham-se mais discretas. */
  subdued?: boolean;
}

/* =============================================================================
   Escalas
   ============================================================================= */

/** Escala linear de um domínio num intervalo. Domínio degenerado devolve o meio. */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const span = domainMax - domainMin;
  if (!Number.isFinite(span) || span === 0) {
    const mid = (rangeMin + rangeMax) / 2;
    return () => mid;
  }
  return (value: number) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

/** Arredonda um domínio para valores "redondos", com uma pequena folga. */
export function padDomain(
  min: number,
  max: number,
  padFraction = 0.08,
): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const delta = Math.abs(min) * 0.1 || 1;
    return [min - delta, max + delta];
  }
  const pad = (max - min) * padFraction;
  return [min - pad, max + pad];
}

/**
 * Marcas de eixo em valores legíveis (1, 2, 2,5, 5 ou 10 vezes uma potência de
 * dez). Evita etiquetas como "0,8333".
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const rawStep = (max - min) / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const stepMultiple =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  const step = stepMultiple * magnitude;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  // O limite superior evita ciclos infinitos com passos absurdamente pequenos.
  for (let v = first, guard = 0; v <= max + step * 1e-6 && guard < 64; v += step, guard += 1) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/* =============================================================================
   Caminhos
   ============================================================================= */

export interface PlottedPoint {
  x: number;
  y: number;
}

/**
 * Converte uma série em segmentos contínuos, quebrando nos valores em falta.
 * Um `null` significa "não sabemos", pelo que a linha tem de parar — nunca
 * interpolar através de um vazio, o que inventaria um valor plausível mas falso.
 */
export function segmentise(
  points: ChartPoint[],
  x: (epochMs: number, index: number) => number,
  y: (value: number) => number,
): PlottedPoint[][] {
  const segments: PlottedPoint[][] = [];
  let current: PlottedPoint[] = [];

  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: x(point.epochMs, index), y: y(point.value) });
  });

  if (current.length > 0) segments.push(current);
  return segments;
}

/**
 * Curva suave por Catmull-Rom convertida em Bézier cúbica. Os pontos de controlo
 * são limitados ao intervalo vertical de cada par de extremos, para evitar as
 * oscilações que fariam a altura de onda parecer negativa entre dois pontos.
 */
export function smoothPath(points: PlottedPoint[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  if (points.length === 2) {
    const second = points[1];
    if (!second) return "";
    return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} L ${second.x.toFixed(2)} ${second.y.toFixed(2)}`;
  }

  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];
    if (!p0 || !p1 || !p2 || !p3) continue;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampBetween(p1.y + (p2.y - p0.y) / 6, p1.y, p2.y);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampBetween(p2.y - (p3.y - p1.y) / 6, p1.y, p2.y);

    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export function clampBetween(value: number, a: number, b: number): number {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return Math.min(high, Math.max(low, value));
}

/** Fecha um caminho até uma linha de base, para preencher uma área. */
export function closeToBaseline(path: string, points: PlottedPoint[], baselineY: number): string {
  const last = points[points.length - 1];
  const first = points[0];
  if (!path || !last || !first) return "";
  return `${path} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

/* =============================================================================
   Eixo temporal
   ============================================================================= */

/** Índices onde começa um novo dia em Portugal, para separadores verticais. */
export function dayBoundaryIndices(epochs: number[], dayKey: (epochMs: number) => string): number[] {
  const indices: number[] = [];
  let previous: string | null = null;
  epochs.forEach((epochMs, index) => {
    const key = dayKey(epochMs);
    if (previous !== null && key !== previous) indices.push(index);
    previous = key;
  });
  return indices;
}

/**
 * Escolhe até `max` índices distribuídos uniformemente, incluindo o primeiro e
 * o último, para as etiquetas do eixo horizontal.
 */
export function labelIndices(count: number, max = 6): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  const indices = new Set<number>();
  for (let i = 0; i < max; i += 1) indices.add(Math.round(i * step));
  return [...indices].sort((a, b) => a - b);
}

/** Índice do ponto mais próximo de um instante, assumindo espaçamento regular. */
export function indexNearestTo(epochs: number[], target: number): number | null {
  if (epochs.length === 0) return null;
  const first = epochs[0];
  const last = epochs[epochs.length - 1];
  if (first === undefined || last === undefined) return null;
  if (target <= first) return 0;
  if (target >= last) return epochs.length - 1;

  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  epochs.forEach((epochMs, index) => {
    const distance = Math.abs(epochMs - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** Índice do primeiro ponto a partir do qual `predicate` é verdadeiro. */
export function firstIndexWhere(
  epochs: number[],
  predicate: (epochMs: number, index: number) => boolean,
): number | null {
  for (let i = 0; i < epochs.length; i += 1) {
    const epochMs = epochs[i];
    if (epochMs !== undefined && predicate(epochMs, i)) return i;
  }
  return null;
}

/** Notação compacta para valores num eixo: 1,2 · 12 · 120. */
export function compactAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100) return String(Math.round(value));
  if (abs >= 10) return value.toFixed(abs % 1 === 0 ? 0 : 1).replace(".", ",");
  if (abs === 0) return "0";
  return value.toFixed(1).replace(".", ",");
}
