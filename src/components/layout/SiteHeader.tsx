"use client";

/**
 * WAVEO — cabeçalho.
 *
 * Barra translúcida sobre a fotografia: à direita a pesquisa de spots, os
 * atalhos de mapa e favoritos e o avatar do utilizador. A navegação principal
 * vive na barra lateral; aqui ficam as ações rápidas. É um Client Component
 * porque a pesquisa navega com o router.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconHeart, IconMap, IconSearch, IconUser } from "@/components/icons";

export function SiteHeader() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const slug = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    router.push(slug ? `/spots?buscar=${encodeURIComponent(slug)}` : "/spots");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(16,24,48,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full items-center justify-end gap-3 px-4 sm:px-6 lg:px-8">
        <form onSubmit={onSubmit} role="search" className="relative">
          <label htmlFor="waveo-search" className="sr-only">
            Procurar spot
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-mist-400"
          >
            <IconSearch size={16} />
          </span>
          <input
            id="waveo-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar spot..."
            className="w-56 rounded-full border border-white/25 bg-white/85 py-2.5 pr-4 pl-10 text-sm text-mist-100 placeholder:text-mist-400 focus-visible:outline-2 focus-visible:outline-tide-300 sm:w-72"
          />
        </form>

        <a
          href="/mapa"
          aria-label="Mapa de spots"
          className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <IconMap size={18} />
        </a>
        <a
          href="/favoritos"
          aria-label="Favoritos"
          className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <IconHeart size={18} />
        </a>
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-white/25 bg-[#12203c] text-white"
        >
          <IconUser size={18} />
        </span>
      </div>
    </header>
  );
}
