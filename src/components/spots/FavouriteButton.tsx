"use client";

/**
 * WAVEO — botão de favorito.
 *
 * Os favoritos vivem no `localStorage`, pelo que o servidor não sabe se um spot
 * é favorito. Para evitar o efeito desagradável de um coração que aparece
 * vazio e salta para cheio depois da hidratação, o botão começa num estado
 * neutro e assume o estado real assim que o hook o conhece.
 */

import { useFavourites } from "@/hooks/useFavourites";
import { IconBookmark } from "@/components/icons";
import { cx } from "@/components/ui/Surface";

export function FavouriteButton({
  slug,
  spotName,
  variant = "icon",
  className,
}: {
  slug: string;
  spotName: string;
  variant?: "icon" | "labelled";
  className?: string;
}) {
  const { isFavourite, toggle, ready } = useFavourites();
  const active = ready && isFavourite(slug);

  const label = active
    ? `Remover ${spotName} dos favoritos`
    : `Adicionar ${spotName} aos favoritos`;

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border transition-colors",
        variant === "icon" ? "size-9 justify-center" : "px-4 py-2.5 text-sm font-medium",
        variant === "labelled"
          ? cx(
              "border-white/50 bg-white/55 text-mist-200 backdrop-blur-md hover:bg-white/70",
              active && "border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100",
            )
          : active
            ? "border-signal-bad/45 bg-signal-bad/12 text-signal-bad hover:bg-signal-bad/20"
            : "border-abyss-500/50 bg-abyss-800/50 text-mist-400 hover:border-abyss-400/70 hover:text-mist-100",
        className,
      )}
    >
      <IconBookmark
        size={variant === "icon" ? 18 : 16}
        filled={active}
        className={cx("transition-transform", active && "scale-110")}
      />
      {variant === "labelled" ? (
        <span>{active ? "Guardado" : "Guardar spot"}</span>
      ) : null}
    </button>
  );
}
