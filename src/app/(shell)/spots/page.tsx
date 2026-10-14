/**
 * WAVEO — todos os spots.
 *
 * Responde à segunda pergunta do produto: qual das praias próximas está melhor
 * agora. A ordenação é por pontuação, e os spots sem dados vão para o fim — em
 * nenhum caso para o princípio, porque "não sabemos" não é "está mau".
 */

import type { Metadata } from "next";
import { IconTrophy } from "@/components/icons";
import { DataStatusBanner } from "@/components/layout/DataStatusBanner";
import { PageIntro } from "@/components/layout/PageIntro";
import { SpotList, sortByScore } from "@/components/spots/SpotList";
import { ScoreBadge } from "@/components/ui/Surface";
import { getAllSpotSummaries } from "@/lib/forecast";
import { formatScore, scoreBandHint, scoreBandLabel } from "@/lib/format";
import { SPOTS } from "@/lib/spots";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spots",
  description:
    "As praias acompanhadas pela WAVEO, ordenadas pela pontuação de surf do momento. Matosinhos, Leça da Palmeira, Espinho, Peniche, Ericeira e Costa da Caparica.",
};

export default async function SpotsPage() {
  const nowEpochMs = Date.now();
  const { summaries, source } = await getAllSpotSummaries(nowEpochMs);
  const ordered = sortByScore(summaries);

  const best = ordered.find((summary) => summary.score.band !== "indisponivel") ?? null;
  const withData = summaries.filter((summary) => summary.score.band !== "indisponivel").length;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Comparação"
        title="Onde está melhor agora"
        description="A mesma pontuação, calculada com as características próprias de cada praia. Uma ondulação que funciona em Peniche pode não funcionar em Espinho — a orientação da praia, o tipo de fundo e a tolerância ao vento são diferentes."
      />

      <DataStatusBanner source={source} />

      {best ? (
        <section className="surface surface-accent flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="mt-0.5 shrink-0 text-tide-300">
              <IconTrophy size={22} />
            </span>
            <div className="min-w-0">
              <p className="label-eyebrow">Melhor pontuação agora</p>
              <h2 className="font-display mt-1.5 text-xl font-bold text-mist-50">
                {best.spot.name}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mist-300">
                {best.score.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-3xl font-bold text-mist-50 tabular-nums">
                {formatScore(best.score.value)}
              </p>
              <p className="text-xs text-mist-400">{scoreBandLabel(best.score.band)}</p>
            </div>
            <ScoreBadge score={best.score.value} band={best.score.band} showValue={false} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="todos-os-spots" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="todos-os-spots" className="font-display text-lg font-semibold text-mist-50">
            {SPOTS.length} spots acompanhados
          </h2>
          <p className="text-xs text-mist-500">
            {withData === SPOTS.length
              ? scoreBandHint(best?.score.band ?? "razoavel")
              : `${withData} de ${SPOTS.length} com dados disponíveis neste momento.`}
          </p>
        </div>

        <SpotList summaries={ordered} nowEpochMs={nowEpochMs} />
      </section>

      <p className="text-xs leading-relaxed text-mist-500">
        Todas as praias estão viradas a oeste, pelo que o vento favorável é, em
        quase todos os casos, de leste. Ainda assim, cada uma tem a sua própria
        janela de ondulação e o seu limite de altura — as diferenças entre
        pontuações vêm daí, não de regras genéricas aplicadas a todas.
      </p>
    </div>
  );
}
