/**
 * WAVEO — introdução de página.
 *
 * Cabeçalho comum a todas as vistas interiores: sobrancelha, título, descrição
 * e, quando existe, uma ação à direita. Existe para que a hierarquia
 * tipográfica seja idêntica em todas as páginas sem a repetir.
 */

import type { ReactNode } from "react";
import { cx } from "@/components/ui/Surface";

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? <p className="label-eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="font-display text-2xl font-bold tracking-tight text-mist-50 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mist-300 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
