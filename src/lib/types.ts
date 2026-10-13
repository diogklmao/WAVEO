/**
 * WAVEO — modelo de domínio.
 *
 * Este ficheiro define os contratos partilhados entre fornecedores de dados,
 * motor de pontuação, camada de API e interface. Nenhum tipo aqui depende de
 * um fornecedor concreto: os clientes em `src/lib/providers` traduzem as
 * respostas externas para estes tipos.
 */

/* =============================================================================
   Spot de surf
   ============================================================================= */

export interface Range {
  min: number;
  max: number;
}

export type BreakType = "beach" | "point" | "reef";
export type BottomType = "areia" | "rocha" | "misto";
export type SurferLevel = "iniciado" | "intermedio" | "avancado";
export type TideStage = "subida" | "descida";

export interface TidePreference {
  /**
   * Nível de maré preferido, normalizado face ao intervalo do dia:
   * 0 = baixa-mar, 1 = preia-mar.
   */
  level: Range;
  /** Estágios preferidos. Lista vazia significa indiferente. */
  stages: TideStage[];
  /**
   * Importância da maré neste spot (0–1). Multiplica o peso do fator maré,
   * permitindo que praias muito sensíveis à maré (ex.: fundo de areia com
   * bancos definidos) difiram de praias que funcionam em qualquer maré.
   */
  importance: number;
}

/**
 * Características específicas de cada spot. Estes valores são o resultado de
 * conhecimento local e observação, e são deliberadamente explícitos para que
 * possam ser revistos e afinados sem tocar no motor de pontuação.
 *
 * NÃO são medições científicas validadas.
 */
export interface SpotCharacteristics {
  /** Rumo (graus, 0–360) para onde a praia está virada — normal marítima. */
  beachOrientation: number;
  breakType: BreakType;
  bottom: BottomType;
  levels: SurferLevel[];
  /** Altura de onda significativa que o spot comporta em segurança (m). */
  ridableWaveHeight: Range;
  /** Altura de onda preferida para as melhores condições (m). */
  idealWaveHeight: Range;
  /** Período de pico preferido (s). */
  idealPeriod: Range;
  /** Período a partir do qual o spot fica com demasiada energia (s). */
  maxUsefulPeriod: number;
  /** Centro da janela de swell ideal (graus) e semi-largura dessa janela. */
  swellWindow: { center: number; halfWidth: number };
  /** Velocidade do vento (km/h) acima da qual as condições degradam claramente. */
  windTolerance: number;
  /** Tolerância angular (graus) em torno do rumo offshore ideal. */
  windOffshoreTolerance: number;
  tide: TidePreference;
  /** Descrição curta do spot (PT-PT). */
  summary: string;
  /** Notas de contexto relevantes para a interpretação da pontuação. */
  notes: string;
  /** Perigos a assinalar ao utilizador. */
  hazards: string[];
}

export interface SurfSpot {
  id: string;
  slug: string;
  name: string;
  region: string;
  municipality: string;
  /** Latitude aproximada do pico de referência. */
  lat: number;
  /** Longitude aproximada do pico de referência. */
  lon: number;
  timezone: "Europe/Lisbon";
  characteristics: SpotCharacteristics;
  /**
   * Enquadramento geral do spot. As coordenadas correspondem a um ponto de
   * referência do spot e não à totalidade da praia.
   */
  reference: string;
}

/* =============================================================================
   Previsão horária (marinha + meteorológica, já alinhadas)
   ============================================================================= */

export interface HourlyForecast {
  /** Hora local de Portugal em formato ISO sem fuso: "2026-10-13T14:00". */
  time: string;
  /** Instante absoluto correspondente, em milissegundos UTC. */
  epochMs: number;

  /* --- Marinha (Open-Meteo Marine) --- */
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  swellPeriod: number | null;
  swellDirection: number | null;
  secondarySwellHeight: number | null;
  secondarySwellPeriod: number | null;
  secondarySwellDirection: number | null;
  windWaveHeight: number | null;
  windWavePeriod: number | null;
  windWaveDirection: number | null;
  seaSurfaceTemperature: number | null;
  /** Altura do nível do mar relativamente ao nível médio (m). */
  seaLevelHeight: number | null;

  /* --- Meteorológica (Open-Meteo Weather) --- */
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  airTemperature: number | null;
  apparentTemperature: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  isDay: boolean | null;

  /**
   * Fração da energia de onda atribuível ao swell (em vez de onda de vento),
   * derivada das alturas quando ambas estão disponíveis. `null` se não for
   * possível calcular. Valores baixos indicam mar revoltosa e desordenada.
   */
  swellEnergyShare: number | null;
}

/* =============================================================================
   Motor de pontuação
   ============================================================================= */

export type FactorKey =
  | "waveHeight"
  | "swellPeriod"
  | "swellDirection"
  | "wind"
  | "tide";

export type FactorImpact = "positivo" | "neutro" | "negativo" | "indisponivel";

export interface ScoreFactor {
  key: FactorKey;
  /** Nome do fator em PT-PT. */
  label: string;
  /** Leitura formatada do dado que alimentou o fator (ex.: "1,4 m"). */
  reading: string;
  /** Pontuação do fator, 0–10. `null` quando o dado não está disponível. */
  score: number | null;
  /** Peso base definido na configuração do motor. */
  weight: number;
  /** Peso efetivamente usado após redistribuição dos fatores indisponíveis. */
  effectiveWeight: number;
  impact: FactorImpact;
  /** Explicação em PT-PT de como o fator contribuiu. */
  detail: string;
  /** Fatores extra que compõem este fator (ex.: velocidade e direção do vento). */
  breakdown?: { label: string; score: number | null; reading: string }[];
}

export type ScoreBand =
  | "excelente"
  | "bom"
  | "razoavel"
  | "fraco"
  | "mau"
  | "indisponivel";

export interface SurfScore {
  /** Pontuação global 0–10, com uma casa decimal. */
  value: number;
  band: ScoreBand;
  label: string;
  /**
   * Fração do peso total suportada por dados efetivamente disponíveis (0–1).
   * Não é uma medida de qualidade das condições.
   */
  confidence: number;
  factors: ScoreFactor[];
  /** Resumo em PT-PT do motivo da pontuação. */
  summary: string;
  /** Fator que mais limitou a pontuação, se existir. */
  biggestLimiter: string | null;
  /** Fator que mais contribuiu positivamente, se existir. */
  biggestStrength: string | null;
  /** A metodologia é provisória e não validada cientificamente. */
  provisional: true;
}

/* =============================================================================
   Marés
   ============================================================================= */

export interface TideExtreme {
  /** Hora local de Portugal, ISO sem fuso. */
  time: string;
  epochMs: number;
  type: "cheia" | "baixa";
  height: number;
}

export interface TideState {
  /** `false` quando o fornecedor não devolveu dados de maré para este ponto. */
  available: boolean;
  height: number | null;
  /** Nível normalizado face ao intervalo do dia: 0 = baixa-mar, 1 = preia-mar. */
  normalizedLevel: number | null;
  stage: TideStage | "estagnada" | null;
  /** Intervalo (mínimo e máximo) observado na série disponível. */
  range: Range | null;
  nextHigh: TideExtreme | null;
  nextLow: TideExtreme | null;
  /** Motivo da indisponibilidade, em PT-PT, quando `available` é `false`. */
  reason?: string;
}

/* =============================================================================
   Melhor janela para surfar
   ============================================================================= */

export interface SurfWindow {
  start: string;
  startEpochMs: number;
  end: string;
  endEpochMs: number;
  hours: number;
  averageScore: number;
  peakScore: number;
  band: ScoreBand;
  /** Frase curta em PT-PT (ex.: "Amanhã, 07h–10h"). */
  headline: string;
}

/* =============================================================================
   Resumos diários
   ============================================================================= */

export interface DailySummary {
  /** Data local "AAAA-MM-DD". */
  date: string;
  /** Dia da semana abreviado em PT-PT (ex.: "seg"). */
  weekday: string;
  /** Rótulo curto em PT-PT (ex.: "seg 13"). */
  label: string;
  waveHeightMin: number | null;
  waveHeightMax: number | null;
  wavePeriodAvg: number | null;
  windSpeedAvg: number | null;
  windGustMax: number | null;
  windDirectionDominant: number | null;
  airTempMin: number | null;
  airTempMax: number | null;
  waterTempAvg: number | null;
  scoreAvg: number | null;
  scorePeak: number | null;
  /** Hora local do melhor momento do dia. */
  peakHour: string | null;
  peakHourScore: number | null;
  band: ScoreBand;
  confidence: number;
  /** Número de horas do dia com dados utilizáveis. */
  hoursWithData: number;
}

/* =============================================================================
   Proveniência e estado dos dados
   ============================================================================= */

export type ProviderStatus = "ok" | "parcial" | "erro" | "desativado";

export interface ProviderReport {
  id: string;
  /** Nome legível do fornecedor. */
  name: string;
  /** Que dados fornece. */
  role: string;
  endpoint: string;
  license: string;
  attribution: string;
  status: ProviderStatus;
  /** Mensagem de diagnóstico em PT-PT. */
  message?: string;
  durationMs?: number;
  /** Variáveis pedidas que o fornecedor não devolveu. */
  missingVariables?: string[];
}

/**
 * `real`      — todos os dados essenciais vieram dos fornecedores.
 * `parcial`   — alguns dados vieram de fornecedores, outros estão em falta.
 * `demo`      — nenhum dado real disponível; valores gerados localmente.
 */
export type DataMode = "real" | "parcial" | "demo";

export interface DataSourceInfo {
  mode: DataMode;
  /** Instante em que os dados foram obtidos (ISO UTC). */
  fetchedAt: string;
  fetchedAtEpochMs: number;
  /** Primeira e última hora cobertas pela previsão. */
  forecastStart: string | null;
  forecastEnd: string | null;
  timezone: string;
  providers: ProviderReport[];
  /**
   * O Open-Meteo não expõe o ciclo de execução do modelo na API pública.
   * Mantemos este campo explicitamente `false` em vez de inventar um valor.
   */
  modelRunAvailable: false;
  /** Notas de contexto a apresentar ao utilizador. */
  notes: string[];
  /** Dados que o utilizador deve saber que estão em falta. */
  unavailable: string[];
  /** `true` quando serviram dados de cache por o fornecedor estar indisponível. */
  stale: boolean;
}

/* =============================================================================
   Resultados agregados
   ============================================================================= */

/**
 * Uma hora da previsão com o estado de maré e a pontuação já calculados.
 *
 * Vive aqui, e não no motor de avaliação, porque é o formato que a interface
 * consome: a faixa horária e o painel de fatores recebem exatamente esta
 * estrutura. Defini-la no modelo de domínio evita que a camada de tipos passe a
 * depender do motor de pontuação.
 */
export interface ScoredHour {
  hour: HourlyForecast;
  tide: TideState;
  score: SurfScore;
}

export interface SpotForecast {
  spot: SurfSpot;
  /** Série horária completa devolvida pelo fornecedor (até `forecastDays`). */
  hours: HourlyForecast[];
  /** A mesma série, com maré e pontuação associadas a cada hora. */
  scored: ScoredHour[];
  /** Condições atuais no momento do pedido. */
  current: HourlyForecast | null;
  score: SurfScore;
  tide: TideState;
  tideExtremes: TideExtreme[];
  bestWindow: SurfWindow | null;
  /** Melhor janela nas próximas 24 h, para comparação rápida. */
  bestWindow24h: SurfWindow | null;
  daily: DailySummary[];
  source: DataSourceInfo;
}

export interface SpotSummary {
  spot: SurfSpot;
  current: HourlyForecast | null;
  score: SurfScore;
  tide: TideState;
  bestWindow: SurfWindow | null;
  daily: DailySummary[];
  source: DataSourceInfo;
}

/* =============================================================================
   Estado de erro normalizado
   ============================================================================= */

export interface ApiError {
  code:
    | "fora_de_cobertura"
    | "fornecedor_indisponivel"
    | "tempo_limite"
    | "limite_de_pedidos"
    | "resposta_invalida"
    | "spot_desconhecido"
    | "desconhecido";
  message: string;
  detail?: string;
  retryable: boolean;
}
