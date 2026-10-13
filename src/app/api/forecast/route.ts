/**
 * GET /api/forecast
 *
 * Camada de API sobre a orquestração de previsão.
 *
 *   /api/forecast                -> resumo de todos os spots
 *   /api/forecast?spot=ericeira  -> previsão completa de um spot
 *
 * Nota de arquitetura: as páginas da aplicação NÃO consomem esta rota. Sendo
 * Server Components, chamam diretamente `src/lib/forecast.ts`, evitando um
 * salto HTTP desnecessário. Esta rota existe para consumo externo, para
 * depuração e para qualquer cliente que queira os mesmos dados em JSON — o
 * que garante que ambos os caminhos partilham exatamente a mesma lógica e a
 * mesma cache.
 */

import { NextResponse } from "next/server";
import { getAllSpotSummaries, getSpotForecast } from "@/lib/forecast";
import { configuredTtlMs } from "@/lib/cache";
import type { ApiError } from "@/lib/types";

export const dynamic = "force-dynamic";

function cacheHeaders(): HeadersInit {
  const seconds = Math.max(60, Math.round(configuredTtlMs() / 1000));
  return {
    "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const spotSlug = searchParams.get("spot");

  try {
    if (spotSlug) {
      const forecast = await getSpotForecast(spotSlug);

      if (!forecast) {
        return NextResponse.json(
          {
            error: {
              code: "spot_desconhecido",
              message: `O spot "${spotSlug}" não existe.`,
              retryable: false,
            } satisfies ApiError,
          },
          { status: 404 },
        );
      }

      return NextResponse.json(forecast, { headers: cacheHeaders() });
    }

    const { summaries, source } = await getAllSpotSummaries();
    return NextResponse.json({ summaries, source }, { headers: cacheHeaders() });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ocorreu um erro inesperado ao obter a previsão.";

    return NextResponse.json(
      {
        error: {
          code: "fornecedor_indisponivel",
          message: "Não foi possível obter dados dos fornecedores.",
          detail: message,
          retryable: true,
        } satisfies ApiError,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
