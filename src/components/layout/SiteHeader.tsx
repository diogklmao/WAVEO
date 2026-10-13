"use client";

/**
 * WAVEO — cabeçalho.
 *
 * Barra fixa com fundo translúcido. É um Client Component por uma única razão:
 * precisa de saber qual é a rota ativa para marcar o separador atual. Todo o
 * conteúdo é navegação, pelo que não há dados a passar pela fronteira.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu, IconWave } from "@/components/icons";
import { cx } from "@/components/ui/Surface";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/spots", label: "Spots" },
  { href: "/mapa", label: "Mapa" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/sobre", label: "Sobre" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o painel móvel sempre que a rota muda, para não ficar aberto por cima
  // da página nova.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-abyss-500/40 bg-abyss-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-tide-400"
          aria-label="WAVEO — página inicial"
        >
          <span className="flex size-9 items-center justify-center rounded-xl border border-tide-500/30 bg-tide-600/15 text-tide-300 transition-colors group-hover:border-tide-400/50 group-hover:text-tide-200">
            <IconWave size={20} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-[0.16em] text-mist-50">
              WAVEO
            </span>
            <span className="mt-0.5 hidden text-[0.625rem] font-medium tracking-[0.12em] text-mist-500 uppercase sm:block">
              Previsão de ondas · Portugal
            </span>
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-tide-600/15 text-tide-200"
                        : "text-mist-300 hover:bg-abyss-700/50 hover:text-mist-50",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="waveo-mobile-nav"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-abyss-500/50 text-mist-200 transition-colors hover:bg-abyss-700/50 md:hidden"
        >
          {open ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </div>

      {open ? (
        <nav
          id="waveo-mobile-nav"
          aria-label="Navegação principal (móvel)"
          className="border-t border-abyss-500/40 bg-abyss-950/95 px-4 pt-2 pb-4 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-tide-600/15 text-tide-200"
                        : "text-mist-300 hover:bg-abyss-700/50 hover:text-mist-50",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
