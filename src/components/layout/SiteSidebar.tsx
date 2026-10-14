"use client";

/**
 * WAVEO — barra lateral.
 *
 * Painel escuro translúcido sobre a fotografia de pôr do sol: no topo a marca
 * WAVEO em letra manuscrita, no meio a navegação com uma pílula clara na rota
 * ativa, no fundo a frase de praia manuscrita e o botão do sol. Em ecrãs
 * pequenos a barra desaparece — a navegação vive no cabeçalho.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHeart,
  IconHome,
  IconInfo,
  IconMap,
  IconMapPin,
  IconSun,
  IconWave,
} from "@/components/icons";
import { cx } from "@/components/ui/Surface";

const NAV = [
  { href: "/", label: "Início", Icon: IconHome },
  { href: "/spots", label: "Spots", Icon: IconMapPin },
  { href: "/mapa", label: "Mapa", Icon: IconMap },
  { href: "/favoritos", label: "Favoritos", Icon: IconHeart },
  { href: "/sobre", label: "Sobre", Icon: IconInfo },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-white/15 lg:flex"
      style={{
        background:
          "linear-gradient(180deg, rgba(16, 26, 52, 0.72), rgba(10, 18, 38, 0.82))",
        backdropFilter: "blur(18px) saturate(125%)",
        WebkitBackdropFilter: "blur(18px) saturate(125%)",
      }}
    >
      {/* Marca */}
      <Link
        href="/"
        className="group flex items-center gap-3 px-5 pt-6 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-tide-300"
        aria-label="WAVEO — página inicial"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-tide-200">
          <IconWave size={22} />
        </span>
        <span className="flex flex-col leading-none">
          <span className="font-script text-[1.65rem] font-bold text-white">
            WAVEO
          </span>
          <span className="mt-1 text-[0.5rem] font-semibold tracking-[0.22em] text-white/60 uppercase">
            Surf Forecast
          </span>
        </span>
      </Link>

      {/* Navegação */}
      <nav aria-label="Navegação lateral" className="flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-mist-50 shadow-[0_4px_14px_rgba(10,20,40,0.35)]"
                  : "text-white/85 hover:bg-white/12 hover:text-white",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Frase de praia + botão do sol */}
      <div className="mt-auto px-5 pb-6">
        <p className="font-script text-[0.95rem] leading-relaxed text-white/85">
          Good waves,
          <br />
          better days
          <svg
            aria-hidden="true"
            viewBox="0 0 64 12"
            className="flourish mt-1 h-3 w-16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 8 Q 12 2 22 8 T 42 8 T 62 8" />
          </svg>
        </p>
        <span
          aria-hidden="true"
          className="mt-5 grid size-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white/85"
        >
          <IconSun size={20} />
        </span>
      </div>
    </aside>
  );
}
