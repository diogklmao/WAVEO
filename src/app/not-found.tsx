/**
 * WAVEO — página não encontrada.
 *
 * Uma praia que não existe é um caso plausível: os URLs são partilháveis e
 * escrever mal um slug é fácil. Em vez de um erro genérico, mostramos os spots
 * que existem.
 */

import Link from "next/link";
import { IconWave } from "@/components/icons";
import { PageIntro } from "@/components/layout/PageIntro";
import { SPOTS } from "@/lib/spots";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Erro 404"
        title="Esta página não existe"
        description="O endereço que abriu não corresponde a nenhuma praia nem a nenhuma secção da WAVEO. Se veio de uma ligação partilhada, é possível que o spot tenha sido removido ou que o nome esteja escrito de outra forma."
      />

      <section aria-labelledby="spots-disponiveis" className="flex flex-col gap-4">
        <h2 id="spots-disponiveis" className="font-display text-lg font-semibold text-mist-50">
          Praias disponíveis
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SPOTS.map((spot) => (
            <li key={spot.id}>
              <Link
                href={`/spots/${spot.slug}`}
                className="surface surface-interactive flex items-center gap-3 p-4"
              >
                <span className="text-tide-300">
                  <IconWave size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-mist-100">
                    {spot.name}
                  </span>
                  <span className="block truncate text-xs text-mist-500">{spot.region}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-tide-400/50 bg-tide-600/15 px-4 py-2.5 text-sm font-semibold text-tide-100 transition-colors hover:bg-tide-600/25"
        >
          Voltar ao início
        </Link>
        <Link
          href="/mapa"
          className="inline-flex items-center gap-2 rounded-xl border border-abyss-500/50 bg-abyss-800/50 px-4 py-2.5 text-sm font-medium text-mist-200 transition-colors hover:border-tide-500/50 hover:text-mist-50"
        >
          Abrir o mapa
        </Link>
      </div>
    </div>
  );
}
