/**
 * Motor do Surf Score.
 *
 * A regra mais importante do motor — e a que estes testes fixam — é que um
 * dado em falta não é uma condição má. Um fator sem dados é retirado do
 * cálculo, o seu peso é redistribuído e a confiança desce; nunca entra na
 * média como zero. É a diferença entre "não sabemos" e "está mau", e é
 * exatamente a confusão que o produto não pode fazer.
 */

import { describe, expect, it } from "vitest";
import { bandFor, computeSurfScore } from "@/lib/surf/score";
import { DEFAULT_WEIGHTS } from "@/lib/surf/config";
import type { HourlyForecast, SurfSpot } from "@/lib/types";
import { makeHour, noTide, pt, spot, tideState } from "./helpers";

const NOW = pt("2026-10-13T12:00");
const MATOSINHOS = spot("matosinhos");

/** Mar bom para Matosinhos: dentro das faixas ideais e com terral fraco. */
const GOOD_SEA: Partial<HourlyForecast> = {
  waveHeight: 1.4,
  wavePeriod: 11,
  waveDirection: 295,
  swellHeight: 1.2,
  swellPeriod: 11,
  swellDirection: 295,
  windWaveHeight: 0.2,
  seaSurfaceTemperature: 16.5,
  airTemperature: 17,
  weatherCode: 1,
  isDay: true,
};

const GOOD_WIND: Partial<HourlyForecast> = {
  windSpeed: 8,
  windGust: 12,
  windDirection: 90,
};

function scoreAt(
  overrides: Partial<HourlyForecast>,
  surfSpot: SurfSpot = MATOSINHOS,
  tide = tideState(),
) {
  return computeSurfScore({
    spot: surfSpot,
    hour: makeHour(NOW, overrides),
    tide,
  });
}

describe("computeSurfScore com dados completos", () => {
  const score = scoreAt({ ...GOOD_SEA, ...GOOD_WIND });

  it("produz uma pontuação dentro do intervalo 0–10", () => {
    expect(score.value).toBeGreaterThanOrEqual(0);
    expect(score.value).toBeLessThanOrEqual(10);
  });

  it("reconhece condições boas para este spot", () => {
    expect(score.value).toBeGreaterThan(8);
    expect(score.band).toBe("excelente");
  });

  it("avalia os cinco fatores e considera-os todos disponíveis", () => {
    expect(score.factors).toHaveLength(5);
    expect(score.factors.map((f) => f.key)).toEqual([
      "waveHeight",
      "swellPeriod",
      "swellDirection",
      "wind",
      "tide",
    ]);
    for (const factor of score.factors) {
      expect(factor.score).not.toBeNull();
      expect(factor.impact).not.toBe("indisponivel");
    }
  });

  it("tem confiança total quando nada falta", () => {
    expect(score.confidence).toBeCloseTo(1, 10);
  });

  it("os pesos efetivos somam 1", () => {
    const total = score.factors.reduce((sum, f) => sum + f.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("assinala sempre a metodologia como provisória", () => {
    expect(score.provisional).toBe(true);
  });

  it("explica-se por palavras, em PT-PT", () => {
    expect(score.summary.length).toBeGreaterThan(20);
    expect(score.summary).toContain("Mar com");
    expect(score.summary).toContain("Vento");
  });

  it("identifica o ponto mais forte e a maior limitação", () => {
    expect(score.biggestStrength).not.toBeNull();
    expect(score.biggestLimiter).toBeNull();
  });
});

describe("um dado em falta não é uma condição má", () => {
  const complete = scoreAt({ ...GOOD_SEA, ...GOOD_WIND });
  const withoutWind = scoreAt({ ...GOOD_SEA });
  const withBadWind = scoreAt({
    ...GOOD_SEA,
    windSpeed: 90,
    windGust: 130,
    windDirection: 270,
  });

  it("um vento genuinamente mau baixa a pontuação", () => {
    expect(withBadWind.value).toBeLessThan(complete.value);
    expect(withBadWind.value).toBeLessThan(withoutWind.value);
  });

  it("um vento ausente não baixa a pontuação", () => {
    expect(withoutWind.value).toBeGreaterThanOrEqual(complete.value - 0.1);
    expect(withoutWind.value).toBeGreaterThan(withBadWind.value);
  });

  it("um vento ausente custa confiança, não pontuação", () => {
    expect(withoutWind.confidence).toBeLessThan(complete.confidence);
  });

  it("o fator sem dados é excluído e o seu peso vai para zero", () => {
    const wind = withoutWind.factors.find((f) => f.key === "wind")!;
    expect(wind.score).toBeNull();
    expect(wind.impact).toBe("indisponivel");
    expect(wind.effectiveWeight).toBe(0);
    expect(wind.weight).toBeGreaterThan(0);

    // O peso base continua a contar para o denominador da confiança.
    const totalBase = withoutWind.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(withoutWind.confidence).toBeCloseTo(1 - wind.weight / totalBase, 10);
  });

  it("os pesos efetivos dos restantes voltam a somar 1", () => {
    const total = withoutWind.factors.reduce((sum, f) => sum + f.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("computeSurfScore sem dados nenhuns", () => {
  const score = scoreAt({}, MATOSINHOS, noTide());

  it("devolve o escalão indisponível, e não o escalão mau", () => {
    expect(score.band).toBe("indisponivel");
    expect(score.band).not.toBe("mau");
    expect(score.confidence).toBe(0);
  });

  it("não atribui peso nenhum a nenhum fator", () => {
    for (const factor of score.factors) {
      expect(factor.effectiveWeight).toBe(0);
      expect(factor.score).toBeNull();
      expect(factor.impact).toBe("indisponivel");
      expect(factor.reading).toBe("—");
    }
  });

  it("explica que a ausência de dados não significa condições más", () => {
    expect(score.summary).toContain("não significa que as condições sejam más");
  });
});

describe("a maré indisponível é excluída, não assumida", () => {
  const withTide = scoreAt({ ...GOOD_SEA, ...GOOD_WIND }, MATOSINHOS, tideState());
  const withoutTide = scoreAt({ ...GOOD_SEA, ...GOOD_WIND }, MATOSINHOS, noTide());

  it("o fator maré fica indisponível e com peso zero", () => {
    const tide = withoutTide.factors.find((f) => f.key === "tide")!;
    expect(tide.score).toBeNull();
    expect(tide.effectiveWeight).toBe(0);
    expect(tide.detail.length).toBeGreaterThan(0);
  });

  it("a confiança desce na proporção do peso da maré nesse spot", () => {
    expect(withoutTide.confidence).toBeLessThan(withTide.confidence);
    const tideWeight = withoutTide.factors.find((f) => f.key === "tide")!.weight;
    const totalBase = withoutTide.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(withoutTide.confidence).toBeCloseTo(1 - tideWeight / totalBase, 10);
  });
});

describe("as regras são específicas de cada spot", () => {
  it("a mesma ondulação não produz a mesma pontuação em todas as praias", () => {
    const peniche = spot("peniche");
    const heights = [0.4, 0.7, 1.0, 1.4, 1.9, 2.4, 3.0];

    const differs = heights.some((waveHeight) => {
      const atMatosinhos = scoreAt({ ...GOOD_SEA, ...GOOD_WIND, waveHeight });
      const atPeniche = scoreAt({ ...GOOD_SEA, ...GOOD_WIND, waveHeight }, peniche);
      return atMatosinhos.value !== atPeniche.value;
    });

    expect(differs).toBe(true);
  });

  it("a altura ideal de cada spot é a que pontua melhor nesse spot", () => {
    // O "demasiado grande" tem de ficar fora da curva de todos os spots.
    // A curva cai a zero em `ridableWaveHeight.max * 1.6`, que no spot mais
    // tolerante (Peniche, 4,0 m) dá 6,4 m — daí a margem de 8 m em vez de 4,
    // que ainda deixava Peniche e Ericeira a pontuar acima de zero.
    for (const slug of [
      "matosinhos",
      "leca-da-palmeira",
      "espinho",
      "peniche",
      "ericeira",
      "costa-da-caparica",
    ]) {
      const surfSpot = spot(slug);
      const ideal = surfSpot.characteristics.idealWaveHeight;
      const centre = (ideal.min + ideal.max) / 2;

      const atCentre = scoreAt(
        { ...GOOD_SEA, ...GOOD_WIND, waveHeight: centre },
        surfSpot,
      );
      const wayTooBig = scoreAt(
        { ...GOOD_SEA, ...GOOD_WIND, waveHeight: centre + 8 },
        surfSpot,
      );

      expect(atCentre.value).toBeGreaterThan(wayTooBig.value);
    }
  });

  it("o limite de altura navegável de cada spot é respeitado", () => {
    for (const slug of [
      "matosinhos",
      "leca-da-palmeira",
      "espinho",
      "peniche",
      "ericeira",
      "costa-da-caparica",
    ]) {
      const surfSpot = spot(slug);
      const ridableMax = surfSpot.characteristics.ridableWaveHeight.max;

      // Uma onda bem acima do dobro do limite navegável não pode continuar a
      // ser tratada como uma opção naquele spot.
      const absurd = scoreAt(
        { ...GOOD_SEA, ...GOOD_WIND, waveHeight: ridableMax * 2 },
        surfSpot,
      );
      const waveFactor = absurd.factors.find((f) => f.key === "waveHeight")!;
      expect(waveFactor.score).toBe(0);
      expect(waveFactor.impact).toBe("negativo");
    }
  });
});

describe("a direção do vento é relativa à praia, não ao norte", () => {
  // Matosinhos enfrenta 272°, logo o terral perfeito vem de 92°.
  const atMatosinhos = spot("matosinhos");

  /** Sub-pontuação de direção do fator vento, com vento suficiente para contar. */
  function directionSubScore(windDirection: number): number {
    const wind = scoreAt(
      { ...GOOD_SEA, windSpeed: 32, windGust: 32, windDirection },
      atMatosinhos,
    ).factors.find((f) => f.key === "wind")!;
    const entry = wind.breakdown!.find((b) => b.label === "Direção")!;
    return entry.score!;
  }

  it("o rumo perfeitamente terral recebe a melhor direção de todas", () => {
    // Se a curva da direção fosse indexada pelo rumo bruto do vento, um vento
    // de norte (0°) receberia o fator máximo e o terral verdadeiro seria
    // penalizado. É exatamente esse o erro que este teste fixa.
    const terral = directionSubScore(92);
    for (const bearing of [0, 45, 135, 180, 225, 272, 315]) {
      expect(terral).toBeGreaterThan(directionSubScore(bearing));
    }
  });

  it("um vento terral pontua acima do mesmo vento marítimo", () => {
    const terral = scoreAt(
      { ...GOOD_SEA, windSpeed: 20, windGust: 20, windDirection: 92 },
      atMatosinhos,
    );
    const maritimo = scoreAt(
      { ...GOOD_SEA, windSpeed: 20, windGust: 20, windDirection: 272 },
      atMatosinhos,
    );

    const terralWind = terral.factors.find((f) => f.key === "wind")!.score!;
    const maritimoWind = maritimo.factors.find((f) => f.key === "wind")!.score!;

    expect(terralWind).toBeGreaterThan(maritimoWind);
    expect(terral.value).toBeGreaterThan(maritimo.value);
  });
});

describe("bandFor", () => {
  it("classifica nos limites exatos dos escalões", () => {
    expect(bandFor(10)).toBe("excelente");
    expect(bandFor(8.5)).toBe("excelente");
    expect(bandFor(8.4)).toBe("bom");
    expect(bandFor(7)).toBe("bom");
    expect(bandFor(6.9)).toBe("razoavel");
    expect(bandFor(5)).toBe("razoavel");
    expect(bandFor(4.9)).toBe("fraco");
    expect(bandFor(3)).toBe("fraco");
    expect(bandFor(2.9)).toBe("mau");
    expect(bandFor(0)).toBe("mau");
  });
});

describe("configuração dos pesos", () => {
  it("os pesos base são todos positivos", () => {
    for (const weight of Object.values(DEFAULT_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
    }
  });

  it("o peso da maré depende da importância definida para o spot", () => {
    // Leça dá mais importância à maré do que Matosinhos.
    const matosinhosTide = scoreAt({ ...GOOD_SEA, ...GOOD_WIND })
      .factors.find((f) => f.key === "tide")!.weight;
    const lecaTide = scoreAt({ ...GOOD_SEA, ...GOOD_WIND }, spot("leca-da-palmeira"))
      .factors.find((f) => f.key === "tide")!.weight;

    expect(lecaTide).not.toBe(matosinhosTide);
    expect(matosinhosTide).toBeCloseTo(DEFAULT_WEIGHTS.tide * 0.5, 10);
    expect(lecaTide).toBeCloseTo(DEFAULT_WEIGHTS.tide * 0.6, 10);
  });
});
