"use client";

/**
 * WAVEO — fronteira de erro.
 *
 * Cobre o caso mais provável de falha total: nenhum fornecedor respondeu e os
 * dados de demonstração estão desativados. A mensagem diz isso por palavras em
 * vez de mostrar uma pilha de exceção, e oferece as duas saídas que realmente
 * resolvem o problema — tentar de novo ou ver outra praia.
 */

import Link from "next/link";
import { useEffect } from "react";
import { IconAlert, IconWave } from "@/components/icons";
import { SPOTS } from "@/lib/spots";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O Next já registou o erro no servidor. Aqui só o tornamos visível durante
    // o desenvolvimento, sem o apresentar ao utilizador em produção.
    if (process.env.NODE_ENV !== "production") {
      console.error("WAVEO — erro na renderização:", error);
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-8">
      <div className="surface surface-accent flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-signal-bad/40 bg-signal-bad/10 text-signal-bad">
          <IconAlert size={22} />
        </span>

        <div>
          <p className="label-eyebrow">Falha ao preparar a página</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-mist-50">
            Não foi possível obter a previsão
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
            A causa mais provável é que os fornecedores de dados não tenham
            respondido e não exista nenhuma previsão recente em cache para
            apresentar. Em qualquer dos casos, isto é uma falha de acesso aos
            dados — não significa que o mar esteja mau.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-400">
            Verifique a ligação à Internet e tente novamente dentro de alguns
            minutos. Se o problema persistir, os dados de demonstração podem ser
            ativados definindo <code className="font-mono text-xs text-tide-200">WAVEO_ENABLE_DEMO_DATA=true</code>{" "}
            no ficheiro de ambiente — nesse caso, toda a aplicação fica
            marcada como demonstração.
          </p>
        </div>

        {error.digest ? (
          <p className="font-mono text-[0.6875rem] text-mist-500">
            Referência do erro: {error.digest}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-tide-400/50 bg-tide-600/15 px-4 py-2.5 text-sm font-semibold text-tide-100 transition-colors hover:bg-tide-600/25"
          >
            Tentar novamente
          </button>
          <Link
            href="/sobre"
            className="inline-flex items-center gap-2 rounded-xl border border-abyss-500/50 bg-abyss-800/50 px-4 py-2.5 text-sm font-medium text-mist-200 transition-colors hover:border-tide-500/50 hover:text-mist-50"
          >
            Como funcionam os dados
          </Link>
        </div>
      </div>

      <section aria-labelledby="alternativas" className="flex flex-col gap-4">
        <h2 id="alternativas" className="font-display text-lg font-semibold text-mist-50">
          Enquanto isso
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-mist-400">
          As páginas de cada praia partilham a mesma fonte de dados, por isso é
          provável que também não respondam neste momento. Ainda assim, pode
          abrir qualquer uma delas para tentar de novo.
        </p>

        <ul className="flex flex-wrap gap-2">
          {SPOTS.map((spot) => (
            <li key={spot.id}>
              <Link
                href={`/spots/${spot.slug}`}
                className="inline-flex items-center gap-2 rounded-xl border border-abyss-500/50 bg-abyss-800/40 px-3 py-2 text-sm text-mist-200 transition-colors hover:border-tide-500/50 hover:text-mist-50"
              >
                <IconWave size={14} />
                {spot.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
