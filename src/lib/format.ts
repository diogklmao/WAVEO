/**
 * WAVEO — formatação de valores para PT-PT.
 *
 * Toda a apresentação numérica passa por aqui para garantir separadores
 * decimais com vírgula, unidades explícitas e consistência entre ecrãs.
 */

import { compassAbbreviation, compassName } from "./geo";
import type { ScoreBand, SurferLevel, TideExtreme, TideStage } from "./types";

const PT_NUMBER = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const PT_INTEGER = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });

/** Número com uma casa decimal e vírgula: 1.4 -> "1,4". */
export function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return PT_NUMBER.format(value);
}

/** Número inteiro: 18.6 -> "19". */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return PT_INTEGER.format(value);
}

/** Valor numérico opcional; devolve "—" quando em falta. */
export function formatOptionalDecimal(
  value: number | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return formatDecimal(value);
}

/** Altura de onda: "1,4 m". */
export function formatMeters(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatDecimal(value)} m`;
}

/** Intervalo de alturas de onda: "1,0–1,8 m". */
export function formatMeterRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min === null || min === undefined || max === null || max === undefined) {
    return "—";
  }
  if (Math.abs(max - min) < 0.05) return `${formatDecimal(min)} m`;
  return `${formatDecimal(min)}–${formatDecimal(max)} m`;
}

/** Período: "11 s". */
export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatInteger(value)} s`;
}

/** Velocidade do vento: "18 km/h". */
export function formatKmh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatInteger(value)} km/h`;
}

/** Nós, para leitura rápida de vento por surfistas. */
export function kmhToKnots(kmh: number): number {
  return kmh / 1.852;
}

/** Velocidade do vento em nós: "10 kn". */
export function formatKnots(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatInteger(kmhToKnots(value))} kn`;
}

/** Temperatura: "17 °C". */
export function formatCelsius(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatDecimal(value)} °C`;
}

/** Percentagem inteira: "72 %". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatInteger(value)} %`;
}

/** Fração 0–1 como percentagem: 0.72 -> "72 %". */
export function formatFractionAsPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return formatPercent(value * 100);
}

/** Direção com abreviatura e nome: "ONO (Oés-Noroeste)". */
export function formatDirection(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "—";
  return `${compassAbbreviation(deg)} (${compassName(deg)})`;
}

/** Direção apenas abreviada: "ONO". */
export function formatDirectionShort(deg: number | null | undefined): string {
  return compassAbbreviation(deg);
}

/** Pontuação: "7,4". */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return formatDecimal(value);
}

/** Pontuação sobre dez: "7,4 / 10". */
export function formatScoreOutOfTen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatDecimal(value)} / 10`;
}

/** Duração: "3 h" ou "1 h 30". */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole} h`;
  if (whole === 0) return `${minutes} min`;
  return `${whole} h ${minutes.toString().padStart(2, "0")}`;
}

/* =============================================================================
   Vocabulário de domínio em PT-PT
   ============================================================================= */

const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  excelente: "Excelente",
  bom: "Bom",
  razoavel: "Razoável",
  fraco: "Fraco",
  mau: "Mau",
  indisponivel: "Sem dados",
};

export function scoreBandLabel(band: ScoreBand): string {
  return SCORE_BAND_LABELS[band] ?? "Sem dados";
}

/**
 * Frase curta que descreve o que se pode esperar, evitando promessas.
 */
const SCORE_BAND_HINTS: Record<ScoreBand, string> = {
  excelente: "Condições muito favoráveis para surfar.",
  bom: "Vale a pena ir. Condições sólidas.",
  razoavel: "Surfável, com limitações a ter em conta.",
  fraco: "Condições fracas. Só para quem tem poucas opções.",
  mau: "Não é um bom momento para surfar.",
  indisponivel:
    "Não há dados suficientes para avaliar as condições neste momento.",
};

export function scoreBandHint(band: ScoreBand): string {
  return SCORE_BAND_HINTS[band] ?? SCORE_BAND_HINTS.indisponivel;
}

const SURFER_LEVEL_LABELS: Record<SurferLevel, string> = {
  iniciado: "Iniciados",
  intermedio: "Intermédios",
  avancado: "Avançados",
};

export function surferLevelLabel(level: SurferLevel): string {
  return SURFER_LEVEL_LABELS[level] ?? level;
}

const TIDE_STAGE_LABELS: Record<TideStage | "estagnada", string> = {
  subida: "a subir",
  descida: "a descer",
  estagnada: "estagnada",
};

export function tideStageLabel(stage: TideStage | "estagnada" | null): string {
  if (!stage) return "—";
  return TIDE_STAGE_LABELS[stage] ?? "—";
}

const TIDE_EXTREME_LABELS: Record<TideExtreme["type"], string> = {
  cheia: "Maré alta",
  baixa: "Maré baixa",
};

/** Etiqueta de um extremo de maré para a interface ("cheia" → "Maré alta"). */
export function tideExtremeLabel(type: TideExtreme["type"]): string {
  return TIDE_EXTREME_LABELS[type];
}

const BREAK_TYPE_LABELS: Record<string, string> = {
  beach: "Beach break",
  point: "Point break",
  reef: "Reef break",
};

export function breakTypeLabel(type: string): string {
  return BREAK_TYPE_LABELS[type] ?? type;
}

const BOTTOM_LABELS: Record<string, string> = {
  areia: "Fundo de areia",
  rocha: "Fundo de rocha",
  misto: "Fundo misto",
};

export function bottomLabel(bottom: string): string {
  return BOTTOM_LABELS[bottom] ?? bottom;
}

/* =============================================================================
   Códigos de tempo (WMO) — descrições em PT-PT
   ============================================================================= */

const WEATHER_CODES: Record<number, string> = {
  0: "Céu limpo",
  1: "Maioritariamente limpo",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Nevoeiro",
  48: "Nevoeiro com geada",
  51: "Chuvisco fraco",
  53: "Chuvisco moderado",
  55: "Chuvisco forte",
  56: "Chuvisco gelado fraco",
  57: "Chuvisco gelado forte",
  61: "Chuva fraca",
  63: "Chuva moderada",
  65: "Chuva forte",
  66: "Chuva gelada fraca",
  67: "Chuva gelada forte",
  71: "Neve fraca",
  73: "Neve moderada",
  75: "Neve forte",
  77: "Grãos de neve",
  80: "Aguaceiros fracos",
  81: "Aguaceiros moderados",
  82: "Aguaceiros violentos",
  85: "Aguaceiros de neve fracos",
  86: "Aguaceiros de neve fortes",
  95: "Trovoada",
  96: "Trovoada com granizo fraco",
  99: "Trovoada com granizo forte",
};

export function weatherCodeLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return "—";
  return WEATHER_CODES[code] ?? "Condição não catalogada";
}

/** Categoria visual simples para escolher um ícone. */
export type WeatherIcon =
  | "sol"
  | "sol-nuvens"
  | "nuvens"
  | "nevoeiro"
  | "chuvisco"
  | "chuva"
  | "aguaceiro"
  | "trovoada"
  | "neve";

export function weatherIcon(
  code: number | null | undefined,
  isDay: boolean | null | undefined,
): WeatherIcon {
  if (code === null || code === undefined) return "nuvens";
  if (code === 0) return isDay === false ? "nuvens" : "sol";
  if (code === 1) return "sol-nuvens";
  if (code === 2 || code === 3) return "nuvens";
  if (code === 45 || code === 48) return "nevoeiro";
  if (code >= 51 && code <= 57) return "chuvisco";
  if (code >= 61 && code <= 67) return "chuva";
  if (code >= 71 && code <= 77) return "neve";
  if (code >= 80 && code <= 82) return "aguaceiro";
  if (code === 85 || code === 86) return "neve";
  if (code >= 95) return "trovoada";
  return "nuvens";
}

/* =============================================================================
   Escala de cor da pontuação
   ============================================================================= */

/**
 * Cor sólida para a pontuação, numa escala contínua frio -> quente.
 * Usada em marcadores, anéis e barras.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "#64748b";
  }
  const stops: { at: number; color: [number, number, number] }[] = [
    { at: 0, color: [225, 29, 72] }, // rosa
    { at: 2.5, color: [234, 88, 12] }, // laranja
    { at: 4.5, color: [217, 119, 6] }, // âmbar
    { at: 6.5, color: [101, 163, 13] }, // lima
    { at: 8, color: [13, 148, 136] }, // verde-mar
    { at: 10, color: [14, 116, 144] }, // azul-mar
  ];
  const clamped = Math.min(10, Math.max(0, score));
  for (let i = 1; i < stops.length; i += 1) {
    const prev = stops[i - 1]!;
    const next = stops[i]!;
    if (clamped <= next.at) {
      const span = next.at - prev.at || 1;
      const t = (clamped - prev.at) / span;
      const rgb = prev.color.map((c, idx) =>
        Math.round(c + t * ((next.color[idx] ?? c) - c)),
      );
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return "#0e7490";
}

/** Degradê CSS correspondente à escala de pontuação. */
export function scoreGradient(from: number, to: number): string {
  return `linear-gradient(90deg, ${scoreColor(from)}, ${scoreColor(to)})`;
}

/**
 * Classes Tailwind para um "selo" de pontuação. As cores são fixas por escalão
 * para garantir contraste suficiente sobre fundo escuro.
 */
export function scoreBadgeClasses(band: ScoreBand): string {
  switch (band) {
    case "excelente":
      return "border-tide-400/50 bg-tide-500/15 text-tide-200";
    case "bom":
      return "border-signal-good/50 bg-signal-good/15 text-signal-good";
    case "razoavel":
      return "border-signal-fair/45 bg-signal-fair/12 text-signal-fair";
    case "fraco":
      return "border-signal-marginal/45 bg-signal-marginal/12 text-signal-marginal";
    case "mau":
      return "border-signal-bad/45 bg-signal-bad/12 text-signal-bad";
    case "indisponivel":
    default:
      return "border-mist-600/40 bg-mist-600/10 text-mist-400";
  }
}

/** Descrição textual da disponibilidade de dados, para rodapés e avisos. */
export function describeDataAvailability(missing: readonly string[]): string {
  if (missing.length === 0) return "Todos os dados necessários estão disponíveis.";
  return `Sem dados para: ${missing.join(", ")}.`;
}
