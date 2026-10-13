/**
 * WAVEO — configuração do motor de pontuação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LEIA ISTO ANTES DE ALTERAR VALORES
 * ─────────────────────────────────────────────────────────────────────────────
 * Todos os pesos, limiares e curvas do Surf Score estão reunidos neste
 * ficheiro. Nenhum deles é mágico nem validado cientificamente: são pontos de
 * partida razoáveis, escolhidos para produzir ordenações sensatas entre horas,
 * spots e dias.
 *
 * Se alterar um valor aqui, a alteração propaga-se de imediato a toda a
 * aplicação, incluindo às explicações mostradas ao utilizador — porque as
 * explicações são geradas a partir dos mesmos números que produzem a
 * pontuação. Não existem limiares duplicados na interface.
 *
 * Princípio central: **um dado em falta não é uma condição má**. Os fatores
 * sem dados são excluídos e o seu peso é redistribuído pelos restantes,
 * reduzindo a confiança — nunca a pontuação.
 */

import type { SpotCharacteristics } from "../types";
import { offshoreBearing } from "../geo";
import type { CurvePoint } from "../curve";

/* =============================================================================
   Pesos dos fatores
   ============================================================================= */

export interface ScoreWeights {
  waveHeight: number;
  swellPeriod: number;
  swellDirection: number;
  wind: number;
  tide: number;
}

/**
 * Pesos relativos de cada fator. A soma é 100, mas isso não é obrigatório:
 * o motor normaliza sempre. A altura de onda e o vento dominam porque são,
 * na prática, o que decide se vale a pena ir.
 *
 * O peso da maré é multiplicado pela `importance` de cada spot, pelo que o
 * valor efetivo de 12 só se aplica aos spots mais sensíveis à maré.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  waveHeight: 30,
  swellPeriod: 18,
  swellDirection: 16,
  wind: 24,
  tide: 12,
};

/** Repartição interna do fator vento entre velocidade e direção. */
export const WIND_SPEED_SHARE = 0.6;
export const WIND_DIRECTION_SHARE = 0.4;

/**
 * Quanto pesa a direção do vento dentro do fator vento, no máximo, quando o
 * vento é forte. Com vento muito fraco a direção é irrelevante (está glassy
 * de qualquer maneira), pelo que este peso é atenuado proporcionalmente.
 */
export const WIND_DIRECTION_MAX_INFLUENCE = 0.45;

/**
 * Vento abaixo desta fração da tolerância do spot é considerado "calmo":
 * a direção deixa de ter importância.
 */
export const CALM_WIND_FRACTION = 0.35;

/* =============================================================================
   Curvas por fator
   ============================================================================= */

/**
 * Curva da altura de onda significativa, construída a partir dos limites
 * próprios do spot: a faixa "ideal" recebe as melhores pontuações e a faixa
 * "navegável" define onde as condições ainda fazem sentido.
 *
 * Fora da faixa navegável a pontuação cai para zero — não porque o mar esteja
 * "mau", mas porque aquele spot, com aquela altura, deixa de ser uma opção.
 */
export function waveHeightCurve(c: SpotCharacteristics): CurvePoint[] {
  const ridable = c.ridableWaveHeight;
  const ideal = c.idealWaveHeight;
  const idealCentre = (ideal.min + ideal.max) / 2;
  return [
    [0, 0.5],
    [ridable.min * 0.5, 3],
    [ridable.min, 5.5],
    [ideal.min, 8.5],
    [idealCentre, 10],
    [ideal.max, 8.5],
    [ridable.max, 4],
    [ridable.max * 1.3, 1],
    [ridable.max * 1.6, 0],
  ];
}

/**
 * Curva do período de pico. Períodos mais longos transportam mais energia e
 * organizam melhor a onda, mas acima do limite útil do spot passam a fechar
 * os bancos de areia — daí a descida suave depois do máximo.
 *
 * Note-se que a descida é moderada de propósito: período longo nunca é
 * tratado como "condição má", apenas como menos adequado àquele spot.
 */
export function periodCurve(c: SpotCharacteristics): CurvePoint[] {
  const ideal = c.idealPeriod;
  const centre = (ideal.min + ideal.max) / 2;
  const maxUseful = Math.max(c.maxUsefulPeriod, ideal.max + 1);
  return [
    [3, 0],
    [5, 2],
    [7, 5],
    [ideal.min, 8.5],
    [centre, 10],
    [ideal.max, 10],
    [maxUseful, 9],
    [maxUseful + 5, 7.5],
  ];
}

/**
 * Curva da direção da ondulação, em função da distância angular ao centro da
 * janela de swell do spot. Há um patamar generoso no centro da janela ( pequenas
 * variações de direção não mudam nada) e uma queda rápida fora dela.
 */
export function swellDirectionCurve(c: SpotCharacteristics): CurvePoint[] {
  const halfWidth = Math.max(10, c.swellWindow.halfWidth);
  return [
    [0, 10],
    [halfWidth * 0.4, 10],
    [halfWidth, 7],
    [halfWidth * 1.6, 3],
    [halfWidth * 2.4, 0.5],
  ];
}

/**
 * Curvas de velocidade do vento, normalizadas pela tolerância de cada spot.
 *
 * O eixo dos valores é `velocidade / windTolerance`, pelo que as mesmas
 * curvas se adaptam automaticamente a spots mais ou menos abrigados: um spot
 * com tolerância de 22 km/h degrada-se com muito menos vento do que um com 30.
 *
 * A direção entra aqui através da escolha da curva — vento marítimo degrada
 * as condições muito mais depressa do que vento terral.
 */
export const WIND_SPEED_CURVES: Record<
  "terral" | "lateral" | "maritimo",
  CurvePoint[]
> = {
  // x = velocidade do vento / tolerância do spot
  terral: [
    [0, 10],
    [0.3, 10],
    [0.55, 9],
    [0.8, 7.5],
    [1.1, 5],
    [1.5, 2.5],
    [2.0, 0.5],
    [2.5, 0],
  ],
  lateral: [
    [0, 10],
    [0.3, 9.2],
    [0.55, 7.5],
    [0.8, 5.5],
    [1.1, 3.5],
    [1.5, 1.5],
    [2.0, 0.3],
    [2.5, 0],
  ],
  maritimo: [
    [0, 9.5],
    [0.3, 7.5],
    [0.55, 5],
    [0.8, 3],
    [1.1, 1.5],
    [1.5, 0.4],
    [2.0, 0],
    [2.5, 0],
  ],
};

/**
 * Inclinação da curva de velocidade do vento, dependente da tolerância.
 * Um vento "muito forte" é definido em função da tolerância do spot, não em
 * valor absoluto.
 */
export const WIND_GUST_CONFIG = {
  /** Rajada acima da média deste valor (km/h) começa a penalizar. */
  freeDelta: 12,
  /** Rajada acima da média a partir da qual a penalização é máxima. */
  fullDelta: 42,
  /** Penalização máxima aplicada ao fator vento (0–1). */
  maxPenalty: 0.25,
};

/**
 * Curva da direção do vento face ao rumo offshore perfeito do spot.
 * Devolve um fator multiplicativo entre 0 e 1, não uma pontuação.
 */
export function windDirectionFactorCurve(c: SpotCharacteristics): CurvePoint[] {
  const tolerance = Math.max(25, c.windOffshoreTolerance);
  return [
    [0, 1],
    [tolerance, 0.92],
    [90, 0.5],
    [140, 0.15],
    [180, 0],
  ];
}

/* =============================================================================
   Escalões de qualidade
   ============================================================================= */

export interface BandThreshold {
  /** Pontuação mínima (inclusive) para este escalão. */
  min: number;
  band: "excelente" | "bom" | "razoavel" | "fraco" | "mau";
}

/** Ordenados do mais alto para o mais baixo. */
export const BAND_THRESHOLDS: readonly BandThreshold[] = [
  { min: 8.5, band: "excelente" },
  { min: 7.0, band: "bom" },
  { min: 5.0, band: "razoavel" },
  { min: 3.0, band: "fraco" },
  { min: 0, band: "mau" },
];

/**
 * Abaixo desta fração de peso disponível, a pontuação é considerada pouco
 * fiável. Não é escondida — é apresentada com um aviso explícito.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.55;

/**
 * Abaixo desta fração de peso disponível não é apresentado veredicto nenhum.
 *
 * A diferença face a `LOW_CONFIDENCE_THRESHOLD` é de natureza, não de grau:
 * o aviso serve para uma pontuação a que falta um fator; este patamar serve
 * para a situação em que falta quase tudo. Sem ele, um cenário real — o
 * fornecedor marinho em baixo e o meteorológico a responder — produzia uma
 * pontuação de 10,0 ("excelente") calculada só com o vento e a maré, exibida
 * no mapa com a mesma confiança visual de um dia bem observado. Isso é
 * precisamente confundir "não sabemos" com "está muito bom".
 *
 * Os valores reais que este limiar separa: com o marinho em baixo sobram
 * 24 + 6 = 30 de 94 pontos de peso (0,32); com o meteorológico em baixo sobram
 * 70 de 94 (0,74). O patamar fica no meio, pelo que a perda do vento continua
 * a merecer veredicto e a perda do mar não.
 */
export const MIN_CONFIDENCE_FOR_SCORE = 0.45;

/** Limiar a partir do qual um fator é descrito como ponto forte. */
export const STRENGTH_THRESHOLD = 7.5;

/** Limiar abaixo do qual um fator é descrito como limitação. */
export const LIMITER_THRESHOLD = 5;

/**
 * Teto imposto por um fator isolado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PORQUE ISTO EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 * A média ponderada, sozinha, tem um defeito sério para o produto: como a
 * altura de onda, o período e a direção somam, entre si, mais peso do que o
 * vento, uma hora com swell perfeito e 45 km/h de vento marítimo ainda
 * pontuava acima de 7 — "bom" — quando não há nada para surfar nessas
 * condições. O mesmo acontecia ao contrário: uma hora sem onda nenhuma (10 cm),
 * mas com período, direção e vento ideais, valia 7,6.
 *
 * A regra acrescentada é deliberadamente simples e contínua: nenhuma hora pode
 * valer mais do que `floor + slope × (nota do pior fator relevante)`, com
 * `slope = (ceiling − floor) / neutralScore`. Como o teto do pior fator iguala
 * `ceiling` (ou seja, 10) quando esse fator vale `neutralScore`, a regra não
 * tem descontinuidade: a partir daí não faz nada, e abaixo disso limita.
 *
 * Não é um veto binário nem uma segunda pontuação escondida — é um limite
 * superior explicável, e a interface diz qual foi o fator que o impôs.
 */
export const LIMITER_CAP = {
  /** Valor com que o pior fator relevante limita a hora, se valer 0. */
  floor: 2,
  /** Valor do teto quando o pior fator relevante vale `neutralScore`. */
  ceiling: 10,
  /** Nota de fator a partir da qual o teto deixa de ter qualquer efeito. */
  neutralScore: 5,
  /**
   * Fatores com peso efetivo abaixo desta fração não podem impor o teto. Sem
   * isto, a maré — que num spot pouco sensível pesa 6 % — mandaria na hora
   * inteira, o que contradiz a ideia de peso específico por spot.
   */
  minWeight: 0.15,
} as const;

/* =============================================================================
   Deteção da melhor janela para surfar
   ============================================================================= */

export const BEST_WINDOW_CONFIG = {
  /** Pontuação mínima para uma hora ser considerada "boa". */
  minScore: 6.5,
  /** Duração mínima, em horas, para constituir uma janela. */
  minHours: 2,
  /** Duração máxima reportada — acima disto indicamos o melhor troço. */
  maxHours: 8,
  /** Horizonte de procura da melhor janela, em horas. */
  horizonHours: 72,
  /** Horizonte mais curto usado para a "próxima janela" do dashboard. */
  nearHorizonHours: 24,
  /** Pontuação abaixo da qual consideramos que não há janela válida. */
  fallbackMinScore: 5.5,
} as const;

/* =============================================================================
   Derivados
   ============================================================================= */

/**
 * Pesos efetivos para um spot: a maré é escalada pela importância que tem
 * naquele spot em particular.
 */
export function weightsForSpot(c: SpotCharacteristics): ScoreWeights {
  const importance = Math.min(1, Math.max(0, c.tide.importance));
  return {
    ...DEFAULT_WEIGHTS,
    tide: DEFAULT_WEIGHTS.tide * importance,
  };
}

/** Rumo offshore do spot (reexportado aqui por conveniência de configuração). */
export function spotOffshoreBearing(c: SpotCharacteristics): number {
  return offshoreBearing(c.beachOrientation);
}
