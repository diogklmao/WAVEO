/**
 * WAVEO — painel de um spot.
 *
 * É a vista principal da aplicação e é partilhada pela página inicial e pela
 * página de detalhe de cada spot. A ordem das secções responde, por esta
 * sequência, às três perguntas do produto:
 *
 *   1. Vale a pena ir agora?      -> pontuação + condições atuais
 *   2. O que está a limitar?      -> decomposição dos fatores
 *   3. Qual é a melhor altura?    -> faixa horária + melhor janela
 *
 * A justificação vem antes da evolução horária de propósito: um número sem
 * explicação não é útil, e a explicação só faz sentido junto do número que
 * explica. Tudo o resto — gráficos, maré, previsão diária, características do
 * spot — é contexto adicional.
 */

import Link from "next/link";
import { HourlyStrip } from "@/components/charts/HourlyStrip";
import { PeriodChart, TideChart, WaveHeightChart, WindChart } from "@/components/charts/MarineCharts";
import { CurrentConditions } from "@/components/dashboard/CurrentConditions";
import { DailyForecast } from "@/components/dashboard/DailyForecast";
import { FactorBreakdown, ScoreHighlights } from "@/components/dashboard/FactorBreakdown";
import { TidePanel } from "@/components/dashboard/TidePanel";
import { IconAlert, IconArrowRight, IconEye, IconMapPin, IconWave } from "@/components/icons";
import { DataStatusBanner, MethodologyNotice } from "@/components/layout/DataStatusBanner";
import { SpotHero } from "@/components/dashboard/SpotHero";
import { SpotTabs } from "@/components/layout/SpotTabs";
import { FavouriteButton } from "@/components/spots/FavouriteButton";
import { ConfidenceMeter, ScoreDial } from "@/components/ui/ScoreDial";
import { ScoreBadge, SectionHeader, Surface, cx } from "@/components/ui/Surface";
import {
  bottomLabel,
  breakTypeLabel,
  formatMeters,
  formatMeterRange,
  formatScore,
  scoreBandLabel,
  surferLevelLabel,
} from "@/lib/format";
import { RAIL_IMAGE } from "@/lib/spot-media";
import { relativeDayLabel } from "@/lib/time";
import type { SpotForecast, SpotSummary, SurfSpot } from "@/lib/types";

export function SpotDashboard({
  forecast,
  nowEpochMs,
  allSummaries,
  spots,
  linkMode = "query",
  showComparison = false,
}: {
  forecast: SpotForecast;
  nowEpochMs: number;
  allSummaries: SpotSummary[];
  spots: readonly SurfSpot[];
  /** Mantém o seletor dentro do URL em que o utilizador está. */
  linkMode?: "query" | "path";
  showComparison?: boolean;
}) {
  const { spot, current, score, tide, tideExtremes, bestWindow, daily, hours, scored, source } =
    forecast;
  const { characteristics } = spot;

  const scoresBySlug = Object.fromEntries(
    allSummaries.map((summary) => [
      summary.spot.slug,
      { value: summary.score.value, band: summary.score.band },
    ]),
  );

  return (
    <div className="flex flex-col gap-8">
      <SpotTabs spots={spots} activeSlug={spot.slug} linkMode={linkMode} scores={scoresBySlug} />

      <SpotHero
        eyebrow={`${spot.municipality} · ${spot.region}`}
        title={spot.name}
        description={characteristics.summary}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-onphoto">
            <IconMapPin size={12} />
            {spot.lat.toFixed(4)}°N - {Math.abs(spot.lon).toFixed(4)}°O
          </span>
          <span className="chip chip-onphoto">
            {breakTypeLabel(characteristics.breakType)}
          </span>
          <span className="chip chip-onphoto">{bottomLabel(characteristics.bottom)}</span>
          {characteristics.levels.map((level) => (
            <span key={level} className="chip chip-onphoto">
              {surferLevelLabel(level)}
            </span>
          ))}
        </div>
      </SpotHero>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex min-w-0 flex-col gap-5">
      <DataStatusBanner source={source} />

      {/* ---------------------------------------------------------------- */}
      {/* 1. Vale a pena ir agora?                                          */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="agora" className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Surface accent className="flex flex-col items-center gap-5 p-6">
          <h2 id="agora" className="flex items-center gap-2 self-start text-sm font-semibold text-mist-100">
            <span className="grid size-8 place-items-center rounded-xl bg-tide-500/25 text-tide-100">
              <IconWave size={15} />
            </span>
            Pontuação de Surf
          </h2>

          <ScoreDial score={score.value} band={score.band} size={200} thickness={14} />

          <div className="w-full border-t border-abyss-500/40 pt-4">
            <ConfidenceMeter confidence={score.confidence} />
          </div>
        </Surface>



        <Surface className="p-5 sm:p-6">
          <div className="mb-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-mist-100">
              <span className="grid size-8 place-items-center rounded-xl bg-tide-500/25 text-tide-100">
                <IconEye size={15} />
              </span>
              Observado agora
            </p>
            <h2 className="font-display mt-2 text-xl font-semibold tracking-tight text-mist-50">
              Condições atuais
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
              Valores da hora em curso, na hora local de Portugal continental.
            </p>
          </div>
          <CurrentConditions spot={spot} current={current} />
        </Surface>
      </section>
        </div>

        {/* Rail direito: fotografia de praia + guardar spot */}
        <aside className="flex flex-col gap-4">
          <div
            className="relative h-[26rem] overflow-hidden rounded-[var(--radius-card)] border border-white/25 shadow-[0_18px_40px_-24px_rgba(10,16,36,0.6)]"
            style={{
              backgroundImage: `url(${RAIL_IMAGE})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <p className="font-script absolute top-5 left-5 text-lg leading-snug text-white drop-shadow-[0_1px_6px_rgba(10,16,36,0.7)]">
              Life is better
              <br />
              near the ocean
            </p>
          </div>
          <FavouriteButton
            slug={spot.slug}
            spotName={spot.name}
            variant="labelled"
            className="self-end"
          />
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. O que está a limitar?                                          */}
      {/* ---------------------------------------------------------------- */}
      <Surface className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Transparência"
          title="Como se chegou a esta pontuação"
          description="Cada fator mostra o peso que teve, a leitura que o alimentou e o efeito no resultado. Os pesos e limites são provisórios e estão centralizados num único ficheiro de configuração."
          className="mb-5"
        />

        <div className="mb-6">
          <ScoreHighlights score={score} />
        </div>

        <FactorBreakdown score={score} />
      </Surface>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Qual é a melhor altura?                                        */}
      {/* ---------------------------------------------------------------- */}
      <Surface className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Próximas horas"
          title="Evolução hora a hora"
          description="Cada coluna é uma hora: altura de onda, vento e a pontuação correspondente. Deslize para ver mais."
          className="mb-5"
        />
        <HourlyStrip scored={scored} nowEpochMs={nowEpochMs} maxHours={24} />
      </Surface>

      <div className="grid gap-5 lg:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Ondulação"
            title="Altura de onda"
            description="A faixa esverdeada é a janela que este spot prefere."
            className="mb-4"
          />
          <WaveHeightChart
            hours={hours}
            nowEpochMs={nowEpochMs}
            bestWindow={bestWindow}
            idealRange={characteristics.idealWaveHeight}
          />
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Ondulação"
            title="Período"
            description="Períodos mais longos significam ondas com mais energia e melhor formação."
            className="mb-4"
          />
          <PeriodChart
            hours={hours}
            nowEpochMs={nowEpochMs}
            idealRange={characteristics.idealPeriod}
          />
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Meteorologia"
            title="Vento"
            description="As setas indicam de onde o vento sopra. A faixa marca o limite de tolerância deste spot."
            className="mb-4"
          />
          <WindChart
            hours={hours}
            nowEpochMs={nowEpochMs}
            windTolerance={characteristics.windTolerance}
          />
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Maré"
            title="Nível do mar"
            description="MA = maré alta, MB = maré baixa. Derivado da série do fornecedor."
            className="mb-4"
          />
          <TideChart hours={hours} nowEpochMs={nowEpochMs} extremes={tideExtremes} />
        </Surface>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Surface className="p-5 sm:p-6">
          <SectionHeader eyebrow="Maré" title="Estado e extremos" className="mb-5" />
          <TidePanel tide={tide} extremes={tideExtremes} />
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Previsão alargada"
            title="Resumo diário"
            description="Médias e extremos de cada dia, a partir de agora."
            className="mb-5"
          />
          <DailyForecast daily={daily} />
        </Surface>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Características do spot                                           */}
      {/* ---------------------------------------------------------------- */}
      <Surface className="p-5 sm:p-6">
        <SectionHeader
          eyebrow="Contexto"
          title={`O que distingue ${spot.name}`}
          description="Estas características alimentam diretamente o motor de pontuação. São estimativas editoriais, ainda não validadas com medições no local."
          className="mb-5"
        />

        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Characteristic label="Tipo de fundo" value={breakTypeLabel(characteristics.breakType)} />
          <Characteristic label="Fundo" value={bottomLabel(characteristics.bottom)} />
          <Characteristic
            label="Orientação da praia"
            value={`${Math.round(characteristics.beachOrientation)}° (para o mar)`}
          />
          <Characteristic
            label="Altura que comporta"
            value={formatMeterRange(
              characteristics.ridableWaveHeight.min,
              characteristics.ridableWaveHeight.max,
            )}
          />
          <Characteristic
            label="Altura preferida"
            value={formatMeterRange(
              characteristics.idealWaveHeight.min,
              characteristics.idealWaveHeight.max,
            )}
          />
          <Characteristic
            label="Período preferido"
            value={`${characteristics.idealPeriod.min}–${characteristics.idealPeriod.max} s (máx. útil ${characteristics.maxUsefulPeriod} s)`}
          />
          <Characteristic
            label="Janela de swell"
            value={`${characteristics.swellWindow.center}° ± ${characteristics.swellWindow.halfWidth}°`}
          />
          <Characteristic
            label="Tolerância ao vento"
            value={`${characteristics.windTolerance} km/h`}
          />
          <Characteristic
            label="Níveis aconselhados"
            value={characteristics.levels.map((level) => surferLevelLabel(level)).join(", ")}
          />
        </dl>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
              Notas de interpretação
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-mist-300">{characteristics.notes}</p>
          </div>

          <div>
            <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
              Perigos a ter em conta
            </h3>
            {characteristics.hazards.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {characteristics.hazards.map((hazard) => (
                  <li key={hazard} className="flex items-start gap-2 text-sm text-mist-300">
                    <span className="mt-0.5 shrink-0 text-signal-marginal">
                      <IconAlert size={14} />
                    </span>
                    {hazard}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-mist-400">Nenhum perigo específico assinalado.</p>
            )}
          </div>
        </div>

        <p className="mt-6 border-t border-abyss-500/40 pt-4 text-xs leading-relaxed text-mist-500">
          {spot.reference}
        </p>
      </Surface>

      <MethodologyNotice />

      {showComparison ? (
        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Comparação"
            title="Onde está melhor agora"
            description="A mesma pontuação, calculada com as características próprias de cada praia. Uma ondulação que funciona numa pode não funcionar noutra."
            className="mb-5"
            action={
              <Link
                href="/spots"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-tide-300 transition-colors hover:text-tide-100"
              >
                Ver todos
                <IconArrowRight size={14} />
              </Link>
            }
          />

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allSummaries
              .filter((summary) => summary.spot.slug !== spot.slug)
              .map((summary) => (
                <li key={summary.spot.id}>
                  <Link
                    href={
                      linkMode === "query"
                        ? `/?spot=${summary.spot.slug}`
                        : `/spots/${summary.spot.slug}`
                    }
                    className={cx(
                      "surface-raised flex items-center justify-between gap-3 p-3.5 transition-colors",
                      "hover:border-tide-500/50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-mist-100">
                        {summary.spot.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mist-500">
                        {formatMeters(summary.current?.waveHeight)} ·{" "}
                        {relativeDayLabel(
                          summary.bestWindow?.startEpochMs ?? nowEpochMs,
                          nowEpochMs,
                        )}
                      </span>
                    </span>
                    <ScoreBadge score={summary.score.value} band={summary.score.band} />
                  </Link>
                </li>
              ))}
          </ul>
        </Surface>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/mapa"
          className="inline-flex items-center gap-2 rounded-xl border border-abyss-500/50 bg-abyss-800/50 px-4 py-2.5 text-sm font-medium text-mist-200 transition-colors hover:border-tide-500/50 hover:text-mist-50"
        >
          <IconWave size={16} />
          Ver no mapa
        </Link>
        <p className="text-xs text-mist-500">
          {source.mode === "demo"
            ? "A apresentar dados de demonstração."
            : `${formatScore(score.value)}/10 — ${scoreBandLabel(score.band)} · confiança ${Math.round(score.confidence * 100)} %`}
        </p>
      </div>
    </div>
  );
}

function Characteristic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-mist-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-mist-100">{value}</dd>
    </div>
  );
}
