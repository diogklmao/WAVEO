"use client";

/**
 * WAVEO — hook de favoritos.
 *
 * Usa `useSyncExternalStore` para que todos os componentes que mostram o
 * estado de um favorito reajam ao mesmo tempo, e para que a sincronização
 * entre separadores do browser funcione sem código adicional.
 *
 * O snapshot do servidor é sempre uma lista vazia — o servidor não tem acesso
 * ao `localStorage`. É por isso que `ready` existe: até o componente montar no
 * cliente, não sabemos se um spot é favorito, e não devemos mostrar um coração
 * vazio que depois salta para cheio.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  addFavourite,
  readFavourites,
  removeFavourite,
  toggleFavourite,
} from "@/lib/favourites";

const EMPTY: readonly string[] = Object.freeze([]);
const listeners = new Set<() => void>();

let cached: string[] | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith("waveo:favoritos")) {
      cached = null;
      onStoreChange();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): string[] {
  if (cached === null) cached = readFavourites();
  return cached;
}

function getServerSnapshot(): string[] {
  // Devolve sempre a MESMA referência congelada: o React exige que o snapshot
  // do servidor seja estável, caso contrário entra em ciclo de renderização.
  return EMPTY as string[];
}

function invalidate(): void {
  cached = null;
  emit();
}

export interface UseFavouritesResult {
  favourites: string[];
  isFavourite: (slug: string) => boolean;
  toggle: (slug: string) => void;
  add: (slug: string) => void;
  remove: (slug: string) => void;
  /**
   * `false` durante a renderização no servidor e na primeira passagem no
   * cliente. Só depois de estar a `true` é que o estado dos favoritos é
   * fiável.
   */
  ready: boolean;
}

export function useFavourites(): UseFavouritesResult {
  const favourites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isFavourite = useCallback(
    (slug: string) => favourites.includes(slug),
    [favourites],
  );

  const toggle = useCallback((slug: string) => {
    toggleFavourite(slug);
    invalidate();
  }, []);

  const add = useCallback((slug: string) => {
    addFavourite(slug);
    invalidate();
  }, []);

  const remove = useCallback((slug: string) => {
    removeFavourite(slug);
    invalidate();
  }, []);

  return {
    favourites,
    isFavourite,
    toggle,
    add,
    remove,
    ready: favourites !== EMPTY,
  };
}
