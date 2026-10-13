# WAVEO

Previsão de ondas e condições de surf para Portugal.

A WAVEO responde a três perguntas concretas:

1. **Vale a pena ir agora?**
2. **Qual das praias próximas está melhor?**
3. **Qual é a melhor janela para surfar nas próximas horas?**

Não é um painel meteorológico genérico. É um produto de previsão de surf: cada
número apresentado existe para ajudar a decidir se se entra na água, onde e
quando — e cada número diz de onde veio.

A aplicação está integralmente em **português de Portugal (pt-PT)**, incluindo
formatação de números (vírgula decimal), unidades e horas locais.

---

## Índice

- [Requisitos](#requisitos)
- [Instalação e arranque](#instalação-e-arranque)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Ecrãs disponíveis](#ecrãs-disponíveis)
- [Como funciona o Surf Score](#como-funciona-o-surf-score)
- [Fornecedores de dados](#fornecedores-de-dados)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [Endpoints internos](#endpoints-internos)
- [Dados de demonstração](#dados-de-demonstração)
- [Testes e verificação](#testes-e-verificação)
- [Limitações conhecidas](#limitações-conhecidas)
- [Segredos e chaves de API](#segredos-e-chaves-de-api)

---

## Requisitos

- **Node.js 20 ou superior** (a aplicação usa Next.js 15 e React 19)
- **npm** (os comandos abaixo assumem npm; pnpm ou yarn funcionam igualmente)
- Acesso à Internet: a aplicação consulta APIs públicas em tempo real

Não é necessária qualquer chave de API. Ver
[Segredos e chaves de API](#segredos-e-chaves-de-api).

---

## Instalação e arranque

```bash
# 1. Instalar dependências
npm install

# 2. Criar o ficheiro de ambiente local
#    (o .env.example não contém segredos; pode ser copiado tal como está)
cp .env.example .env.local        # Windows: copy .env.example .env.local

# 3. Arrancar em desenvolvimento
npm run dev
```

A aplicação fica disponível em <http://localhost:3000>.

O passo 2 é opcional — todos os valores têm um padrão razoável no código — mas
recomendado, porque é onde se ajusta a cache, o tempo limite dos pedidos e a
ativação dos dados de demonstração.

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento, com recarregamento a quente |
| `npm run build` | Compilação de produção |
| `npm start` | Corre a compilação de produção (requer `npm run build` antes) |
| `npm run lint` | ESLint sobre todo o projeto |
| `npm run typecheck` | Verificação de tipos com TypeScript, sem emitir ficheiros |
| `npm test` | Corre a bateria de testes uma vez |
| `npm run test:watch` | Testes em modo vigilância |

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste se precisar. **Nenhum destes
valores é obrigatório** para arrancar.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `OPEN_METEO_MARINE_BASE_URL` | `https://marine-api.open-meteo.com/v1/marine` | Endpoint da API Marine do Open-Meteo (ondas, swell, temperatura da água, nível do mar) |
| `OPEN_METEO_WEATHER_BASE_URL` | `https://api.open-meteo.com/v1/forecast` | Endpoint da API Weather do Open-Meteo (vento, rajadas, temperatura do ar, precipitação) |
| `WAVEO_CACHE_TTL_SECONDS` | `900` | Tempo de vida da cache das respostas dos fornecedores, em segundos. O Open-Meteo atualiza a cada ~15 minutos |
| `WAVEO_PROVIDER_TIMEOUT_MS` | `8000` | Tempo máximo de espera por cada pedido a um fornecedor |
| `WAVEO_FORECAST_DAYS` | `7` | Número de dias de previsão a pedir (1 a 16) |
| `WAVEO_ENABLE_DEMO_DATA` | `true` | Ativa os dados de demonstração quando **todos** os fornecedores falham. Ver [Dados de demonstração](#dados-de-demonstração) |

> **Nunca** coloque uma chave de API numa variável com o prefixo `NEXT_PUBLIC_`.
> Esse prefixo embute o valor no código enviado ao browser. Os fornecedores
> atuais não exigem chave; se adicionar um que exija, use-a apenas no servidor.

---

## Ecrãs disponíveis

| Rota | Ecrã |
| --- | --- |
| `/` | Painel inicial: spot atual, pontuação, melhor janela, condições hora a hora, gráficos e comparação com as outras praias |
| `/spots` | Todas as praias acompanhadas, ordenadas pela melhor pontuação agora |
| `/spots/<slug>` | Previsão individual de uma praia (URL canónico) |
| `/mapa` | Mapa interativo com as praias, coloridas pelo escalão de condição |
| `/favoritos` | Praias marcadas como favoritas (guardadas localmente no browser) |
| `/sobre` | Metodologia, fornecedores, licenças e limitações conhecidas |

O painel inicial aceita `?spot=<slug>` para escolher a praia. Um slug
desconhecido não provoca erro: recua para a praia predefinida (Matosinhos). Já
`/spots/<slug>` com um slug desconhecido devolve 404 — é o URL canónico.

### Praias acompanhadas

| Praia | Região | Slug |
| --- | --- | --- |
| Matosinhos | Área Metropolitana do Porto | `matosinhos` |
| Leça da Palmeira | Área Metropolitana do Porto | `leca-da-palmeira` |
| Espinho | Área Metropolitana do Porto | `espinho` |
| Peniche | Oeste | `peniche` |
| Ericeira | Grande Lisboa | `ericeira` |
| Costa da Caparica | Península de Setúbal | `costa-da-caparica` |

Cada praia tem as suas próprias características em dados estruturados — em
`src/lib/spots.ts` — que alimentam diretamente o motor de pontuação: orientação
da praia, tipo de fundo, faixa de altura navegável e faixa preferida, período
ideal, janela de swell, tolerância ao vento e sensibilidade à maré.

---

## Como funciona o Surf Score

O Surf Score é **original, explícito e configurável**. Não é uma medida
científica e não foi validado contra resultados observados — todos os pesos e
limiares são pontos de partida razoáveis, deliberadamente reunidos num único
ficheiro para poderem ser discutidos e ajustados.

Todo o motor vive em `src/lib/surf/`. A página `/sobre` **lê estes valores
diretamente do código**, pelo que a documentação mostrada ao utilizador não
pode divergir do que o motor realmente faz.

### Os cinco fatores

Cada fator é uma curva definida por pontos (`valor observado → pontuação de 0 a
10`), construída a partir das características da praia em causa. Uma mesma
ondulação não produz a mesma pontuação em todas as praias.

| Fator | Peso base | O que mede |
| --- | --- | --- |
| Altura de onda | 30 | Altura significativa face à faixa navegável e à faixa preferida daquela praia |
| Período | 18 | Período do swell face ao período ideal do spot; períodos longos demais passam a fechar os bancos |
| Direção da ondulação | 16 | Distância angular ao centro da janela de swell da praia |
| Vento | 24 | Velocidade (60 %) e direção (40 %) face à orientação da praia — terral alisa, marítimo desorganiza — mais penalização por rajadas |
| Maré | 12 × importância | Nível normalizado e estágio (subida/descida/estagnada) face ao que cada praia costuma pedir |

O peso da maré é multiplicado pela `importance` definida em cada praia, pelo que
os 12 pontos só se aplicam aos spots mais sensíveis à maré.

### O princípio central: um dado em falta não é uma condição má

Quando um fator não tem dados, ele é **excluído** do cálculo, o seu peso é
redistribuído pelos restantes e a **confiança** desce na proporção do peso
perdido. Nunca entra na média como zero.

É a diferença entre *"não sabemos"* e *"está mau"*. Abaixo de 55 % de peso
disponível, a pontuação é apresentada com um aviso explícito de que deve ser
interpretada com cautela. Quando não há dados nenhuns, o escalão é
**indisponível** — nunca `mau` — e a explicação di-lo por palavras.

Na interface, um valor indisponível aparece sempre como `—`, nunca como `0`.

### Escalões

| Pontuação | Escalão |
| --- | --- |
| 8,5 – 10 | Excelente |
| 7,0 – 8,4 | Bom |
| 5,0 – 6,9 | Razoável |
| 3,0 – 4,9 | Fraco |
| 0 – 2,9 | Mau |
| sem dados | Indisponível |

### Melhor janela para surfar

A melhor janela é o troço **contínuo** de horas com pontuação igual ou superior
a 6,5, com pelo menos 2 horas de duração, dentro de um horizonte de 72 horas
(24 horas para a "próxima janela" do painel). Se o troço for mais longo do que
8 horas, é reportado o melhor troço de 8 horas. Interrupções e horas sem dados
quebram a janela — nunca são tratadas como favoráveis nem colmatadas.

Quando nenhuma hora atinge o mínimo, a função devolve `null` e a interface diz
que não há janela, em vez de apresentar a menos má como recomendação.

---

## Fornecedores de dados

| Papel | Fornecedor | Endpoint | Licença |
| --- | --- | --- | --- |
| Ondas, swell, temperatura da água, nível do mar | Open-Meteo Marine API | `marine-api.open-meteo.com/v1/marine` | CC BY 4.0 |
| Vento, rajadas, temperatura do ar, precipitação, código de tempo | Open-Meteo Weather API | `api.open-meteo.com/v1/forecast` | CC BY 4.0 |
| Mapa de base | CARTO (dados © OpenStreetMap) | tiles de raster escuro | © OpenStreetMap contributors |

Atribuição: **dados meteorológicos e marinhos por [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0)**;
**mapa © [CARTO](https://carto.com/attributions), dados © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors**.

Nenhum destes fornecedores exige chave de API. O nível gratuito do Open-Meteo
ronda as 10 000 chamadas por dia; a WAVEO faz, no máximo, **cerca de 3 chamadas
por cada 15 minutos** (ver abaixo), muito abaixo desse limite.

### Esforço de chamadas

- As praias são pedidas **num único pedido por fornecedor**, não um por praia: o
  Open-Meteo aceita listas de coordenadas separadas por vírgulas.
- As respostas são guardadas em cache com um TTL de 15 minutos
  (`WAVEO_CACHE_TTL_SECONDS`), alinhado com a cadência de atualização do
  fornecedor.
- Se um fornecedor falhar, é servida a última resposta em cache (mesmo já
  expirada), com uma nota de desatualização na interface, em vez de um ecrã de
  erro.
- Pedidos idênticos em simultâneo são deduplicados: só um vai à rede.

### Sobre as marés — leia isto

As marés **não** vêm de um modelo astronómico. São derivadas da série de altura
do nível do mar (`sea_level_height_msl`) da API Marine do Open-Meteo, a partir
da qual a WAVEO deteta preia-mares e baixa-mares por extremos locais com
refinamento parabólico, e daí determina o estágio e o nível normalizado.

Consequências a ter em conta:

- A precisão é a do modelo do fornecedor, não a de uma tábua de marés oficial.
- **Não serve para navegação** nem para qualquer uso em que a altura da maré
  tenha de ser exata.
- Se a variável não existir para um ponto, a aplicação apresenta "maré
  indisponível" e o fator é excluído do cálculo — nunca é estimado.

A integração está isolada atrás da interface `TideProvider`
(`src/lib/providers/types.ts`), implementada em
`src/lib/providers/openmeteo-tide.ts`. Trocar para um fornecedor dedicado de
marés significa escrever uma nova implementação dessa interface e devolvê-la a
partir de `getTideProvider()`. Nada mais na aplicação precisa de mudar — nem o
motor de pontuação, nem a interface.

### Robustez das integrações

- Todas as respostas são validadas antes de entrarem no domínio.
- Existem tempos limite por pedido, com repetição e recuo exponencial.
- Se o fornecedor rejeitar um conjunto de variáveis, o pedido é refeito com
  conjuntos progressivamente menores, em vez de falhar — os campos que faltarem
  ficam a `null` e são tratados como ausentes.
- Um campo ausente é sempre `null`. Nunca é preenchido com zero, com o valor da
  hora anterior nem com uma média.

---

## Arquitetura do projeto

```
src/
  app/                     Rotas (App Router do Next.js)
    api/forecast/          API interna de previsão
    api/health/            Verificação de saúde, com modo profundo
    spots/[slug]/          Previsão individual (URL canónico)
    sobre/                 Metodologia, gerada a partir da configuração real
  components/
    ui/                    Blocos visuais reutilizáveis (superfícies, mostrador, bússola)
    charts/                Gráficos SVG próprios — sem biblioteca de gráficos
    dashboard/             Composição do painel de uma praia
    layout/                Cabeçalho, rodapé, separadores, avisos de estado
    spots/                 Cartões e listas de praias
    map/                   Mapa interativo
  hooks/                   Hooks de cliente (favoritos)
  lib/
    spots.ts               Dados estruturados das praias
    types.ts               Contrato de domínio partilhado
    time.ts                Tempo local de Portugal, sem depender do fuso do ambiente
    geo.ts                 Rumos, distâncias, classificação do vento
    format.ts              Formatação pt-PT de todos os valores
    surf/                  Motor do Surf Score
      config.ts            Todos os pesos, limiares e curvas — num só lugar
      score.ts             Cálculo e explicação da pontuação
      tides.ts             Extremos de maré, estágio e nível normalizado
      windows.ts           Deteção da melhor janela
      evaluate.ts          Avaliação de séries horárias
    providers/             Clientes dos fornecedores, substituíveis
    forecast.ts            Orquestração: pedir, juntar, avaliar, em cache
    cache.ts               Cache com TTL e reaproveitamento de respostas antigas
tests/                     Testes unitários (Vitest)
```

Princípios que o código segue:

- **A interface nunca vê formatos de fornecedor.** Cada fornecedor traduz a sua
  resposta para tipos intermédios; substituir um fornecedor não toca no motor
  nem na interface.
- **Domínio separado da apresentação.** O cálculo da pontuação, a deteção de
  marés e a procura de janelas são funções puras, testáveis sem rede.
- **O tempo de Portugal é explícito.** As regras de horário de verão da União
  Europeia (último domingo de março e de outubro, às 01:00 UTC) estão
  implementadas à mão em `time.ts`, em vez de se confiar na análise de datas do
  ambiente. Abrange Portugal continental e a Madeira; **os Açores (UTC−1) não
  estão incluídos no MVP**.
- **Gráficos próprios.** Os gráficos são SVG escritos à mão — sem dependência de
  bibliotecas de gráficos — e medem a largura real disponível em vez de esticar
  um `viewBox`, para continuarem legíveis em ecrãs pequenos.
- **Números reais no servidor.** Os componentes de gráfico que correm no
  servidor produzem séries só com números; apenas o componente de área com
  interação é de cliente.

---

## Endpoints internos

Servem a própria aplicação e podem ser consultados diretamente.

| Endpoint | Descrição |
| --- | --- |
| `GET /api/forecast` | Resumo de todas as praias, ordenado, mais a informação de proveniência |
| `GET /api/forecast?spot=<slug>` | Previsão completa e pontuada de uma praia (404 se o slug for desconhecido) |
| `GET /api/health` | Estado básico da aplicação |
| `GET /api/health?deep=1` | Estado detalhado: corre os mesmos pedidos que a aplicação faz em produção e devolve, por praia, a cobertura obtida de cada fornecedor, as coordenadas de grelha efetivamente usadas pelo modelo, uma amostra de valores e o relatório de cada fornecedor |

As respostas de `/api/forecast` trazem cabeçalhos de cache (`s-maxage` e
`stale-while-revalidate`) alinhados com o TTL configurado. Se ambos os
fornecedores essenciais falharem e não houver dados de demonstração nem uma
resposta anterior em cache, devolvem `503` com um erro tipificado, em vez de
dados inventados.

As páginas **não** consomem esta rota: sendo Server Components, chamam
diretamente `src/lib/forecast.ts`, evitando um salto HTTP na própria máquina.
A rota existe para consumo externo e para depuração, e partilha exatamente a
mesma lógica e a mesma cache.

---

## Dados de demonstração

Quando **todos** os fornecedores falham — por exemplo, sem rede — e
`WAVEO_ENABLE_DEMO_DATA=true`, a aplicação gera localmente uma série sintética
determinística para que a interface possa ser vista e avaliada.

Estes dados:

- são gerados a partir de uma semente fixa, portanto são reprodutíveis;
- aparecem **sempre** acompanhados de um aviso destacado no topo do ecrã;
- nunca são apresentados como previsão real;
- nunca substituem uma resposta parcial de um fornecedor: se um fornecedor
  responder, é a resposta real que é usada, mesmo que fique a faltar o outro.

Defina `WAVEO_ENABLE_DEMO_DATA=false` para que, sem fornecedores, a aplicação
mostre apenas o estado de erro e a explicação de que os dados não estão
disponíveis.

---

## Testes e verificação

```bash
npm run typecheck   # tipos
npm run lint        # estilo
npm test            # testes unitários
npm run build       # compilação de produção
```

Os testes cobrem o que é fácil de errar e caro de errar em silêncio:

- `curve` — interpolação por troços, limites e suavização
- `geo` — rumos, distâncias, rosa dos ventos em pt-PT (usa O, não W),
  classificação do vento face à orientação da praia
- `time` — conversão entre hora de parede de Portugal e instantes absolutos,
  incluindo os dois instantes exatos de mudança de hora e a hora que não existe
  (01:30 no início do horário de verão)
- `tides` — deteção de extremos, alternação preia/baixa, interpolação, estágios
  e o caso sem dados
- `windows` — melhor janela, recorte, horizonte, buracos nos dados e o caso em
  que não há janela nenhuma
- `score` — o motor, com ênfase em que um fator em falta custa confiança e não
  pontuação, e em que as regras são específicas de cada praia
- `merge` — alinhamento das séries dos fornecedores, com ênfase em que uma
  lacuna fica a `null` e nunca é preenchida com zero

---

## Limitações conhecidas

- **A metodologia é provisória.** Os pesos e limiares foram escolhidos para
  produzir ordenações plausíveis entre horas, praias e dias. Não foram
  validados contra observações em praia e não devem ser lidos como uma medida
  objetiva de qualidade.
- **As marés não são astronómicas.** Ver
  [Sobre as marés](#sobre-as-marés--leia-isto). Não usar para navegação.
- **As previsões são de modelo**, não observações. O Open-Meteo interpola
  grelhas de modelos globais e regionais para o ponto pedido; numa praia
  concreta, a onda que quebra pode diferir do valor de grelha.
- **Não há leitura de boias nem de câmaras.** A pontuação não sabe o que está a
  acontecer neste momento na praia.
- **Uma praia é representada por um ponto.** As coordenadas são uma referência
  ao local, não à linha de água; o mapa di-lo explicitamente.
- **Não é apresentada a hora de execução do modelo.** O Open-Meteo não a expõe.
  Em vez de inventar um valor, a interface mostra a hora em que os dados foram
  obtidos e explica a diferença.
- **Os Açores não estão incluídos.** O cálculo de hora local abrange Portugal
  continental e a Madeira.
- **As favoritas são guardadas no `localStorage`** do browser, na chave
  `waveo:favoritos:v1`. Não há contas nem sincronização entre dispositivos — por
  opção de âmbito do MVP.
- **Só seis praias estão acompanhadas.** O produto está preparado para mais: uma
  praia é uma entrada em `src/lib/spots.ts`.

### Fora do âmbito do MVP

Deliberadamente não incluído: autenticação, subscrições, pagamentos, chat com
IA e câmaras em direto.

---

## Segredos e chaves de API

- Os fornecedores atuais **não exigem chave de API**, pelo que não existe nenhum
  segredo no repositório.
- `.env.example` documenta todas as variáveis e **não contém valores reais**.
- `.gitignore` exclui `.env*`, pelo que um `.env.local` preenchido não é
  acidentalmente versionado.
- Se adicionar um fornecedor com credenciais, mantenha-as **apenas** no servidor.
  Nunca use o prefixo `NEXT_PUBLIC_` para uma chave.
- `.claude/settings.local.json` está igualmente excluído, por poder conter
  configuração e credenciais locais da ferramenta.

---

## Atribuição

Dados marinhos e meteorológicos por [Open-Meteo](https://open-meteo.com/),
licenciados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Mapa © [CARTO](https://carto.com/attributions), dados ©
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
