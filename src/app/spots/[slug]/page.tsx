/**
 * WAVEO — detalhe de um spot.
 *
 * É o URL canónico de cada praia: pode ser partilhado, indexado e guardado nos
 * favoritos. Renderiza exatamente o mesmo painel que a página inicial; a única
 * diferença é que o seletor de spots mantém o utilizador dentro de `/spots/`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpotDashboard } from "@/components/dashboard/SpotDashboard";
import { getAllSpotSummaries, getSpotForecast } from "@/lib/forecast";
import { SPOTS, getSpotBySlug } from "@/lib/spots";

// Reavaliação por pedido: os dados nunca ficam congelados na compilação.
export const revalidate = 0;

// Slugs conhecidos. Com `dynamicParams = false`, um slug fora desta lista é
// rejeitado ao nível do router — antes de qualquer renderização — e a resposta
// sai mesmo com estado 404. Sem isto, o `notFound()` seria lançado depois de o
// streaming começar (as páginas do grupo `(shell)` têm uma `loading.tsx` que
// abre uma fronteira Suspense; esta rota fica deliberadamente fora desse grupo)
// e o estado HTTP ficaria em 200. Nota: `force-dynamic` faria o router ignorar
// a lista de parâmetros — daí `revalidate = 0` em seu lugar.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return SPOTS.map((spot) => ({ slug: spot.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spot = getSpotBySlug(slug);
  // O 404 é lançado já aqui — e não só no corpo da página — para que a
  // resposta seja emitida com o estado HTTP correto.
  if (!spot) notFound();

  return {
    title: `${spot.name} — previsão de surf`,
    description: `${spot.characteristics.summary} Condições atuais e previsão hora a hora para ${spot.name}, ${spot.municipality}.`,
  };
}

export default async function SpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Aqui, ao contrário da página inicial, um slug desconhecido é mesmo um 404:
  // o URL afirma que aquele spot existe, e não existe.
  if (!getSpotBySlug(slug)) notFound();

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
      linkMode="path"
    />
  );
}
