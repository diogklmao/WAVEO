/**
 * GET /api/health
 *
 * Verificação de estado da aplicação. Sem `?deep` não contacta fornecedores,
 * pelo que é adequada a monitorização frequente.
 *
 *   /api/health         -> configuração e lista de spots
 *   /api/health?deep=1  -> contacta os fornecedores e reporta o resultado
 */

import { NextResponse } from "next/server";
import {
  configuredForecastDays,
  configuredTimeoutMs,
  configuredTtlMs,
  demoDataEnabled,
} from "@/lib/cache";
import { getForecastBundleDiagnostics } from "@/lib/diagnostics";
import { SPOTS } from "@/lib/spots";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const deep = searchParams.get("deep") === "1";

  const base = {
    name: "WAVEO",
    status: "ok" as const,
    time: new Date().toISOString(),
    timezone: "Europe/Lisbon",
    spots: SPOTS.map((s) => ({ slug: s.slug, name: s.name })),
    configuration: {
      cacheTtlSeconds: Math.round(configuredTtlMs() / 1000),
      providerTimeoutMs: configuredTimeoutMs(),
      forecastDays: configuredForecastDays(),
      demoDataEnabled: demoDataEnabled(),
    },
    providers: {
      marine: "Open-Meteo Marine (sem chave)",
      weather: "Open-Meteo Weather (sem chave)",
      tide: "Open-Meteo Marine — sea_level_height_msl (sem chave)",
    },
  };

  if (!deep) {
    return NextResponse.json(base, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const diagnostics = await getForecastBundleDiagnostics();
    return NextResponse.json(
      { ...base, diagnostics },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ...base,
        status: "degraded",
        diagnostics: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
