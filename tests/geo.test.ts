/**
 * Geometria angular e classificação do vento.
 *
 * A rosa dos ventos é onde é mais fácil escrever código que parece certo e
 * está errado: 350° e 10° distam 20°, não 340°. Os testes fixam essa convenção
 * e a nomenclatura em PT-PT, que é diferente da inglesa (O, não W; ONO, não
 * WNW).
 */

import { describe, expect, it } from "vitest";
import {
  angularDistance,
  circularMean,
  clamp,
  classifyWind,
  compassAbbreviation,
  compassLabel,
  compassName,
  distanceKm,
  maxOf,
  mean,
  minOf,
  normalizeDegrees,
  offshoreBearing,
  signedAngularDistance,
  windRelationLabel,
} from "@/lib/geo";

describe("normalizeDegrees", () => {
  it("traz qualquer rumo para o intervalo [0, 360)", () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(370)).toBe(10);
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(-370)).toBe(350);
    expect(normalizeDegrees(720)).toBe(0);
  });

  it("devolve 0 para entradas não finitas", () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0);
    expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("angularDistance", () => {
  it("mede sempre pelo caminho mais curto", () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(10, 350)).toBe(20);
    expect(angularDistance(0, 180)).toBe(180);
    expect(angularDistance(0, 90)).toBe(90);
    expect(angularDistance(359, 1)).toBe(2);
  });

  it("é simétrica e nunca passa de 180", () => {
    for (let a = 0; a < 360; a += 17) {
      for (let b = 0; b < 360; b += 23) {
        const ab = angularDistance(a, b);
        expect(ab).toBeCloseTo(angularDistance(b, a), 10);
        expect(ab).toBeGreaterThanOrEqual(0);
        expect(ab).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("signedAngularDistance", () => {
  it("é positiva no sentido horário", () => {
    expect(signedAngularDistance(10, 350)).toBe(20);
    expect(signedAngularDistance(90, 0)).toBe(90);
  });

  it("é negativa no sentido anti-horário", () => {
    expect(signedAngularDistance(350, 10)).toBe(-20);
    expect(signedAngularDistance(0, 90)).toBe(-90);
  });

  it("devolve 180 (nunca -180) no caso oposto", () => {
    expect(signedAngularDistance(180, 0)).toBe(180);
    expect(signedAngularDistance(0, 180)).toBe(180);
  });
});

describe("rosa dos ventos em PT-PT", () => {
  it("usa O para Oeste e não W", () => {
    expect(compassAbbreviation(270)).toBe("O");
    expect(compassName(270)).toBe("Oeste");
  });

  it("abrevia os pontos principais", () => {
    expect(compassAbbreviation(0)).toBe("N");
    expect(compassAbbreviation(90)).toBe("E");
    expect(compassAbbreviation(180)).toBe("S");
    expect(compassAbbreviation(45)).toBe("NE");
    expect(compassAbbreviation(225)).toBe("SO");
  });

  it("arredonda ao setor de 22,5° mais próximo", () => {
    expect(compassAbbreviation(292.5)).toBe("ONO");
    expect(compassAbbreviation(11)).toBe("N");
    expect(compassAbbreviation(350)).toBe("N");
    expect(compassAbbreviation(359)).toBe("N");
  });

  it("trata a ausência de direção como travessão, nunca como 0°", () => {
    expect(compassAbbreviation(null)).toBe("—");
    expect(compassAbbreviation(undefined)).toBe("—");
    expect(compassName(null)).toBe("—");
    expect(compassLabel(null)).toBe("—");
  });

  it("combina abreviatura e nome completo", () => {
    expect(compassLabel(292.5)).toBe("ONO (Oés-Noroeste)");
  });
});

describe("offshoreBearing e classifyWind", () => {
  it("o terral vem do lado oposto ao mar", () => {
    expect(offshoreBearing(270)).toBe(90);
    expect(offshoreBearing(0)).toBe(180);
    expect(offshoreBearing(180)).toBe(0);
  });

  it("classifica o vento pela relação com a orientação da praia", () => {
    // Praia virada a oeste (270°): o terral é de leste (90°).
    expect(classifyWind(90, 270)).toBe("terral");
    expect(classifyWind(60, 270)).toBe("terral");
    expect(classifyWind(270, 270)).toBe("maritimo");
    expect(classifyWind(300, 270)).toBe("maritimo");
    expect(classifyWind(0, 270)).toBe("lateral");
    expect(classifyWind(180, 270)).toBe("lateral");
  });

  it("respeita a tolerância da praia", () => {
    // A 70° do terral: dentro de uma tolerância de 80°, fora de uma de 60°.
    expect(classifyWind(160, 270, 80)).toBe("terral");
    expect(classifyWind(160, 270, 60)).toBe("lateral");
  });

  it("traduz a relação para PT-PT", () => {
    expect(windRelationLabel("terral")).toBe("terral (offshore)");
    expect(windRelationLabel("lateral")).toBe("lateral (cross-shore)");
    expect(windRelationLabel("maritimo")).toBe("marítimo (onshore)");
  });
});

describe("agregações", () => {
  it("clamp limita e trata valores não finitos", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(Number.NaN, 2, 10)).toBe(2);
  });

  it("mean ignora nulos e devolve null quando não há nada", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([1, null, 3])).toBe(2);
    expect(mean([null, undefined])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("maxOf e minOf ignoram nulos", () => {
    expect(maxOf([1, null, 5, 3])).toBe(5);
    expect(minOf([1, null, 5, 3])).toBe(1);
    expect(maxOf([null])).toBeNull();
    expect(minOf([])).toBeNull();
  });

  it("a média circular atravessa o norte sem se enganar", () => {
    expect(circularMean([350, 10])).toBeCloseTo(0, 6);
    expect(circularMean([350, 10, 0])).toBeCloseTo(0, 6);
    expect(circularMean([80, 100])).toBeCloseTo(90, 6);
    expect(circularMean([])).toBeNull();
  });
});

describe("distanceKm", () => {
  it("mede distâncias plausíveis entre praias portuguesas", () => {
    // Matosinhos -> Leça da Palmeira: cerca de 2 km.
    const matosinhos = { lat: 41.177, lon: -8.693 };
    const leca = { lat: 41.193, lon: -8.708 };
    expect(distanceKm(matosinhos, leca)).toBeGreaterThan(1.5);
    expect(distanceKm(matosinhos, leca)).toBeLessThan(3);

    // Matosinhos -> Peniche: cerca de 200 km.
    const peniche = { lat: 39.3445, lon: -9.3697 };
    expect(distanceKm(matosinhos, peniche)).toBeGreaterThan(180);
    expect(distanceKm(matosinhos, peniche)).toBeLessThan(230);
  });

  it("é zero para o mesmo ponto", () => {
    expect(distanceKm({ lat: 41.177, lon: -8.693 }, { lat: 41.177, lon: -8.693 })).toBe(0);
  });
});
