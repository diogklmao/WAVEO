/**
 * WAVEO — favoritos.
 *
 * Os favoritos vivem no `localStorage` deste browser, pelo que a página tem de
 * entregar todas as previsões ao cliente e deixar a filtragem acontecer lá. É
 * a razão pela qual esta lista não faz pedidos próprios: marcar ou desmarcar um
 * spot é instantâneo e não gasta quota de fornecedor.
 */

import type { Metadata } from "next";
import { DataStatusBanner } from "@/components/layout/DataStatusBanner";
import { PageIntro } from "@/components/layout/PageIntro";
import { FavouritesBoard } from "@/components/spots/FavouritesBoard";
import { getAllSpotSummaries } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Favoritos",
  description:
    "As praias que guardou, com a pontuação de surf do momento. Os favoritos ficam guardados neste dispositivo.",
};

export default async function FavoritosPage() {
  const nowEpochMs = Date.now();
  const { summaries, source } = await getAllSpotSummaries(nowEpochMs);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="O seu conjunto"
        title="Favoritos"
        description="Uma lista curta das praias que lhe interessam, ordenada pela pontuação do momento. Guardar um spot não envia nada para nenhum servidor — fica apenas neste browser."
      />

      <DataStatusBanner source={source} />

      <FavouritesBoard summaries={summaries} nowEpochMs={nowEpochMs} />
    </div>
  );
}
