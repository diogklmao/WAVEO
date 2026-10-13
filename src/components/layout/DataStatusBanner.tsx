/**
 * WAVEO — estado dos dados.
 *
 * Este componente existe por causa de um requisito explícito: nunca apresentar
 * dados de demonstração como se fossem previsões reais, e nunca esconder que
 * falta informação. Por isso a hierarquia é deliberada — os dados de
 * demonstração têm o aviso mais forte da aplicação, e a indisponibilidade
 * parcial é dita por palavras em vez de ser deixada a um valor em branco.
 */

import { IconAlert, IconCheck, IconInfo } from "@/components/icons";
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
  ok: "text-signal-good",
  parcial: "text-signal-fair",
  erro: "text-signal-bad",
  desativado: "text-mist-500",
};

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
  const failedProviders = source.providers.filter(
    (provider) => provider.status === "erro" || provider.status === "parcial",
  );

  return (
    <div
      className={cx(
        "rounded-2xl border p-4",
        hasIssues
          ? "border-signal-fair/40 bg-signal-fair/8"
          : "border-abyss-500/40 bg-abyss-800/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cx(
              "mt-0.5 shrink-0",
              hasIssues ? "text-signal-fair" : "text-signal-good",
            )}
          >
            {hasIssues ? <IconInfo size={18} /> : <IconCheck size={18} />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mist-100">
              {source.stale
                ? "A mostrar os últimos dados obtidos com sucesso"
                : hasIssues
                  ? "Previsão obtida com dados incompletos"
                  : "Previsão obtida a partir dos fornecedores"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-mist-400">
              {source.stale
                ? "O fornecedor não respondeu ao pedido mais recente. Estes valores podem já estar desatualizados."
                : `Dados obtidos às ${formatPortugalTime(source.fetchedAtEpochMs)} (hora de Portugal).`}
              {source.forecastStart && source.forecastEnd
                ? ` Cobertura da previsão: ${formatCoveragePoint(source.forecastStart)} a ${formatCoveragePoint(source.forecastEnd)}.`
                : ""}
            </p>

            {source.unavailable.length > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-signal-fair">
                Sem dados para: {source.unavailable.join(", ")}. Estes fatores
                são excluídos da pontuação e o seu peso é redistribuído pelos
                restantes — não contam como condições más.
              </p>
            ) : null}

            {source.notes.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-mist-400">
                {source.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {source.providers.map((provider) => (
            <div key={provider.id} className="min-w-0">
              <dt className="font-semibold text-mist-200">{provider.name}</dt>
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
        "rounded-xl border border-abyss-500/40 bg-abyss-800/30 px-3 py-2 text-xs leading-relaxed text-mist-500",
        className,
      )}
    >
      <strong className="font-semibold text-mist-400">Metodologia provisória.</strong>{" "}
      A pontuação combina altura de onda, período, direção do swell, vento e
      maré com pesos que ainda não foram validados no terreno. Os pesos e os
      limites de cada spot são configuráveis e podem mudar.
    </p>
  );
}
