/**
 * WAVEO — media visual dos spots.
 *
 * Imagens decorativas servidas de `/public`: dão à interface a textura de um
 * spot real sem depender de fotografias externas nem de pedidos de rede a
 * terceiros. São SVG gerados localmente, leves e escaláveis.
 *
 * O mapa é deliberadamente tolerante em falta: um slug sem entrada cai para a
 * cena costeira por omissão, para que adicionar um spot nunca parta a página.
 */

/** Cena de pôr do sol usada no hero do spot. */
export const HERO_IMAGE = "/img/hero-coast.svg";

/** Fundo da barra lateral. */
export const SIDEBAR_IMAGE = "/img/sidebar-coast.svg";

/** Fotografia de pôr do sol que serve de fundo a toda a aplicação. */
export const PAGE_BACKGROUND = "/img/page-bg.svg";

/** Foto vertical do rail lateral (prancha de surf ao pôr do sol). */
export const RAIL_IMAGE = "/img/rail-sunset.svg";

const SPOT_THUMBS: Record<string, string> = {
  matosinhos: "/img/spots/matosinhos.svg",
  "leca-da-palmeira": "/img/spots/leca-da-palmeira.svg",
  espinho: "/img/spots/espinho.svg",
  peniche: "/img/spots/peniche.svg",
  ericeira: "/img/spots/ericeira.svg",
  "costa-da-caparica": "/img/spots/costa-da-caparica.svg",
};

/** Miniatura do seletor de spots. */
export function spotThumb(slug: string): string {
  return SPOT_THUMBS[slug] ?? HERO_IMAGE;
}
