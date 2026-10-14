/**
 * WAVEO — mapa interativo.
 *
 * O mapa mostra a mesma pontuação que as listas, para que não haja duas
 * versões da verdade. A lista ao lado não é um acessório: é a forma de a página
 * continuar a funcionar sem WebGL e de ser navegável só com o teclado.
 */

import type { Metadata } from "next";
import { DataStatusBanner } from "@/components/layout/DataStatusBanner";
import { PageIntro } from "@/components/layout/PageIntro";
import { SpotMapPanel } from "@/components/map/SpotMapPanel";
import { getAllSpotSummaries } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mapa",
  description:
    "Mapa das praias acompanhadas pela WAVEO, com a pontuação de surf de cada uma. Selecione um marcador para ver o resumo e abrir a previsão completa.",
};

export default async function MapaPage() {
  const nowEpochMs = Date.now();
  const { summaries, source } = await getAllSpotSummaries(nowEpochMs);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Explorar"
        title="Mapa das praias"
        description="Cada marcador é uma praia e a cor indica a pontuação de surf neste momento. A escala é contínua, do vermelho ao ciano, para que a diferença entre uma praia razoável e uma praia excelente seja visível sem abrir cada uma."
      />

      <DataStatusBanner source={source} />

      <SpotMapPanel summaries={summaries} />

      <p className="text-xs leading-relaxed text-mist-500">
        A cartografia de base é servida pela CARTO sobre dados do OpenStreetMap.
        Os marcadores são posicionados a partir das coordenadas de cada praia e
        não representam a extensão do line-up nem a localização exata do pico.
      </p>
    </div>
  );
}
