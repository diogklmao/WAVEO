/**
 * WAVEO — página inicial.
 *
 * Mostra um spot de cada vez, escolhido por `?spot=slug`, e por baixo uma
 * comparação com os restantes. A razão para não ser uma lista é simples: a
 * pergunta "vale a pena ir agora?" só tem resposta concreta para uma praia
 * concreta. A comparação existe, mas depois da resposta.
 */

import { notFound } from "next/navigation";
import { SpotDashboard } from "@/components/dashboard/SpotDashboard";
import { getAllSpotSummaries, getSpotForecast } from "@/lib/forecast";
import { DEFAULT_SPOT_SLUG, SPOTS, isKnownSpotSlug } from "@/lib/spots";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = params.spot;
  const candidate = Array.isArray(requested) ? requested[0] : requested;

  // Um `?spot=` desconhecido não é um erro do utilizador a corrigir com um
  // 404: é simplesmente um valor que não conhecemos, e respondemos com o spot
  // predefinido. Já `/spots/[slug]` inexistente dá mesmo 404, porque aí o URL
  // afirma que aquele spot existe.
  const slug = candidate && isKnownSpotSlug(candidate) ? candidate : DEFAULT_SPOT_SLUG;

  const nowEpochMs = Date.now();

  const [forecast, all] = await Promise.all([
    getSpotForecast(slug, nowEpochMs),
    getAllSpotSummaries(nowEpochMs),
  ]);

  if (!forecast) notFound();

  return (
    <SpotDashboard
      forecast={forecast}
      nowEpochMs={nowEpochMs}
      allSummaries={all.summaries}
      spots={SPOTS}
      showComparison
    />
  );
}
