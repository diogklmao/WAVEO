/**
 * WAVEO — tempo local de Portugal.
 *
 * Estratégia: os fornecedores são consultados com `timezone=Europe/Lisbon`,
 * pelo que devolvem horas locais sem indicador de fuso (ex.: "2026-10-13T14:00").
 * Se essas strings fossem entregues diretamente a `new Date()`, o resultado
 * dependeria do fuso do browser ou do servidor. Para garantir que "14:00"
 * significa sempre 14:00 em Portugal, convertemos explicitamente entre
 * hora de parede de Portugal e instantes absolutos.
 *
 * As regras de horário de verão usadas são as da União Europeia, aplicáveis a
 * Portugal continental e à Madeira (WET/WEST): início no último domingo de
 * março às 01:00 UTC, fim no último domingo de outubro às 01:00 UTC.
 * O arquipélago dos Açores (UTC-1) não é abrangido pelo MVP.
 */

export const PORTUGAL_TIMEZONE = "Europe/Lisbon";
const HOUR_MS = 3_600_000;

/** Último domingo de um mês, às 01:00 UTC, em milissegundos. */
function lastSundayAtOneUtc(year: number, month1to12: number): number {
  // Dia 0 do mês seguinte = último dia do mês pretendido.
  const lastDay = new Date(Date.UTC(year, month1to12, 0));
  const weekday = lastDay.getUTCDay(); // 0 = domingo
  const dayOfMonth = lastDay.getUTCDate() - weekday;
  return Date.UTC(year, month1to12 - 1, dayOfMonth, 1, 0, 0, 0);
}

/** Deslocamento de Portugal face a UTC, em milissegundos, num dado instante. */
export function portugalOffsetMs(epochMs: number): number {
  const year = new Date(epochMs).getUTCFullYear();
  const dstStart = lastSundayAtOneUtc(year, 3);
  const dstEnd = lastSundayAtOneUtc(year, 10);
  const isSummer = epochMs >= dstStart && epochMs < dstEnd;
  return isSummer ? HOUR_MS : 0;
}

/** `true` quando Portugal continental está em horário de verão. */
export function isPortugalSummerTime(epochMs: number): boolean {
  return portugalOffsetMs(epochMs) !== 0;
}

/**
 * Converte uma hora de parede de Portugal ("2026-10-13T14:00") no instante
 * absoluto correspondente, em milissegundos desde a época Unix.
 */
export function portugalWallClockToEpoch(localIso: string): number {
  const parsed = parseLocalIsoParts(localIso);
  if (!parsed) return Number.NaN;
  const { year, month, day, hour, minute } = parsed;
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Primeira estimativa usando o deslocamento no instante ingénuo; uma segunda
  // passagem resolve o caso raro de a estimativa cair do outro lado de uma
  // mudança de hora.
  let epoch = naiveUtc - portugalOffsetMs(naiveUtc);
  epoch = naiveUtc - portugalOffsetMs(epoch);
  return epoch;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Analisa "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM" sem invocar o parser de datas
 * (que aplicaria o fuso local do ambiente).
 */
export function parseLocalIsoParts(value: string): LocalParts | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return { year, month, day, hour, minute };
}

/** Converte um instante absoluto numa hora de parede de Portugal. */
export function epochToPortugalParts(epochMs: number): LocalParts {
  const shifted = new Date(epochMs + portugalOffsetMs(epochMs));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Formata um instante absoluto como hora de parede de Portugal. */
export function toPortugalIso(epochMs: number, withMinutes = true): string {
  const p = epochToPortugalParts(epochMs);
  const base = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  return withMinutes ? `${base}T${pad2(p.hour)}:${pad2(p.minute)}` : base;
}

/** Data local de Portugal ("AAAA-MM-DD") de um instante absoluto. */
export function toPortugalDate(epochMs: number): string {
  return toPortugalIso(epochMs, false);
}

/** Hora local de Portugal de um instante absoluto ("14:00"). */
export function formatPortugalTime(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Hora local sem minutos quando estes são zero ("14h" ou "14h30"). */
export function formatPortugalTimeShort(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  return p.minute === 0 ? `${p.hour}h` : `${p.hour}h${pad2(p.minute)}`;
}

const WEEKDAYS_PT = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

const WEEKDAYS_PT_FULL = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Dia da semana abreviado em PT-PT ("seg"). */
export function weekdayAbbrev(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  const idx = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return WEEKDAYS_PT[idx] ?? "";
}

/** Dia da semana por extenso em PT-PT ("segunda-feira"). */
export function weekdayFull(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  const idx = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return WEEKDAYS_PT_FULL[idx] ?? "";
}

/** "13 outubro" */
export function formatDayMonth(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  return `${p.day} ${MONTHS_PT[p.month - 1] ?? ""}`;
}

/** "13 de outubro de 2026" */
export function formatLongDate(epochMs: number): string {
  const p = epochToPortugalParts(epochMs);
  return `${p.day} de ${MONTHS_PT[p.month - 1] ?? ""} de ${p.year}`;
}

/**
 * Rótulo relativo em PT-PT: "Hoje", "Amanhã", ou "seg 13 out".
 */
export function relativeDayLabel(targetEpochMs: number, nowEpochMs: number): string {
  const target = toPortugalDate(targetEpochMs);
  const today = toPortugalDate(nowEpochMs);
  const tomorrow = toPortugalDate(nowEpochMs + 86_400_000);
  if (target === today) return "Hoje";
  if (target === tomorrow) return "Amanhã";
  return `${weekdayAbbrev(targetEpochMs)} ${formatDayMonth(targetEpochMs)}`;
}

/**
 * Início do dia local de Portugal que contém `epochMs`, como instante absoluto.
 */
export function startOfPortugalDay(epochMs: number): number {
  const p = epochToPortugalParts(epochMs);
  return portugalWallClockToEpoch(
    `${p.year}-${pad2(p.month)}-${pad2(p.day)}T00:00`,
  );
}

/** Chave de dia local ("AAAA-MM-DD") para agrupar séries horárias. */
export function portugalDayKey(epochMs: number): string {
  return toPortugalDate(epochMs);
}

/**
 * Hora local de Portugal correspondente a "agora", arredondada à hora cheia.
 * Usada para alinhar o instante atual com a grelha horária dos fornecedores.
 */
export function currentPortugalHourStart(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / HOUR_MS) * HOUR_MS;
}
