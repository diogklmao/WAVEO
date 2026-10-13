/**
 * WAVEO — rodapé.
 *
 * Cumpre três obrigações distintas, e vale a pena mantê-las separadas na
 * leitura: atribuição dos dados (exigida pelas licenças), aviso sobre a
 * natureza provisória da pontuação, e navegação secundária.
 */

import Link from "next/link";
import { IconWave } from "@/components/icons";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-abyss-500/40 bg-abyss-950/60">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-tide-500/30 bg-tide-600/15 text-tide-300">
              <IconWave size={17} />
            </span>
            <span className="font-display text-base font-bold tracking-[0.16em] text-mist-50">
              WAVEO
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-mist-400">
            Previsão de surf para a costa portuguesa. Reúne altura e período de
            ondulação, vento e maré num único painel, e traduz esses dados numa
            pontuação que tem em conta as características de cada praia.
          </p>
        </div>

        <nav aria-label="Navegação do rodapé">
          <h2 className="label-eyebrow">Navegar</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { href: "/", label: "Início" },
              { href: "/spots", label: "Spots" },
              { href: "/mapa", label: "Mapa" },
              { href: "/favoritos", label: "Favoritos" },
              { href: "/sobre", label: "Sobre e metodologia" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-mist-400 transition-colors hover:text-tide-200"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="label-eyebrow">Dados e licenças</h2>
          <ul className="mt-4 space-y-3 text-sm text-mist-400">
            <li>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-mist-200 underline decoration-mist-600 underline-offset-2 transition-colors hover:text-tide-200"
              >
                Open-Meteo
              </a>
              <span className="block text-xs leading-relaxed">
                Modelos marinhos e meteorológicos. Licença CC BY 4.0.
              </span>
            </li>
            <li>
              <a
                href="https://carto.com/attributions"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-mist-200 underline decoration-mist-600 underline-offset-2 transition-colors hover:text-tide-200"
              >
                CARTO
              </a>
              <span className="block text-xs leading-relaxed">
                Fundo de mapa, sobre dados © OpenStreetMap.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-abyss-500/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-mist-500 sm:px-6 lg:px-8">
          <p>
            <strong className="font-semibold text-mist-400">
              A pontuação é provisória.
            </strong>{" "}
            Os pesos e limites do motor de pontuação, bem como as
            características atribuídas a cada spot, são estimativas editoriais
            que ainda não foram validadas com medições no local. Devem ser
            lidas como orientação, não como avaliação científica.
          </p>
          <p>
            A WAVEO não substitui a observação direta nem os avisos das
            autoridades marítimas. Verifique sempre as condições no local e
            respeite a sinalização da praia.
          </p>
          <p className="text-mist-600">
            © {year} WAVEO · Projeto de demonstração. Não é um serviço comercial
            de previsão.
          </p>
        </div>
      </div>
    </footer>
  );
}
