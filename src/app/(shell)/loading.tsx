/**
 * WAVEO — estado de carregamento.
 *
 * A geometria das secções replica a do painel real, para que a página não salte
 * quando os dados chegam. É deliberadamente sóbrio: um esqueleto que se mexe
 * demasiado distrai mais do que informa.
 */

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">A obter a previsão…</span>

      {/* Seletor de spots */}
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="skeleton h-12 w-36 shrink-0 rounded-xl" />
        ))}
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-8 w-72 max-w-full" />
        <div className="skeleton h-4 w-full max-w-2xl" />
      </div>

      {/* Faixa de estado dos dados */}
      <div className="skeleton h-20 w-full rounded-2xl" aria-hidden="true" />

      {/* Pontuação + condições atuais */}
      <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]" aria-hidden="true">
        <div className="skeleton h-[26rem] rounded-[var(--radius-card)]" />
        <div className="skeleton h-[26rem] rounded-[var(--radius-card)]" />
      </div>

      {/* Decomposição dos fatores */}
      <div className="skeleton h-72 rounded-[var(--radius-card)]" aria-hidden="true" />

      {/* Faixa horária */}
      <div className="skeleton h-48 rounded-[var(--radius-card)]" aria-hidden="true" />

      {/* Gráficos */}
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
        <div className="skeleton h-80 rounded-[var(--radius-card)]" />
        <div className="skeleton h-80 rounded-[var(--radius-card)]" />
        <div className="skeleton h-80 rounded-[var(--radius-card)]" />
        <div className="skeleton h-80 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
