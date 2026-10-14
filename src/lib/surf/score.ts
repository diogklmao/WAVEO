/**
 * WAVEO — motor do Surf Score.
 *
 * Produz uma pontuação de 0 a 10 a partir de cinco fatores, cada um calculado
 * com os parâmetros próprios do spot. A pontuação é acompanhada de:
 *
 *  - a decomposição fator a fator, com o peso efetivamente usado;
 *  - uma explicação em PT-PT do contributo de cada fator;
 *  - um índice de confiança, que mede a proporção do peso suportada por dados
 *    realmente disponíveis.
 *
 * Três regras não negociáveis deste motor:
 *
 *  1. **Dados em falta não são condições más.** Um fator sem dados é excluído
 *     e o seu peso é redistribuído. Nunca contribui com zero para a média. Mas
 *     também não se finge que há veredicto quando quase tudo falta: abaixo de
 *     `MIN_CONFIDENCE_FOR_SCORE` a hora é apresentada como indisponível, e não
 *     como boa — que era o que acontecia quando só o vento e a maré respondiam.
 *  2. **Uma condição claramente desfavorável não é compensada pelas outras.**
 *     A média ponderada, por si só, deixava uma hora com 45 km/h de vento
 *     marítimo pontuar acima de 7 só porque o swell estava bom. O teto por
 *     fator isolado (`LIMITER_CAP`) corrige isso — e é explicado ao utilizador
 *     sempre que entra em ação.
 *  3. **A metodologia é provisória.** Nada aqui foi validado contra resultados
 *     observados. A pontuação ordena condições de forma plausível; não é uma
 *     medida científica nem uma previsão de qualidade garantida.
 */

import {
  angularDistance,
  classifyWind,
  clamp,
  mean,
  offshoreBearing,
  windRelationLabel,
} from "../geo";
import { piecewise, piecewiseScore } from "../curve";
import {
  formatDecimal,
  formatDirectionShort,
  formatKmh,
  formatMeters,
  formatPercent,
  formatSeconds,
  scoreBandHint,
  scoreBandLabel,
  tideStageLabel,
} from "../format";
import type {
  FactorImpact,
  FactorKey,
  HourlyForecast,
  ScoreBand,
  ScoreFactor,
  SpotCharacteristics,
  SurfScore,
  SurfSpot,
  TideState,
} from "../types";
import {
  BAND_THRESHOLDS,
  CALM_WIND_FRACTION,
  LIMITER_CAP,
  LIMITER_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE_FOR_SCORE,
  STRENGTH_THRESHOLD,
  WIND_DIRECTION_MAX_INFLUENCE,
  WIND_GUST_CONFIG,
  WIND_SPEED_CURVES,
  periodCurve,
  swellDirectionCurve,
  waveHeightCurve,
  weightsForSpot,
  windDirectionFactorCurve,
} from "./config";

/* =============================================================================
   API pública
   ============================================================================= */

export interface ScoreInput {
  spot: SurfSpot;
  hour: HourlyForecast;
  tide: TideState;
}

/** Calcula o Surf Score para uma hora concreta. */
export function computeSurfScore({ spot, hour, tide }: ScoreInput): SurfScore {
  const c = spot.characteristics;
  const weights = weightsForSpot(c);

  const factors: ScoreFactor[] = [
    buildWaveHeightFactor(c, hour, weights.waveHeight),
    buildSwellPeriodFactor(c, hour, weights.swellPeriod),
    buildSwellDirectionFactor(c, hour, weights.swellDirection),
    buildWindFactor(c, hour, weights.wind),
    buildTideFactor(c, hour, tide, weights.tide),
  ];

  return finaliseScore(factors, spot, hour, tide);
}

/** Versão conveniente para séries horárias. */
export function computeSurfScores(
  spot: SurfSpot,
  hours: readonly HourlyForecast[],
  tide: TideState,
  tideResolver?: (hour: HourlyForecast) => TideState,
): SurfScore[] {
  return hours.map((hour) =>
    computeSurfScore({
      spot,
      hour,
      tide: tideResolver ? tideResolver(hour) : tide,
    }),
  );
}

/* =============================================================================
   Fatores
   ============================================================================= */

function buildWaveHeightFactor(
  c: SpotCharacteristics,
  hour: HourlyForecast,
  weight: number,
): ScoreFactor {
  const base = factorBase("waveHeight", "Altura de onda", weight);

  if (hour.waveHeight === null) {
    return {
      ...base,
      reading: "—",
      score: null,
      impact: "indisponivel",
      detail:
        "O fornecedor não devolveu altura de onda para este ponto e hora. Este fator foi excluído do cálculo.",
    };
  }

  const h = hour.waveHeight;
  const score = piecewiseScore(h, waveHeightCurve(c), { smooth: true });
  const ideal = c.idealWaveHeight;
  const ridable = c.ridableWaveHeight;

  let detail: string;
  if (h < ridable.min) {
    detail = `Abaixo da altura mínima que este spot costuma comportar (${formatMeters(ridable.min)}). Praticamente não há onda para surfar.`;
  } else if (h < ideal.min) {
    detail = `Acima do mínimo navegável mas abaixo da faixa preferida deste spot (${formatMeters(ideal.min)}–${formatMeters(ideal.max)}). Onda com pouca energia.`;
  } else if (h <= ideal.max) {
    detail = `Dentro da faixa de altura preferida deste spot (${formatMeters(ideal.min)}–${formatMeters(ideal.max)}).`;
  } else if (h <= ridable.max) {
    detail = `Acima da faixa preferida (${formatMeters(ideal.min)}–${formatMeters(ideal.max)}) mas ainda dentro do que este spot comporta (até ${formatMeters(ridable.max)}).`;
  } else {
    detail = `Acima da altura que este spot comporta em segurança (${formatMeters(ridable.max)}). Só faz sentido para surfistas muito experientes, e apenas se as restantes condições ajudarem.`;
  }

  if (hour.windWaveHeight !== null && hour.swellHeight !== null) {
    const windSeaShare = windSeaFraction(hour);
    if (windSeaShare !== null && windSeaShare > 0.45) {
      detail += ` Nota: ${formatPercent(windSeaShare * 100)} da altura total vem de onda de vento, o que torna o mar desordenado.`;
    }
  }

  return {
    ...base,
    reading: formatMeters(h),
    score,
    impact: impactOf(score),
    detail,
    breakdown: [
      {
        label: "Altura significativa total",
        score,
        reading: formatMeters(h),
      },
    ],
  };
}

function buildSwellPeriodFactor(
  c: SpotCharacteristics,
  hour: HourlyForecast,
  weight: number,
): ScoreFactor {
  const base = factorBase("swellPeriod", "Período", weight);

  // Preferimos o período do swell (componente organizada). Se não existir,
  // usamos o período total, deixando isso explícito na leitura.
  const usingSwell = hour.swellPeriod !== null;
  const period = usingSwell ? hour.swellPeriod : hour.wavePeriod;
  const source = usingSwell ? "do swell" : "total da onda";

  if (period === null) {
    return {
      ...base,
      reading: "—",
      score: null,
      impact: "indisponivel",
      detail:
        "O fornecedor não devolveu período de onda para este ponto e hora. Este fator foi excluído do cálculo.",
    };
  }

  const score = piecewiseScore(period, periodCurve(c), { smooth: true });
  const ideal = c.idealPeriod;

  let detail: string;
  if (period < ideal.min - 2) {
    detail = `Período curto (${formatSeconds(period)}, ${source}). A onda chega pouco organizada e com pouca energia.`;
  } else if (period < ideal.min) {
    detail = `Ligeiramente abaixo do período preferido deste spot (${formatSeconds(ideal.min)}–${formatSeconds(ideal.max)}), mas já com alguma organização.`;
  } else if (period <= ideal.max) {
    detail = `Período dentro da faixa preferida deste spot (${formatSeconds(ideal.min)}–${formatSeconds(ideal.max)}). Ondulação bem organizada.`;
  } else if (period <= c.maxUsefulPeriod) {
    detail = `Período acima da faixa preferida mas ainda dentro do útil para este spot (até ${formatSeconds(c.maxUsefulPeriod)}). Mais energia, requer mais cuidado.`;
  } else {
    detail = `Período muito longo para este spot (acima de ${formatSeconds(c.maxUsefulPeriod)}). A ondulação tende a fechar os bancos e a exigir bastante experiência.`;
  }

  return {
    ...base,
    reading: `${formatSeconds(period)} (${source})`,
    score,
    impact: impactOf(score),
    detail,
  };
}

function buildSwellDirectionFactor(
  c: SpotCharacteristics,
  hour: HourlyForecast,
  weight: number,
): ScoreFactor {
  const base = factorBase("swellDirection", "Direção da ondulação", weight);

  const usingSwell = hour.swellDirection !== null;
  const direction = usingSwell ? hour.swellDirection : hour.waveDirection;

  if (direction === null) {
    return {
      ...base,
      reading: "—",
      score: null,
      impact: "indisponivel",
      detail:
        "O fornecedor não devolveu direção de ondulação para este ponto e hora. Este fator foi excluído do cálculo.",
    };
  }

  const distance = angularDistance(direction, c.swellWindow.center);
  const score = piecewiseScore(distance, swellDirectionCurve(c), { smooth: true });
  const window = c.swellWindow;
  const lowEdge = (window.center - window.halfWidth + 360) % 360;
  const highEdge = (window.center + window.halfWidth) % 360;

  let detail: string;
  if (distance <= window.halfWidth * 0.4) {
    detail = `Ondulação a entrar praticamente no centro da janela ideal deste spot (${formatDirectionShort(window.center)}). É a direção que melhor forma a onda aqui.`;
  } else if (distance <= window.halfWidth) {
    detail = `Dentro da janela de swell deste spot (${formatDirectionShort(lowEdge)}–${formatDirectionShort(highEdge)}), embora não no centro.`;
  } else if (distance <= window.halfWidth * 1.6) {
    detail = `Na margem da janela de swell deste spot (${formatDirectionShort(lowEdge)}–${formatDirectionShort(highEdge)}). A onda chega com menos formação do que o habitual aqui.`;
  } else {
    detail = `Fora da janela de swell deste spot (${formatDirectionShort(lowEdge)}–${formatDirectionShort(highEdge)}). Com esta direção a ondulação tende a entrar desorganizada ou a contornar o spot.`;
  }

  if (hour.secondarySwellHeight !== null && hour.waveHeight !== null) {
    const share = hour.secondarySwellHeight / Math.max(0.05, hour.waveHeight);
    if (share > 0.4) {
      detail += ` Há ainda um swell secundário relevante (${formatMeters(hour.secondarySwellHeight)}), o que costuma traduzir-se num mar cruzado.`;
    }
  }

  return {
    ...base,
    reading: `${formatDirectionShort(direction)}${usingSwell ? "" : " (total)"}`,
    score,
    impact: impactOf(score),
    detail,
  };
}

function buildWindFactor(
  c: SpotCharacteristics,
  hour: HourlyForecast,
  weight: number,
): ScoreFactor {
  const base = factorBase("wind", "Vento", weight);

  if (hour.windSpeed === null) {
    return {
      ...base,
      reading: "—",
      score: null,
      impact: "indisponivel",
      detail:
        "O fornecedor não devolveu velocidade de vento para este ponto e hora. Este fator foi excluído do cálculo.",
    };
  }

  const speed = hour.windSpeed;
  const tolerance = Math.max(8, c.windTolerance);
  const relativeSpeed = speed / tolerance;

  const hasDirection = hour.windDirection !== null;
  // A classificação usa a tolerância ao terral definida para este spot, e não
  // um valor fixo: é o mesmo limiar que a curva de direção usa logo abaixo, de
  // modo que a etiqueta mostrada ao utilizador nunca contradiz a pontuação.
  const relation = hasDirection
    ? classifyWind(hour.windDirection!, c.beachOrientation, c.windOffshoreTolerance)
    : "lateral";

  const offshore = offshoreBearing(c.beachOrientation);

  const speedScore = piecewiseScore(relativeSpeed, WIND_SPEED_CURVES[relation], {
    smooth: true,
  });

  // A direção só é relevante quando há vento suficiente para estragar a onda.
  const calmness = 1 - clamp(speed / (tolerance * CALM_WIND_FRACTION), 0, 1);
  let directionFactor = 1;
  if (hasDirection) {
    // A curva é indexada pela distância angular ao rumo offshore perfeito do
    // spot — 0 para terral, 180 para marítimo — e não pelo rumo bruto do vento.
    const directionDistance = angularDistance(hour.windDirection!, offshore);
    directionFactor = piecewise(directionDistance, windDirectionFactorCurve(c));
    const directionInfluence = WIND_DIRECTION_MAX_INFLUENCE * (1 - calmness);
    directionFactor = 1 - directionInfluence * (1 - directionFactor);
  }

  let score = speedScore * directionFactor;

  // Rajadas: uma média calma mas com rajadas fortes é pior do que a média sugere.
  let gustPenalty = 0;
  if (hour.windGust !== null && hour.windGust > speed) {
    const delta = hour.windGust - speed;
    const span = WIND_GUST_CONFIG.fullDelta - WIND_GUST_CONFIG.freeDelta;
    const excess = clamp(
      (delta - WIND_GUST_CONFIG.freeDelta) / (span > 0 ? span : 1),
      0,
      1,
    );
    gustPenalty = excess * WIND_GUST_CONFIG.maxPenalty;
    score *= 1 - gustPenalty;
  }

  score = clamp(score, 0, 10);

  const detailParts: string[] = [];

  if (!hasDirection) {
    detailParts.push(
      "A direção do vento não está disponível: foi assumida uma orientação lateral, nem favorável nem desfavorável.",
    );
  }

  if (speed < tolerance * 0.3) {
    detailParts.push(
      `Vento fraco (${formatKmh(speed)}), abaixo de ${formatKmh(tolerance * 0.3)}. A superfície deve estar limpa ou quase.`,
    );
  } else if (relation === "terral") {
    detailParts.push(
      `Vento terral de ${formatDirectionShort(hour.windDirection)} a ${formatKmh(speed)}. O terral sopra de terra para o mar e alisa a face da onda — é o vento que queremos.`,
    );
  } else if (relation === "lateral") {
    detailParts.push(
      `Vento lateral de ${formatDirectionShort(hour.windDirection)} a ${formatKmh(speed)}. Não estraga a onda como o marítimo, mas cria alguma textura.`,
    );
  } else {
    detailParts.push(
      `Vento marítimo de ${formatDirectionShort(hour.windDirection)} a ${formatKmh(speed)}. Sopra do mar para terra e levanta a superfície, tornando a onda desordenada.`,
    );
  }

  if (speed > tolerance) {
    detailParts.push(
      `Está acima da tolerância deste spot, que é de cerca de ${formatKmh(tolerance)} para vento de ${windRelationLabel(relation)}.`,
    );
  }

  if (gustPenalty > 0.05 && hour.windGust !== null) {
    detailParts.push(
      `As rajadas de ${formatKmh(hour.windGust)} são bem mais fortes do que a média, o que torna as condições irregulares.`,
    );
  }

  detailParts.push(`Terral ideal para este spot: vento de ${formatDirectionShort(offshore)}.`);

  const breakdown: { label: string; score: number | null; reading: string }[] = [
    { label: "Velocidade", score: speedScore, reading: formatKmh(speed) },
  ];
  if (hasDirection) {
    breakdown.push({
      label: "Direção",
      score: clamp(directionFactor * 10, 0, 10),
      reading: `${formatDirectionShort(hour.windDirection)} · ${windRelationLabel(relation)}`,
    });
  }
  if (hour.windGust !== null) {
    breakdown.push({
      label: "Rajadas",
      score: clamp((1 - gustPenalty) * 10, 0, 10),
      reading: formatKmh(hour.windGust),
    });
  }

  return {
    ...base,
    reading: `${formatKmh(speed)}${hour.windGust !== null ? ` (rajadas ${formatKmh(hour.windGust)})` : ""}${hasDirection ? ` · ${formatDirectionShort(hour.windDirection)}` : ""}`,
    score,
    impact: impactOf(score),
    detail: detailParts.join(" "),
    breakdown,
  };
}

function buildTideFactor(
  c: SpotCharacteristics,
  _hour: HourlyForecast,
  tide: TideState,
  weight: number,
): ScoreFactor {
  const base = factorBase("tide", "Maré", weight);
  const preference = c.tide;

  if (!tide.available || tide.normalizedLevel === null) {
    return {
      ...base,
      reading: "—",
      score: null,
      impact: "indisponivel",
      detail:
        tide.reason ??
        "Não há dados de maré disponíveis para este ponto. Este fator foi excluído do cálculo — a ausência de maré não é tratada como condição desfavorável.",
    };
  }

  const level = tide.normalizedLevel;
  const centre = (preference.level.min + preference.level.max) / 2;
  const halfSpan = Math.max(0.02, (preference.level.max - preference.level.min) / 2);
  const excess = Math.max(0, Math.abs(level - centre) - halfSpan);
  const maxExcess = Math.max(
    0.05,
    Math.max(centre, 1 - centre) - halfSpan,
  );
  const levelScore = clamp(10 - (excess / maxExcess) ** 0.85 * 7.5, 0, 10);

  let stageScore = 10;
  let stageApplies = false;
  if (preference.stages.length > 0 && tide.stage && tide.stage !== "estagnada") {
    stageApplies = true;
    stageScore = preference.stages.includes(tide.stage) ? 10 : 4.5;
  }

  const score = clamp(levelScore * 0.72 + stageScore * 0.28, 0, 10);

  const bandLow = preference.level.min;
  const bandHigh = preference.level.max;

  let detail: string;
  if (excess === 0) {
    detail = `A maré está dentro da faixa preferida deste spot (${formatPercent(bandLow * 100)}–${formatPercent(bandHigh * 100)} entre a maré baixa e a maré alta).`;
  } else if (level < bandLow) {
    detail = `A maré está abaixo da faixa preferida deste spot (${formatPercent(bandLow * 100)}–${formatPercent(bandHigh * 100)}). Com pouca água, a onda pode fechar ou quebrar demasiado perto do fundo.`;
  } else {
    detail = `A maré está acima da faixa preferida deste spot (${formatPercent(bandLow * 100)}–${formatPercent(bandHigh * 100)}). Com muita água, a onda perde definição.`;
  }

  if (stageApplies && tide.stage && tide.stage !== "estagnada") {
    detail +=
      preference.stages.includes(tide.stage)
        ? ` A maré está ${tideStageLabel(tide.stage)}, que é o estágio que costuma funcionar melhor aqui.`
        : ` A maré está ${tideStageLabel(tide.stage)}, enquanto este spot costuma funcionar melhor com maré ${preference.stages.map(tideStageLabel).join(" ou ")}.`;
  } else if (preference.stages.length === 0) {
    detail += " Este spot é pouco sensível ao estágio da maré.";
  }

  return {
    ...base,
    reading: `${formatMeters(tide.height)} · ${tideStageLabel(tide.stage)} · nível ${formatPercent(level * 100)}`,
    score,
    impact: impactOf(score),
    detail,
    breakdown: [
      {
        label: "Nível",
        score: levelScore,
        reading: formatPercent(level * 100),
      },
      ...(stageApplies
        ? [
            {
              label: "Estágio",
              score: stageScore,
              reading: tideStageLabel(tide.stage),
            },
          ]
        : []),
    ],
  };
}

/* =============================================================================
   Agregação e classificação
   ============================================================================= */

function finaliseScore(
  factors: ScoreFactor[],
  spot: SurfSpot,
  hour: HourlyForecast,
  tide: TideState,
): SurfScore {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const availableWeight = factors.reduce(
    (sum, f) => sum + (f.score === null ? 0 : f.weight),
    0,
  );

  const confidence = totalWeight > 0 ? availableWeight / totalWeight : 0;

  if (availableWeight <= 0) {
    return {
      value: 0,
      band: "indisponivel",
      label: scoreBandLabel("indisponivel"),
      confidence: 0,
      factors: factors.map((f) => ({ ...f, effectiveWeight: 0 })),
      summary:
        "Não foi possível obter dados de ondulação nem de vento para este momento, pelo que não há pontuação. Isto não significa que as condições sejam más — significa que não sabemos.",
      biggestLimiter: null,
      biggestStrength: null,
      provisional: true,
    };
  }

  const withWeights = factors.map((f) => ({
    ...f,
    effectiveWeight: f.score === null ? 0 : f.weight / availableWeight,
  }));

  const value = withWeights.reduce(
    (sum, f) => sum + (f.score ?? 0) * f.effectiveWeight,
    0,
  );

  // Com quase todo o peso em falta não há veredicto a dar. Reutilizamos o
  // escalão "indisponivel" — que já significa "não sabemos" em toda a
  // aplicação — em vez de apresentar como boa uma pontuação calculada a partir
  // de uma fração pequena dos fatores.
  if (confidence < MIN_CONFIDENCE_FOR_SCORE) {
    return {
      value: 0,
      band: "indisponivel",
      label: scoreBandLabel("indisponivel"),
      confidence,
      factors: withWeights,
      summary: buildInsufficientDataSummary(withWeights),
      biggestLimiter: null,
      biggestStrength: null,
      provisional: true,
    };
  }

  // A média ponderada é o valor base; o teto por fator isolado corrige o caso
  // em que um único fator desfavorável não consegue, sozinho, contrariar os
  // restantes. Ver `LIMITER_CAP` em `config.ts` para a justificação.
  const { cap, factor: limitingFactor } = limiterCap(withWeights);
  const capped = Math.min(clamp(value, 0, 10), cap);
  const cappedBy = capped < value - 0.05 ? limitingFactor : null;

  const rounded = Math.round(capped * 10) / 10;
  const band = bandFor(rounded);

  const { biggestLimiter, biggestStrength } = pickExtremes(withWeights);
  const summary = buildSummary({
    spot,
    hour,
    tide,
    factors: withWeights,
    band,
    confidence,
    biggestLimiter,
    biggestStrength,
    cappedBy,
  });

  return {
    value: rounded,
    band,
    label: scoreBandLabel(band),
    confidence,
    factors: withWeights,
    summary,
    biggestLimiter,
    biggestStrength,
    provisional: true,
  };
}

export function bandFor(score: number): ScoreBand {
  for (const threshold of BAND_THRESHOLDS) {
    if (score >= threshold.min) return threshold.band;
  }
  return "mau";
}

/**
 * Teto imposto pelo fator relevante com pior nota.
 *
 * Devolve o teto e o fator que o impôs, para que a explicação possa nomeá-lo.
 * Se nenhum fator relevante estiver abaixo de `neutralScore`, o teto é
 * `ceiling` e não limita nada.
 */
function limiterCap(factors: readonly ScoreFactor[]): {
  cap: number;
  factor: ScoreFactor | null;
} {
  const slope = (LIMITER_CAP.ceiling - LIMITER_CAP.floor) / LIMITER_CAP.neutralScore;
  let cap: number = LIMITER_CAP.ceiling;
  let factor: ScoreFactor | null = null;

  for (const f of factors) {
    if (f.score === null || f.effectiveWeight < LIMITER_CAP.minWeight) continue;
    const candidate = LIMITER_CAP.floor + slope * f.score;
    if (candidate < cap) {
      cap = candidate;
      factor = f;
    }
  }

  return { cap, factor };
}

/**
 * Explicação para quando falta peso suficiente para haver veredicto.
 *
 * Nomeia o que existe e o que falta, e recusa explicitamente a leitura de que
 * a ausência de dados signifique más condições — que é a confusão que este
 * motor existe para evitar.
 */
function buildInsufficientDataSummary(factors: readonly ScoreFactor[]): string {
  const available = factors
    .filter((f) => f.score !== null)
    .map((f) => f.label.toLowerCase());
  const missing = factors
    .filter((f) => f.score === null)
    .map((f) => f.label.toLowerCase());

  const missingText = missing.length > 0 ? ` Falta ${listPt(missing)}.` : "";

  return (
    `Só há dados para ${listPt(available)}, o que não chega para responder se vale a pena ir surfar.` +
    missingText +
    " Isto não significa que as condições sejam más — significa que não sabemos."
  );
}

/** Enumeração em PT-PT: "a", "a e b", "a, b e c". */
function listPt(items: readonly string[]): string {
  if (items.length === 0) return "nenhum fator";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]!}`;
}

function pickExtremes(factors: readonly ScoreFactor[]): {
  biggestLimiter: string | null;
  biggestStrength: string | null;
} {
  const usable = factors.filter((f) => f.score !== null);

  const strength = usable
    .filter((f) => (f.score ?? 0) >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)[0];

  const limiter = usable
    .filter((f) => (f.score ?? 10) <= LIMITER_THRESHOLD)
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)[0];

  return {
    biggestStrength: strength ? strength.label : null,
    biggestLimiter: limiter ? limiter.label : null,
  };
}

interface SummaryInput {
  spot: SurfSpot;
  hour: HourlyForecast;
  tide: TideState;
  factors: readonly ScoreFactor[];
  band: ScoreBand;
  confidence: number;
  biggestLimiter: string | null;
  biggestStrength: string | null;
  /** Fator que impôs o teto, quando o teto efetivamente baixou a pontuação. */
  cappedBy: ScoreFactor | null;
}

function buildSummary({
  spot,
  hour,
  tide,
  band,
  confidence,
  biggestLimiter,
  biggestStrength,
  cappedBy,
}: SummaryInput): string {
  const sentences: string[] = [];

  // 1. Estado do mar.
  const period = hour.swellPeriod ?? hour.wavePeriod;
  const periodIsSwell = hour.swellPeriod !== null;
  const direction = hour.swellDirection ?? hour.waveDirection;
  const seaParts: string[] = [];
  if (hour.waveHeight !== null) {
    seaParts.push(formatMeters(hour.waveHeight));
  }
  if (period !== null) {
    seaParts.push(`${formatSeconds(period)}${periodIsSwell ? " de swell" : ""}`);
  }
  if (direction !== null) {
    seaParts.push(`de ${formatDirectionShort(direction)}`);
  }
  if (seaParts.length > 0) {
    sentences.push(`Mar com ${seaParts.join(", ")}.`);
  }

  // 2. Vento.
  if (hour.windSpeed !== null) {
    const relation = hour.windDirection !== null
      ? classifyWind(
          hour.windDirection,
          spot.characteristics.beachOrientation,
          spot.characteristics.windOffshoreTolerance,
        )
      : null;
    const gust =
      hour.windGust !== null ? `, com rajadas de ${formatKmh(hour.windGust)}` : "";
    if (relation) {
      sentences.push(
        `Vento ${windRelationLabel(relation)} a ${formatKmh(hour.windSpeed)}${gust}.`,
      );
    } else {
      sentences.push(`Vento a ${formatKmh(hour.windSpeed)}${gust}.`);
    }
  }

  // 3. Maré.
  if (tide.available && tide.normalizedLevel !== null) {
    sentences.push(`Maré ${tideStageLabel(tide.stage)} em ${formatMeters(tide.height)}.`);
  }

  // 4. Veredicto.
  sentences.push(`${scoreBandLabel(band)} — ${scoreBandHint(band)}`);

  // 5. Extremos.
  if (biggestStrength) {
    sentences.push(`Ponto mais forte: ${biggestStrength.toLowerCase()}.`);
  }
  if (biggestLimiter) {
    sentences.push(`Principal limitação: ${biggestLimiter.toLowerCase()}.`);
  }

  // 6. Teto imposto por um fator isolado. Só aparece quando efetivamente
  //    baixou a pontuação — caso contrário seria ruído.
  if (cappedBy && cappedBy.score !== null) {
    sentences.push(
      `O teto desta hora é imposto por um só fator: ${cappedBy.label.toLowerCase()} em ${formatDecimal(cappedBy.score)} de 10. Uma condição assim desfavorável não é compensada por boas condições nos restantes fatores.`,
    );
  }

  // 7. Aviso de confiança.
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    sentences.push(
      `Atenção: apenas ${formatPercent(confidence * 100)} do peso da pontuação tem dados disponíveis. Interprete o resultado com cautela.`,
    );
  }

  return sentences.join(" ");
}

/* =============================================================================
   Auxiliares
   ============================================================================= */

function factorBase(key: FactorKey, label: string, weight: number): {
  key: FactorKey;
  label: string;
  weight: number;
  effectiveWeight: number;
  reading: string;
  score: number | null;
  impact: FactorImpact;
  detail: string;
} {
  return {
    key,
    label,
    weight,
    effectiveWeight: weight,
    reading: "—",
    score: null,
    impact: "indisponivel",
    detail: "",
  };
}

function impactOf(score: number): FactorImpact {
  if (score >= STRENGTH_THRESHOLD) return "positivo";
  if (score >= LIMITER_THRESHOLD) return "neutro";
  return "negativo";
}

/**
 * Fração aproximada da altura de onda atribuível a onda de vento (mar local),
 * derivada das componentes. Baseia-se na proporção das alturas, não na energia
 * exata — é um indicador qualitativo, não um cálculo espectral.
 */
export function windSeaFraction(hour: HourlyForecast): number | null {
  const wind = hour.windWaveHeight;
  const swell = hour.swellHeight;
  if (wind === null || swell === null) return null;
  const total = wind + swell;
  if (total <= 0.01) return null;
  return clamp(wind / total, 0, 1);
}

/** Média simples das pontuações, para resumos diários. */
export function averageScore(scores: readonly SurfScore[]): number | null {
  return mean(scores.map((s) => (s.band === "indisponivel" ? null : s.value)));
}

/** Cor/Rótulo auxiliar para depuração e testes. */
export function scoreBreakdownText(score: SurfScore): string {
  return score.factors
    .map(
      (f) =>
        `${f.label}: ${f.score === null ? "sem dados" : formatDecimal(f.score)} (peso ${formatDecimal(f.effectiveWeight * 100)}%)`,
    )
    .join(" | ");
}
