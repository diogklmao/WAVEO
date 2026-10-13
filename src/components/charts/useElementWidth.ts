"use client";

/**
 * WAVEO — medição de largura de um elemento.
 *
 * Os gráficos são desenhados em coordenadas de pixel reais, e não esticados a
 * partir de um `viewBox` fixo. A razão é simples: com um `viewBox` fixo, as
 * etiquetas dos eixos encolhem até ficarem ilegíveis num telemóvel. Medir a
 * largura disponível mantém o texto no tamanho certo em qualquer ecrã.
 *
 * A primeira renderização usa uma largura predefinida (o servidor não pode
 * medir nada) e é corrigida após a montagem.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export function useElementWidth<T extends HTMLElement>(
  fallback = 720,
): { ref: RefObject<T | null>; width: number } {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const apply = (next: number) => {
      if (next > 0) setWidth(Math.round(next));
    };

    apply(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
