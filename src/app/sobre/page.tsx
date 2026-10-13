/**
 * WAVEO — sobre.
 *
 * Esta página existe para cumprir um requisito do produto e não por cortesia:
 * a pontuação só é útil se for possível perceber de onde vem. Aqui estão os
 * pesos reais, lidos diretamente da configuração do motor, para que não
 * existam dois conjuntos de números — um no código e outro na documentação —
 * que se possam desencontrar.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { IconExternal, IconInfo } from "@/components/icons";
import { MethodologyNotice } from "@/components/layout/DataStatusBanner";
import { PageIntro } from "@/components/layout/PageIntro";
import { Surface, cx } from "@/components/ui/Surface";
import { scoreBandLabel } from "@/lib/format";
import {
  BAND_THRESHOLDS,
  BEST_WINDOW_CONFIG,
  DEFAULT_WEIGHTS,
  LIMITER_CAP,
  LOW_CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE_FOR_SCORE,
  WIND_DIRECTION_SHARE,
  WIND_SPEED_SHARE,
} from "@/lib/surf/config";
import { SPOTS } from "@/lib/spots";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "Como funciona a pontuação de surf da WAVEO, de que forma os dados em falta são tratados, que fornecedores são usados e quais são as limitações conhecidas.",
};

const FACTOR_DESCRIPTIONS: { key: keyof typeof DEFAULT_WEIGHTS; label: string; text: string }[] = [
  {
    key: "waveHeight",
    label: "Altura de onda",
    text: "A altura significativa é comparada com a faixa que aquela praia comporta e com a faixa que ela prefere. Uma onda grande demais para o spot desce a pontuação tanto como uma onda pequena demais — os dois extremos deixam de ser uma opção.",
  },
  {
    key: "wind",
    label: "Vento",
    text: "A velocidade é lida em função da tolerância da própria praia, e não em valor absoluto, e a direção é comparada com o rumo de vento terral dessa praia. Um vento fraco torna a direção quase irrelevante.",
  },
  {
    key: "swellPeriod",
    label: "Período da ondulação",
    text: "Períodos longos transportam mais energia e organizam melhor a onda. Acima do limite útil do spot a descida é suave de propósito: período longo nunca é tratado como condição má, apenas como menos adequado àquela praia.",
  },
  {
    key: "swellDirection",
    label: "Direção da ondulação",
    text: "Medida como distância angular ao centro da janela de swell da praia. Há um patamar generoso no centro — pequenas variações não mudam nada — e uma queda rápida fora dele.",
  },
  {
    key: "tide",
    label: "Maré",
    text: "O nível normalizado dentro do intervalo do dia é comparado com as fases de maré que aquela praia prefere. A importância da maré é definida spot a spot: num beach break de areia pesa mais do que num fundo rochoso profundo.",
  },
];

const PROVIDERS = [
  {
    name: "Open-Meteo Marine API",
    role: "Altura, período e direção de onda; swell primário e secundário; onda de vento; temperatura da superfície do mar; nível do mar.",
    endpoint: "https://marine-api.open-meteo.com/v1/marine",
    license: "CC BY 4.0",
    href: "https://open-meteo.com/en/docs/marine-weather-api",
  },
  {
    name: "Open-Meteo Weather API",
    role: "Velocidade e direção do vento, rajadas, temperatura do ar, precipitação, nebulosidade e estado do tempo.",
    endpoint: "https://api.open-meteo.com/v1/forecast",
    license: "CC BY 4.0",
    href: "https://open-meteo.com/en/docs",
  },
  {
    name: "CARTO + OpenStreetMap",
    role: "Cartografia de base do mapa interativo.",
    endpoint: "https://basemaps.cartocdn.com",
    license: "© OpenStreetMap contributors, © CARTO",
    href: "https://carto.com/attributions",
  },
];

const LIMITATIONS = [
  "A pontuação não foi validada com observações no terreno. Os pesos e limiares são pontos de partida plausíveis, não resultados de um estudo.",
  "As previsões de ondulação são de modelo, não observações. Em praias com batimetria complexa — desembocaduras, barras, fundões — o erro local pode ser grande.",
  "Os extremos de maré são derivados da série de nível do mar do fornecedor por deteção de extremos locais. Não vêm de um modelo astronómico dedicado e não devem ser usados para navegação.",
  "O Open-Meteo não expõe a hora de execução do modelo na API pública. A WAVEO mostra a hora em que obteve os dados em vez de inventar uma hora de execução.",
  "A resolução do modelo é de vários quilómetros. Duas praias a poucos quilómetros de distância partilham grande parte do sinal meteorológico; as diferenças entre elas vêm sobretudo das características de cada uma.",
  "As características de cada praia — orientação, fundo, tolerância ao vento, janela de swell — são estimativas editoriais, não medições.",
];

export default function SobrePage() {
  const totalWeight = Object.values(DEFAULT_WEIGHTS).reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Metodologia e dados"
        title="Sobre a WAVEO"
        description="A WAVEO responde a três perguntas concretas: vale a pena surfar agora, qual das praias próximas está melhor e qual é a melhor altura do dia. Tudo o que se segue existe para tornar essas respostas verificáveis em vez de opacas."
      />

      <MethodologyNotice />

      {/* ------------------------------------------------------------------ */}
      <Surface className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-mist-50">
          Como é calculada a pontuação
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist-300">
          Cada hora é avaliada em cinco fatores. Cada fator devolve uma nota de
          0 a 10 através de uma curva — não de um limiar binário — e a
          pontuação final é a média dessas notas ponderada pelos pesos abaixo.
          As curvas de altura, período, direção e vento são construídas a partir
          dos limites de cada praia, pelo que a mesma ondulação produz
          pontuações diferentes em praias diferentes.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mist-300">
          A média ponderada, sozinha, tem um problema conhecido: como a altura,
          o período e a direção somam entre si mais peso do que o vento, uma
          hora de swell perfeito com vento marítimo muito forte ainda pontuava
          acima de 7 — e uma hora sem onda nenhuma, mas com tudo o resto ideal,
          valia 7,6. Por isso existe um{" "}
          <strong className="font-semibold text-mist-100">teto por fator isolado</strong>.
          Um fator com peso relevante que valha {LIMITER_CAP.neutralScore} ou
          menos limita a pontuação da hora: se esse fator valer 0, a hora não
          passa de {LIMITER_CAP.floor.toFixed(1).replace(".", ",")}; se valer{" "}
          {LIMITER_CAP.neutralScore}, o teto é {LIMITER_CAP.ceiling} e deixa de
          ter qualquer efeito. Entre os dois extremos o teto sobe de forma
          linear, pelo que a regra é contínua e não cria saltos. Fatores com
          peso efetivo inferior a {Math.round(LIMITER_CAP.minWeight * 100)} % —
          a maré num spot pouco sensível, por exemplo — não podem impor o teto.
          Quando o teto entra em ação, a explicação da hora nomeia o fator
          responsável.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Pesos de cada fator na pontuação final e descrição do que mede.
            </caption>
            <thead>
              <tr className="border-b border-abyss-500/50 text-left">
                <th scope="col" className="py-2 pr-4 text-xs font-semibold tracking-wide text-mist-500 uppercase">
                  Fator
                </th>
                <th scope="col" className="py-2 pr-4 text-right text-xs font-semibold tracking-wide text-mist-500 uppercase">
                  Peso base
                </th>
                <th scope="col" className="py-2 text-xs font-semibold tracking-wide text-mist-500 uppercase">
                  O que mede
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-abyss-500/30">
              {FACTOR_DESCRIPTIONS.map((factor) => (
                <tr key={factor.key}>
                  <th scope="row" className="py-3 pr-4 text-left align-top font-semibold text-mist-100">
                    {factor.label}
                  </th>
                  <td className="py-3 pr-4 text-right align-top font-mono tabular-nums text-mist-200">
                    {DEFAULT_WEIGHTS[factor.key]} %
                  </td>
                  <td className="py-3 align-top text-xs leading-relaxed text-mist-400">
                    {factor.text}
                    {factor.key === "wind" ? (
                      <span className="mt-1 block text-mist-500">
                        Repartido em {Math.round(WIND_SPEED_SHARE * 100)} % velocidade e{" "}
                        {Math.round(WIND_DIRECTION_SHARE * 100)} % direção.
                      </span>
                    ) : null}
                    {factor.key === "tide" ? (
                      <span className="mt-1 block text-mist-500">
                        Multiplicado pela importância da maré em cada praia, pelo que
                        os {DEFAULT_WEIGHTS.tide} % só se aplicam aos spots mais sensíveis.
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-mist-500">
          Soma dos pesos base: {totalWeight} %. A normalização é feita em cada
          avaliação, pelo que alterar um peso não obriga a reajustar os outros.
        </p>
      </Surface>

      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-mist-50">
            Dados em falta
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-mist-300">
            Um dado em falta nunca é tratado como uma condição má. Quando um
            fator não tem dados, é retirado do cálculo e o seu peso é
            redistribuído proporcionalmente pelos restantes. O resultado é uma
            pontuação calculada apenas com o que se sabe.
          </p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-mist-300">
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tide-400" />
              <span>
                A <strong className="font-semibold text-mist-100">confiança</strong> indica
                que fração do peso total estava disponível. Abaixo de{" "}
                {Math.round(LOW_CONFIDENCE_THRESHOLD * 100)} % a pontuação é
                apresentada com um aviso explícito.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tide-400" />
              <span>
                Abaixo de{" "}
                {Math.round(MIN_CONFIDENCE_FOR_SCORE * 100)} % não é apresentado
                veredicto nenhum: a hora aparece como indisponível e a página diz
                o que falta. É o caso de o fornecedor marinho estar em baixo —
                com o vento e a maré sozinhos não se responde a &quot;vale a pena
                ir?&quot;.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tide-400" />
              <span>
                Um valor indisponível aparece como <strong className="font-semibold text-mist-100">—</strong>{" "}
                e nunca como 0. Zero é uma medição; o traço é a ausência dela.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tide-400" />
              <span>
                Se nenhum fornecedor responder e os dados de demonstração
                estiverem ativos, toda a página é marcada de forma inequívoca
                como demonstração.
              </span>
            </li>
          </ul>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-mist-50">
            Escalões e melhor janela
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {BAND_THRESHOLDS.map((threshold, index) => {
              const next = BAND_THRESHOLDS[index - 1];
              return (
                <li key={threshold.band} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-mist-200">{scoreBandLabel(threshold.band)}</span>
                  <span className="font-mono text-xs tabular-nums text-mist-400">
                    {next ? `${threshold.min.toFixed(1)} – ${next.min.toFixed(1)}` : `≥ ${threshold.min.toFixed(1)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-mist-300">
            A melhor janela é o troço contínuo mais forte dentro do horizonte de{" "}
            {BEST_WINDOW_CONFIG.horizonHours} horas, exigindo pelo menos{" "}
            {BEST_WINDOW_CONFIG.minHours} horas consecutivas com pontuação igual
            ou superior a {BEST_WINDOW_CONFIG.minScore}. Quando existe um troço
            melhor com mais de {BEST_WINDOW_CONFIG.maxHours} horas, é indicada a
            parte central desse troço em vez do dia inteiro.
          </p>
        </Surface>
      </div>

      {/* ------------------------------------------------------------------ */}
      <Surface className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-mist-50">
          Fornecedores de dados
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist-300">
          Os dados vêm de serviços públicos e sem chave de API. Nenhuma
          credencial é necessária para executar a aplicação tal como está, e
          nenhuma chave é alguma vez enviada para o browser. As integrações
          estão isoladas atrás de uma interface própria, para que um fornecedor
          possa ser substituído sem tocar na interface gráfica.
        </p>

        <ul className="mt-5 grid gap-4 lg:grid-cols-3">
          {PROVIDERS.map((provider) => (
            <li key={provider.name} className="surface-raised flex flex-col gap-2 p-4">
              <h3 className="text-sm font-semibold text-mist-100">{provider.name}</h3>
              <p className="text-xs leading-relaxed text-mist-400">{provider.role}</p>
              <p className="mt-auto pt-2 font-mono text-[0.6875rem] break-all text-mist-500">
                {provider.endpoint}
              </p>
              <p className="text-[0.6875rem] text-mist-500">{provider.license}</p>
              <a
                href={provider.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-tide-300 transition-colors hover:text-tide-100"
              >
                Documentação
                <IconExternal size={12} />
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-mist-500">
          Os dados do Open-Meteo são disponibilizados ao abrigo da licença
          Creative Commons Attribution 4.0, que exige atribuição — cumprida no
          rodapé de todas as páginas e nesta secção.
        </p>
      </Surface>

      {/* ------------------------------------------------------------------ */}
      <Surface className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-mist-50">
          Limitações conhecidas
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {LIMITATIONS.map((limitation) => (
            <li key={limitation} className="flex gap-3 text-sm leading-relaxed text-mist-300">
              <span className="mt-0.5 shrink-0 text-signal-fair">
                <IconInfo size={16} />
              </span>
              {limitation}
            </li>
          ))}
        </ul>
      </Surface>

      {/* ------------------------------------------------------------------ */}
      <Surface className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-mist-50">
          As praias acompanhadas
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist-300">
          Seis praias de Portugal continental, todas viradas a oeste, mas com
          características distintas — é isso que faz a pontuação divergir entre
          elas nas mesmas horas.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SPOTS.map((spot) => (
            <li key={spot.id}>
              <Link
                href={`/spots/${spot.slug}`}
                className={cx(
                  "surface-raised flex h-full flex-col gap-1.5 p-4 transition-colors",
                  "hover:border-tide-500/50",
                )}
              >
                <span className="text-sm font-semibold text-mist-100">{spot.name}</span>
                <span className="text-[0.6875rem] tracking-wide text-mist-500 uppercase">
                  {spot.region}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-mist-400">
                  {spot.characteristics.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Surface>

      <p className="text-xs leading-relaxed text-mist-500">
        Esta página descreve a metodologia e não contém previsões, pelo que não
        muda com os dados. As previsões em si são atualizadas no máximo a cada
        15 minutos, nas páginas de cada praia e nas listas de comparação.
      </p>
    </div>
  );
}
