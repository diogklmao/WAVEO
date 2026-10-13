/**
 * WAVEO — favoritos.
 *
 * No MVP não há autenticação, pelo que os favoritos são guardados no
 * `localStorage` do browser. Isto significa duas coisas que a interface assume
 * explicitamente:
 *
 *  - os favoritos são locais a este dispositivo e a este browser;
 *  - não são sincronizados entre dispositivos nem recuperáveis se os dados do
 *    site forem apagados.
 *
 * Quando existir autenticação, basta substituir a implementação de leitura e
 * escrita deste módulo por chamadas ao servidor. O hook `useFavourites` e os
 * componentes que o consomem não precisam de mudar.
 *
 * Todas as operações de `localStorage` estão protegidas: em janelas privadas,
 * com armazenamento bloqueado ou em pré-visualizações, o acesso pode lançar.
 * Nesses casos a aplicação funciona normalmente, apenas sem persistência.
 */

export const FAVOURITES_STORAGE_KEY = "waveo:favoritos:v1";

const EMPTY: readonly string[] = Object.freeze([]);

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const test = "__waveo_probe__";
    window.localStorage.setItem(test, "1");
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null;
}

/** Lê os favoritos guardados. Devolve sempre um array, mesmo em caso de erro. */
export function readFavourites(): string[] {
  const store = storage();
  if (!store) return [...EMPTY];
  try {
    const raw = store.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return [...EMPTY];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...EMPTY];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [...EMPTY];
  }
}

/** Escreve os favoritos. Falha em silêncio se o armazenamento não existir. */
export function writeFavourites(slugs: readonly string[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([...new Set(slugs)]));
  } catch {
    // Quota excedida ou armazenamento bloqueado: a aplicação continua sem
    // persistir, o que é preferível a rebentar.
  }
}

export function addFavourite(slug: string): string[] {
  const next = [...new Set([...readFavourites(), slug])];
  writeFavourites(next);
  return next;
}

export function removeFavourite(slug: string): string[] {
  const next = readFavourites().filter((s) => s !== slug);
  writeFavourites(next);
  return next;
}

export function toggleFavourite(slug: string): string[] {
  const current = readFavourites();
  return current.includes(slug) ? removeFavourite(slug) : addFavourite(slug);
}
