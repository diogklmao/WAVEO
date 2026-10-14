/**
 * WAVEO — estado dos dados.
 *
 * Este componente existe por causa de um requisito explícito: nunca apresentar
 * dados de demonstração como se fossem previsões reais, e nunca esconder que
 * falta informação. Por isso a hierarquia é deliberada — os dados de
 * demonstração têm o aviso mais forte da aplicação, e a indisponibilidade
 * parcial é dita por palavras em vez de ser deixada a um valor em branco.
 *
 * Visualmente é um cartão de vidro claro sobre a fotografia, com linhas de onda
 * decorativas no canto e a pill "Dados em tempo real" no topo à direita.
 */

import { IconAlert, IconChart, IconInfo, IconWave } from "@/components/icons";
import { cx } from "@/components/ui/Surface";
import {
  formatDayMonth,
  formatPortugalTime,
  formatPortugalTimeShort,
  portugalWallClockToEpoch,
} from "@/lib/time";
import type { DataSourceInfo, ProviderStatus } from "@/lib/types";

/**
 * Converte uma hora de parede de Portugal vinda de `DataSourceInfo`
 * ("2026-10-13T14:00") numa frase curta para o utilizador ("13 outubro, 14h").
 * A conversão explícita é necessária: interpretar a string como UTC somaria o
 * deslocamento do horário de verão.
 */
function formatCoveragePoint(localIso: string): string {
  const epochMs = portugalWallClockToEpoch(localIso);
  if (!Number.isFinite(epochMs)) return localIso;
  return `${formatDayMonth(epochMs)}, ${formatPortugalTimeShort(epochMs)}`;
}

const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  ok: "operacional",
  parcial: "parcial",
  erro: "indisponível",
  desativado: "desativado",
};

const PROVIDER_STATUS_TONE: Record<ProviderStatus, string> = {
  ok: "text-emerald-700",
  parcial: "text-amber-700",
  erro: "text-rose-700",
  desativado: "text-mist-500",
};

/** Linhas de onda decorativas, no canto direito do cartão. */
function WaveLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 120"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-64 opacity-60"
      fill="none"
      stroke="rgba(255,255,255,0.85)"
      strokeWidth="1.5"
      strokeLinecap="round"
      preserveAspectRatio="none"
    >
      <path d="M-10 42 Q 60 18 130 42 T 270 42 T 340 38" />
      <path d="M-10 62 Q 60 40 130 62 T 270 62 T 340 58" opacity="0.7" />
      <path d="M-10 84 Q 60 64 130 84 T 270 84 T 340 80" opacity="0.45" />
    </svg>
  );
}

export function DataStatusBanner({
  source,
  className,
}: {
  source: DataSourceInfo;
  className?: string;
}) {
  if (source.mode === "demo") {
    return (
      <div
        role="alert"
        className={cx(
          "rounded-2xl border border-signal-marginal/50 bg-signal-marginal/10 p-4 sm:p-5",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-signal-marginal">
            <IconAlert size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold tracking-wide text-signal-marginal">
              Dados de demonstração — não são previsões
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
              Nenhum dos fornecedores de dados respondeu. Tudo o que vê nesta
              página foi gerado localmente para demonstrar a interface e o
              comportamento da aplicação. <strong className="font-semibold">
                Não utilize estes valores para decidir se vai surfar.
              </strong>
            </p>
            {source.notes.length > 0 ? (
              <ul className="mt-2.5 space-y-1 text-xs text-mist-400">
                {source.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const hasIssues = source.stale || source.mode === "parcial" || source.unavailable.length > 0;

  return (
    <div
      className={cx(
        "surface relative overflow-hidden",
        hasIssues && "border-signal-fair/45",
        className,
      )}
    >
      <WaveLines />

      <div className="relative">
        {/* Linha de topo: título + pill de tempo real */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cx(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                hasIssues
                  ? "bg-amber-100/80 text-amber-700"
                  : "bg-tide-500/25 text-tide-200",
              )}
            >
              {hasIssues ? <IconInfo size={16} /> : <IconWave size={16} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-mist-50">
                {source.stale
                  ? "A mostrar os últimos dados obtidos com sucesso"
                  : hasIssues
                    ? "Previsão obtida com dados incompletos"
                    : "Previsão obtida a partir dos fornecedores"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-mist-300">
                {source.stale
                  ? "O fornecedor não respondeu ao pedido mais recente. Estes valores podem já estar desatualizados."
                  : `Dados obtidos às ${formatPortugalTime(source.fetchedAtEpochMs)} (hora de Portugal).`}
                {source.forecastStart && source.forecastEnd
                  ? ` Cobertura da previsão: ${formatCoveragePoint(source.forecastStart)} a ${formatCoveragePoint(source.forecastEnd)}.`
                  : ""}
              </p>

              {source.unavailable.length > 0 ? (
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-amber-800">
                  Sem dados para: {source.unavailable.join(", ")}. Estes fatores
                  são excluídos da pontuação e o seu peso é redistribuído pelos
                  restantes — não contam como condições más.
                </p>
              ) : null}

              {source.notes.length > 0 ? (
                <ul className="mt-1.5 max-w-3xl space-y-1 text-xs leading-relaxed text-mist-400">
                  {source.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {!hasIssues ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/45 bg-white/45 px-3 py-1.5 text-xs font-semibold text-mist-200">
              <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
              Dados em tempo real
              <IconChart size={14} className="text-tide-200" />
            </span>
          ) : null}
        </div>

        {/* Linha inferior: fornecedores */}
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/25 pt-3 text-xs">
          {source.providers.map((provider) => (
            <div key={provider.id} className="min-w-0">
              <dt className="font-semibold text-mist-100">{provider.name}</dt>
              <dd className={cx("mt-0.5", PROVIDER_STATUS_TONE[provider.status])}>
                {PROVIDER_STATUS_LABEL[provider.status]}
                {provider.durationMs !== undefined
                  ? ` · ${Math.round(provider.durationMs)} ms`
                  : ""}
              </dd>
              {provider.missingVariables && provider.missingVariables.length > 0 ? (
                <dd className="mt-0.5 max-w-[16rem] text-mist-500">
                  Falta: {provider.missingVariables.join(", ")}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Aviso permanente e discreto sobre a natureza provisória da metodologia.
 * Mantém-se separado do estado dos dados porque é uma propriedade do motor de
 * pontuação, não da resposta de um fornecedor.
 */
export function MethodologyNotice({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        "surface-raised px-4 py-3 text-xs leading-relaxed text-mist-400",
        className,
      )}
    >
      <strong className="font-semibold text-mist-200">Metodologia provisória.</strong>{" "}
      A pontuação combina altura de onda, período, direção do swell, vento e
      maré com pesos que ainda não foram validados no terreno. Os pesos e os
      limites de cada spot são configuráveis e podem mudar.
    </p>
  );
}
