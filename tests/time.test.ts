/**
 * Hora local de Portugal.
 *
 * A aplicação não usa o `Intl` nem a análise de datas do runtime para isto —
 * as regras de horário de verão da UE estão implementadas à mão, para que o
 * resultado seja o mesmo em qualquer Node e não dependa da base de dados de
 * fusos horários instalada. Estes testes são o que garante que a
 * implementação manual está certa.
 *
 * Em 2026: o horário de verão começa a 29 de março às 01:00 UTC e termina a
 * 25 de outubro às 01:00 UTC.
 */

import { describe, expect, it } from "vitest";
import {
  currentPortugalHourStart,
  epochToPortugalParts,
  formatDayMonth,
  formatLongDate,
  formatPortugalTime,
  formatPortugalTimeShort,
  isPortugalSummerTime,
  portugalDayKey,
  portugalOffsetMs,
  portugalWallClockToEpoch,
  relativeDayLabel,
  startOfPortugalDay,
  toPortugalDate,
  toPortugalIso,
  weekdayAbbrev,
  weekdayFull,
} from "@/lib/time";
import { HOUR_MS, pt } from "./helpers";

describe("portugalOffsetMs", () => {
  it("está em UTC+1 no verão e em UTC no inverno", () => {
    expect(portugalOffsetMs(pt("2026-07-15T12:00"))).toBe(HOUR_MS);
    expect(portugalOffsetMs(pt("2026-01-15T12:00"))).toBe(0);
  });

  it("muda exatamente na última passagem de hora de março e outubro", () => {
    const dstStart = Date.UTC(2026, 2, 29, 1, 0, 0, 0); // 29 mar 2026, 01:00 UTC
    const dstEnd = Date.UTC(2026, 9, 25, 1, 0, 0, 0); // 25 out 2026, 01:00 UTC

    expect(portugalOffsetMs(dstStart - 1)).toBe(0);
    expect(portugalOffsetMs(dstStart)).toBe(HOUR_MS);

    expect(portugalOffsetMs(dstEnd - 1)).toBe(HOUR_MS);
    expect(portugalOffsetMs(dstEnd)).toBe(0);
  });

  it("isPortugalSummerTime acompanha o deslocamento", () => {
    expect(isPortugalSummerTime(pt("2026-06-01T12:00"))).toBe(true);
    expect(isPortugalSummerTime(pt("2026-12-01T12:00"))).toBe(false);
  });
});

describe("portugalWallClockToEpoch", () => {
  it("converte a hora de parede no instante absoluto correto", () => {
    // Em outubro (ainda horário de verão), 14:00 locais são 13:00 UTC.
    expect(portugalWallClockToEpoch("2026-10-13T14:00")).toBe(
      Date.UTC(2026, 9, 13, 13, 0, 0, 0),
    );
    // Em janeiro, 14:00 locais são 14:00 UTC.
    expect(portugalWallClockToEpoch("2026-01-13T14:00")).toBe(
      Date.UTC(2026, 0, 13, 14, 0, 0, 0),
    );
  });

  it("trata a hora que não existe no início do horário de verão", () => {
    // 01:30 de 29 de março não existe em Portugal: os relógios passam de 01:00
    // para 02:00. A conversão tem de produzir algo coerente, não NaN, e a
    // segunda passagem resolve-o como se a hora já fosse de verão.
    const epoch = portugalWallClockToEpoch("2026-03-29T01:30");
    expect(Number.isFinite(epoch)).toBe(true);
    expect(epoch).toBe(Date.UTC(2026, 2, 29, 1, 30, 0, 0));
  });

  it("trata a hora repetida no fim do horário de verão", () => {
    const epoch = portugalWallClockToEpoch("2026-10-25T01:30");
    expect(Number.isFinite(epoch)).toBe(true);
    // Resolve para a segunda passagem (hora de inverno, UTC).
    expect(epoch).toBe(Date.UTC(2026, 9, 25, 1, 30, 0, 0));
  });

  it("devolve NaN para uma data inválida em vez de adivinhar", () => {
    expect(Number.isNaN(portugalWallClockToEpoch("não é uma data"))).toBe(true);
    expect(Number.isNaN(portugalWallClockToEpoch("2026-13-01T00:00"))).toBe(true);
  });

  it("faz o percurso de ida e volta sem deriva", () => {
    const wallClocks = [
      "2026-01-01T00:00",
      "2026-03-29T03:00",
      "2026-06-15T17:45",
      "2026-10-25T03:00",
      "2026-12-31T23:00",
    ];
    for (const wallClock of wallClocks) {
      const epoch = portugalWallClockToEpoch(wallClock);
      const parts = epochToPortugalParts(epoch);
      const rebuilt = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
      expect(rebuilt).toBe(wallClock);
    }
  });
});

describe("formatação de datas e horas", () => {
  it("formata a hora local a duas casas", () => {
    expect(formatPortugalTime(pt("2026-10-13T14:00"))).toBe("14:00");
    expect(formatPortugalTime(pt("2026-10-13T07:05"))).toBe("07:05");
  });

  it("encurta a hora quando os minutos são zero", () => {
    expect(formatPortugalTimeShort(pt("2026-10-13T14:00"))).toBe("14h");
    expect(formatPortugalTimeShort(pt("2026-10-13T14:30"))).toBe("14h30");
  });

  it("formata o ISO local sem fuso", () => {
    expect(toPortugalIso(pt("2026-10-13T14:00"))).toBe("2026-10-13T14:00");
    expect(toPortugalDate(pt("2026-10-13T14:00"))).toBe("2026-10-13");
    expect(portugalDayKey(pt("2026-10-13T23:30"))).toBe("2026-10-13");
  });

  it("usa os nomes dos dias e dos meses em PT-PT", () => {
    expect(weekdayAbbrev(pt("2026-10-13T12:00"))).toBe("ter");
    expect(weekdayFull(pt("2026-10-13T12:00"))).toBe("terça-feira");
    expect(formatDayMonth(pt("2026-10-13T12:00"))).toBe("13 outubro");
    expect(formatLongDate(pt("2026-10-13T12:00"))).toBe("13 de outubro de 2026");
  });

  it("rótulos relativos dizem Hoje e Amanhã", () => {
    const now = pt("2026-10-13T09:00");
    expect(relativeDayLabel(pt("2026-10-13T18:00"), now)).toBe("Hoje");
    expect(relativeDayLabel(pt("2026-10-14T06:00"), now)).toBe("Amanhã");
    expect(relativeDayLabel(pt("2026-10-16T06:00"), now)).toBe("sex 16 outubro");
  });

  it("o rótulo relativo usa o dia local de Portugal, não o dia UTC", () => {
    // 23:30 UTC de 13 de outubro ainda é 14 de outubro em Portugal (UTC+1).
    const now = pt("2026-10-13T12:00");
    const lateUtc = Date.UTC(2026, 9, 13, 23, 30, 0, 0);
    expect(toPortugalDate(lateUtc)).toBe("2026-10-14");
    expect(relativeDayLabel(lateUtc, now)).toBe("Amanhã");
  });
});

describe("startOfPortugalDay", () => {
  it("encontra a meia-noite local", () => {
    const start = startOfPortugalDay(pt("2026-10-13T14:00"));
    expect(toPortugalIso(start)).toBe("2026-10-13T00:00");
  });

  it("conta 23 horas no dia em que o horário de verão começa", () => {
    const start = startOfPortugalDay(pt("2026-03-29T12:00"));
    const next = startOfPortugalDay(pt("2026-03-30T12:00"));
    expect((next - start) / HOUR_MS).toBe(23);
  });

  it("conta 25 horas no dia em que o horário de verão termina", () => {
    const start = startOfPortugalDay(pt("2026-10-25T12:00"));
    const next = startOfPortugalDay(pt("2026-10-26T12:00"));
    expect((next - start) / HOUR_MS).toBe(25);
  });
});

describe("currentPortugalHourStart", () => {
  it("arredonda para a hora cheia, para alinhar com a grelha dos fornecedores", () => {
    const now = pt("2026-10-13T14:37");
    expect(currentPortugalHourStart(now)).toBe(pt("2026-10-13T14:00"));
    expect(currentPortugalHourStart(pt("2026-10-13T14:00"))).toBe(pt("2026-10-13T14:00"));
  });
});
