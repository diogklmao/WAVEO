/**
 * WAVEO — utilidades geográficas e angulares.
 *
 * Convenção: todas as direções são rumos meteorológicos em graus (0–360),
 * indicando DE ONDE o vento ou a ondulação vem.
 */

const COMPASS_ABBR = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSO",
  "SO",
  "OSO",
  "O",
  "ONO",
  "NO",
  "NNO",
] as const;

const COMPASS_FULL = [
  "Norte",
  "Nor-Nordeste",
  "Nordeste",
  "Lés-Nordeste",
  "Este",
  "Lés-Sueste",
  "Sudeste",
  "Sul-Sueste",
  "Sul",
  "Sul-Sudoeste",
  "Sudoeste",
  "Oés-Sudoeste",
  "Oeste",
  "Oés-Noroeste",
  "Noroeste",
  "Nor-Noroeste",
] as const;

/** Normaliza um rumo para o intervalo [0, 360). */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/**
 * Distância angular absoluta entre dois rumos, em graus (0–180).
 * É o caminho mais curto sobre a rosa dos ventos.
 */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Diferença angular com sinal entre dois rumos, em graus (-180, 180].
 * Positivo significa que `a` está no sentido horário de `b`.
 */
export function signedAngularDistance(a: number, b: number): number {
  const diff = ((normalizeDegrees(a) - normalizeDegrees(b) + 540) % 360) - 180;
  // O caso oposto é ambíguo (tanto faz ir por um lado como pelo outro) e
  // resolve-se sempre como +180, para que o intervalo seja (-180, 180].
  return diff === -180 ? 180 : diff;
}

/** Abreviatura do ponto cardeal em PT-PT (ex.: 292,5° -> "ONO"). */
export function compassAbbreviation(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  const index = Math.round(normalizeDegrees(deg) / 22.5) % 16;
  return COMPASS_ABBR[index] ?? "—";
}

/** Nome completo do ponto cardeal em PT-PT (ex.: 292,5° -> "Oés-Noroeste"). */
export function compassName(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  const index = Math.round(normalizeDegrees(deg) / 22.5) % 16;
  return COMPASS_FULL[index] ?? "—";
}

/** "ONO (Oés-Noroeste)" — abreviatura com o nome completo. */
export function compassLabel(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  return `${compassAbbreviation(deg)} (${compassName(deg)})`;
}

/**
 * Rumo de onde o vento sopra em condições de terral (offshore) para uma praia
 * virada para `beachOrientation`. O terral vem de terra, ou seja, do lado
 * oposto à normal marítima da praia.
 */
export function offshoreBearing(beachOrientation: number): number {
  return normalizeDegrees(beachOrientation + 180);
}

export type WindRelation = "terral" | "lateral" | "maritimo";

/**
 * Classifica o vento relativamente à orientação da praia.
 *
 * @param windFrom   Rumo de onde o vento vem (graus).
 * @param beachOrientation Rumo para onde a praia está virada (graus).
 * @param tolerance  Semi-largura (graus) do setor considerado terral/lateral
 *                   antes de passar a marítimo. Por omissão, 60°.
 */
export function classifyWind(
  windFrom: number,
  beachOrientation: number,
  tolerance = 60,
): WindRelation {
  const offshore = offshoreBearing(beachOrientation);
  const distance = angularDistance(windFrom, offshore);
  if (distance <= tolerance) return "terral";
  if (distance >= 180 - tolerance) return "maritimo";
  return "lateral";
}

/** Descrição em PT-PT da relação do vento com a praia. */
export function windRelationLabel(relation: WindRelation): string {
  switch (relation) {
    case "terral":
      return "terral (offshore)";
    case "lateral":
      return "lateral (cross-shore)";
    case "maritimo":
      return "marítimo (onshore)";
  }
}

/** Distância em quilómetros entre dois pontos (fórmula de Haversine). */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Limita um valor a um intervalo. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Média aritmética, ignorando `null`/`undefined`. Devolve `null` se vazio. */
export function mean(values: readonly (number | null | undefined)[]): number | null {
  const usable = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (usable.length === 0) return null;
  return usable.reduce((sum, v) => sum + v, 0) / usable.length;
}

/** Máximo, ignorando `null`/`undefined`. Devolve `null` se vazio. */
export function maxOf(values: readonly (number | null | undefined)[]): number | null {
  const usable = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (usable.length === 0) return null;
  return Math.max(...usable);
}

/** Mínimo, ignorando `null`/`undefined`. Devolve `null` se vazio. */
export function minOf(values: readonly (number | null | undefined)[]): number | null {
  const usable = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (usable.length === 0) return null;
  return Math.min(...usable);
}

/**
 * Média circular de rumos (graus). Necessária porque 350° e 10° distam 20°,
 * não 340°.
 */
export function circularMean(
  values: readonly (number | null | undefined)[],
): number | null {
  const usable = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (usable.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const v of usable) {
    const rad = (normalizeDegrees(v) * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return usable[0] ?? null;
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}
