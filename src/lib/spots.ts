/**
 * WAVEO — spots de surf de Portugal continental.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOBRE ESTES DADOS
 * ─────────────────────────────────────────────────────────────────────────────
 * As coordenadas são pontos de referência do pico principal de cada spot, não
 * a totalidade da praia. Como a grelha dos modelos de ondas tem resolução de
 * vários quilómetros, pequenas diferenças de coordenadas não alteram a
 * previsão.
 *
 * As características de surf (alturas ideais, janela de swell, tolerância ao
 * vento, preferência de maré) são estimativas editoriais baseadas em
 * conhecimento geral dos spots e em observação corrente. NÃO são medições
 * científicas validadas nem substituem o conhecimento local. Estão reunidas
 * num único ficheiro, de forma explícita e isolada, precisamente para que
 * qualquer pessoa as possa rever e corrigir sem tocar no motor de pontuação.
 *
 * Convenções:
 *  - `beachOrientation`: rumo, em graus, para onde a praia está virada.
 *  - `swellWindow.center`: rumo de onde vem a ondulação que funciona melhor.
 *  - Vento e ondulação usam a convenção meteorológica: o valor indica de onde
 *    vêm. Assim, um vento de 90° (Este) é terral para uma praia virada a Oeste.
 */

import type { SurfSpot } from "./types";

export const SPOTS: readonly SurfSpot[] = [
  {
    id: "matosinhos",
    slug: "matosinhos",
    name: "Matosinhos",
    region: "Área Metropolitana do Porto",
    municipality: "Matosinhos",
    lat: 41.177,
    lon: -8.693,
    timezone: "Europe/Lisbon",
    reference: "Praia de Matosinhos, junto ao porto de Leixões",
    characteristics: {
      beachOrientation: 272,
      breakType: "beach",
      bottom: "areia",
      levels: ["iniciado", "intermedio", "avancado"],
      ridableWaveHeight: { min: 0.4, max: 3.0 },
      idealWaveHeight: { min: 0.9, max: 1.8 },
      idealPeriod: { min: 8, max: 13 },
      maxUsefulPeriod: 16,
      swellWindow: { center: 295, halfWidth: 45 },
      windTolerance: 28,
      windOffshoreTolerance: 65,
      tide: { level: { min: 0.2, max: 0.85 }, stages: [], importance: 0.5 },
      summary:
        "Beach break urbano e muito consistente. Funciona praticamente todo o ano e é o spot de eleição para quem está a começar na zona do Porto.",
      notes:
        "A proximidade do canhão submarino do Porto suaviza a ondulação mais forte, o que torna Matosinhos mais manso do que a ondulação de largo sugere. Nas marés de maior amplitude, os bancos de areia deslocam-se e o pico bom muda de posição.",
      hazards: [
        "Correntes de retorno junto ao molhe do porto",
        "Água fria durante todo o ano — fato completo aconselhado",
        "Bancos de areia móveis junto à foz do rio Leça",
      ],
    },
  },
  {
    id: "leca-da-palmeira",
    slug: "leca-da-palmeira",
    name: "Leça da Palmeira",
    region: "Área Metropolitana do Porto",
    municipality: "Matosinhos",
    lat: 41.193,
    lon: -8.708,
    timezone: "Europe/Lisbon",
    reference: "Praia de Leça da Palmeira, a norte da Boa Nova",
    characteristics: {
      beachOrientation: 280,
      breakType: "beach",
      bottom: "areia",
      levels: ["iniciado", "intermedio"],
      ridableWaveHeight: { min: 0.3, max: 2.0 },
      idealWaveHeight: { min: 0.6, max: 1.4 },
      idealPeriod: { min: 8, max: 12 },
      maxUsefulPeriod: 15,
      swellWindow: { center: 295, halfWidth: 40 },
      windTolerance: 22,
      windOffshoreTolerance: 60,
      tide: { level: { min: 0.3, max: 0.8 }, stages: [], importance: 0.6 },
      summary:
        "Spot abrigado e de ondas mais pequenas, muito procurado para aprendizagem e longboard. Precisa de mais ondulação do que Matosinhos para acordar.",
      notes:
        "A orientação mais noroeste e a presença de rocha a norte tornam Leça sensivelmente mais abrigada: com ondulação de noroeste pequena pode ficar praticamente flat enquanto Matosinhos tem ondas. Por ser um spot de ondas pequenas, o vento estraga as condições muito rapidamente.",
      hazards: [
        "Zonas de rocha a norte, junto à Boa Nova",
        "Ondas pequenas que escondem corrente junto à praia",
        "Vento marítimo torna rapidamente as condições inutilizáveis",
      ],
    },
  },
  {
    id: "espinho",
    slug: "espinho",
    name: "Espinho",
    region: "Área Metropolitana do Porto",
    municipality: "Espinho",
    lat: 41.0085,
    lon: -8.644,
    timezone: "Europe/Lisbon",
    reference: "Praia de Espinho, frente à baía",
    characteristics: {
      beachOrientation: 268,
      breakType: "beach",
      bottom: "areia",
      levels: ["intermedio", "avancado"],
      ridableWaveHeight: { min: 0.6, max: 3.5 },
      idealWaveHeight: { min: 1.2, max: 2.4 },
      idealPeriod: { min: 10, max: 15 },
      maxUsefulPeriod: 18,
      swellWindow: { center: 290, halfWidth: 50 },
      windTolerance: 30,
      windOffshoreTolerance: 65,
      tide: { level: { min: 0.4, max: 0.95 }, stages: ["subida", "descida"], importance: 0.8 },
      summary:
        "Beach break potente e com boa formação, um dos spots mais consistentes da costa ocidental. Ondas com força e correntes sérias.",
      notes:
        "Espinho é muito exposto: apanha praticamente toda a ondulação de oeste e noroeste. A maré faz grande diferença — com maré muito baixa a onda parte em cima de pouca água e fecha, pelo que a janela boa tende a ser de meia-mar a cheia.",
      hazards: [
        "Correntes de retorno fortes e frequentes",
        "Bancos de areia que mudam de posição ao longo da temporada",
        "Ondas que fecham em maré baixa",
        "Zona de erosão costeira — respeitar as sinalizações da praia",
      ],
    },
  },
  {
    id: "peniche",
    slug: "peniche",
    name: "Peniche",
    region: "Oeste",
    municipality: "Peniche",
    lat: 39.3445,
    lon: -9.3697,
    timezone: "Europe/Lisbon",
    reference: "Praia de Supertubos, Peniche",
    characteristics: {
      beachOrientation: 280,
      breakType: "beach",
      bottom: "areia",
      levels: ["intermedio", "avancado"],
      ridableWaveHeight: { min: 0.8, max: 4.0 },
      idealWaveHeight: { min: 1.3, max: 2.6 },
      idealPeriod: { min: 11, max: 16 },
      maxUsefulPeriod: 20,
      swellWindow: { center: 300, halfWidth: 42 },
      windTolerance: 26,
      windOffshoreTolerance: 70,
      tide: { level: { min: 0.3, max: 0.7 }, stages: ["subida"], importance: 1.0 },
      summary:
        "Um dos melhores beach breaks da Europa. Ondas ocas e rápidas sobre bancos de areia que mudam de ano para ano, palco de provas do circuito mundial.",
      notes:
        "Supertubos é muito sensível à maré: a janela boa é estreita e depende do estado dos bancos de areia nessa temporada. Noroeste é a direção de referência; ondulação de sudoeste tende a entrar mais desordenada. O vento de este e nordeste é o que limpa a onda.",
      hazards: [
        "Ondas ocas que partem em pouca água — risco de bater no fundo",
        "Bancos de areia imprevisíveis entre temporadas",
        "Encerramento frequente da praia em dias de swell grande",
        "Spot muito concorrido em dias bons",
      ],
    },
  },
  {
    id: "ericeira",
    slug: "ericeira",
    name: "Ericeira",
    region: "Oeste",
    municipality: "Mafra",
    lat: 38.9871,
    lon: -9.4197,
    timezone: "Europe/Lisbon",
    reference: "Ribeira d'Ilhas, Ericeira",
    characteristics: {
      beachOrientation: 275,
      breakType: "reef",
      bottom: "misto",
      levels: ["intermedio", "avancado"],
      ridableWaveHeight: { min: 0.7, max: 4.0 },
      idealWaveHeight: { min: 1.2, max: 2.5 },
      idealPeriod: { min: 11, max: 17 },
      maxUsefulPeriod: 20,
      swellWindow: { center: 300, halfWidth: 40 },
      windTolerance: 24,
      windOffshoreTolerance: 60,
      tide: { level: { min: 0.45, max: 0.9 }, stages: ["subida"], importance: 0.9 },
      summary:
        "Reserva Mundial de Surf, com ondas de fundo de rocha e point breaks de referência. Ribeira d'Ilhas é a onda mais acessível do conjunto.",
      notes:
        "As ondas de fundo de rocha da Ericeira são menos tolerantes ao vento do que os beach breaks: precisam de terral para estarem realmente boas. A maré controla quais os picos que funcionam — em maré baixa alguns ficam demasiado rasos e perigosos. Coxos e outras ondas de reef não são adequadas a quem não tenha experiência em fundo de rocha.",
      hazards: [
        "Fundo de rocha — quedas são significativamente mais perigosas",
        "Alguns picos ficam demasiado rasos em maré baixa",
        "Correntes fortes junto às pontas rochosas",
        "Ondas de reef exigem experiência e leitura de maré",
      ],
    },
  },
  {
    id: "costa-da-caparica",
    slug: "costa-da-caparica",
    name: "Costa da Caparica",
    region: "Área Metropolitana de Lisboa",
    municipality: "Almada",
    lat: 38.635,
    lon: -9.238,
    timezone: "Europe/Lisbon",
    reference: "Praia de São João, Costa da Caparica",
    characteristics: {
      beachOrientation: 255,
      breakType: "beach",
      bottom: "areia",
      levels: ["iniciado", "intermedio", "avancado"],
      ridableWaveHeight: { min: 0.5, max: 3.2 },
      idealWaveHeight: { min: 1.0, max: 2.0 },
      idealPeriod: { min: 9, max: 14 },
      maxUsefulPeriod: 17,
      swellWindow: { center: 275, halfWidth: 50 },
      windTolerance: 30,
      windOffshoreTolerance: 65,
      tide: { level: { min: 0.25, max: 0.8 }, stages: [], importance: 0.55 },
      summary:
        "Quilómetros de areia com dezenas de picos ao longo da costa, do CDS à Fonte da Telha. A opção mais versátil da zona de Lisboa.",
      notes:
        "A orientação da linha de costa é mais a sudoeste do que a das praias a norte, pelo que Caparica apanha melhor a ondulação de oeste e sudoeste. Como há muitos picos ao longo da praia, é normalmente possível encontrar um banco de areia abrigado mesmo em dias de vento norte.",
      hazards: [
        "Correntes de retorno frequentes, sobretudo junto aos molhes",
        "Bancos de areia irregulares que mudam com as tempestades",
        "Muitos banhistas no verão — respeitar as zonas vigiadas",
      ],
    },
  },
] as const;

/** Índice por `slug` para resolução direta a partir de rotas. */
const BY_SLUG = new Map(SPOTS.map((spot) => [spot.slug, spot]));

/** Índice por `id` para resolução a partir da API. */
const BY_ID = new Map(SPOTS.map((spot) => [spot.id, spot]));

export function getSpotBySlug(slug: string): SurfSpot | undefined {
  return BY_SLUG.get(slug);
}

export function getSpotById(id: string): SurfSpot | undefined {
  return BY_ID.get(id);
}

export function isKnownSpotSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** Spot apresentado por omissão no dashboard. */
export const DEFAULT_SPOT_SLUG = "matosinhos";

/** Lista de coordenadas pronta para pedidos multi-ponto ao Open-Meteo. */
export function spotCoordinates(): { lat: number; lon: number }[] {
  return SPOTS.map((spot) => ({ lat: spot.lat, lon: spot.lon }));
}
