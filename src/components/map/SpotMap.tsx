"use client";

/**
 * WAVEO — mapa interativo.
 *
 * Carregado apenas no cliente (`ssr: false`), porque o MapLibre precisa de WebGL
 * e de um elemento com dimensões reais. É o único componente da aplicação com
 * esta restrição, e o painel que o envolve mostra uma lista equivalente
 * enquanto o mapa não está pronto — de modo que a informação nunca depende de o
 * mapa carregar.
 *
 * A inicialização está protegida: se o WebGL não estiver disponível (browser
 * antigo, política de hardware, contentor sem GPU), o mapa falha em silêncio e
 * o painel continua a funcionar.
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { formatScore, scoreColor } from "@/lib/format";
import type { ScoreBand } from "@/lib/types";

export interface SpotMapPoint {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  score: number;
  band: ScoreBand;
}

/**
 * Fundo de mapa: tiles raster escuros da CARTO, sem chave de API.
 * A atribuição é obrigatória e é apresentada pelo próprio controlo do MapLibre.
 */
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#040b18" },
    },
    {
      id: "carto-dark",
      type: "raster",
      source: "carto-dark",
      paint: { "raster-opacity": 0.9 },
    },
  ],
};

const PORTUGAL_CENTER: [number, number] = [-9.1, 39.6];

export default function SpotMap({
  points,
  selectedSlug,
  onSelect,
  className,
}: {
  points: SpotMapPoint[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  const previousSelection = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /* --- Criação do mapa ---------------------------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: BASEMAP_STYLE,
        center: PORTUGAL_CENTER,
        zoom: 6.1,
        minZoom: 5,
        maxZoom: 15,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        fadeDuration: reduceMotion ? 0 : 300,
      });
    } catch {
      // Sem contexto WebGL: o painel que envolve o mapa continua utilizável.
      setFailed(true);
      return;
    }

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
      "top-right",
    );
    map.touchZoomRotate.disableRotation();
    map.on("load", () => setReady(true));
    map.on("error", () => {
      // Erros de tiles isolados não devem rebentar a interface.
    });

    mapRef.current = map;

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => map.resize())
        : null;
    observer?.observe(container);

    return () => {
      observer?.disconnect();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  /* --- Marcadores --------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const point of points) {
      seen.add(point.slug);
      let entry = existing.get(point.slug);

      if (!entry) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "map-marker-group";
        el.setAttribute("aria-label", `Selecionar ${point.name}`);

        const dot = document.createElement("span");
        dot.className = "map-marker";

        const name = document.createElement("span");
        name.className = "map-marker-name";
        name.textContent = point.name;

        el.append(dot, name);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(point.slug);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([point.lon, point.lat])
          .addTo(map);

        entry = { marker, el };
        existing.set(point.slug, entry);
      }

      const dot = entry.el.querySelector<HTMLElement>(".map-marker");
      if (dot) {
        dot.style.background =
          point.band === "indisponivel" ? "#64748b" : scoreColor(point.score);
        dot.textContent = point.band === "indisponivel" ? "—" : formatScore(point.score);
      }
      entry.el.title = `${point.name} — ${
        point.band === "indisponivel" ? "sem dados" : `${formatScore(point.score)}/10`
      }`;
    }

    for (const [slug, entry] of existing) {
      if (!seen.has(slug)) {
        entry.marker.remove();
        existing.delete(slug);
      }
    }

    if (points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const point of points) bounds.extend([point.lon, point.lat]);
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 10.5,
        duration: 0,
      });
    }
  }, [points, ready]);

  /* --- Seleção ------------------------------------------------------------ */
  useEffect(() => {
    if (!ready) return;

    for (const [slug, entry] of markersRef.current) {
      entry.el.dataset.selected = slug === selectedSlug ? "true" : "false";
    }

    const map = mapRef.current;
    const changed = previousSelection.current !== selectedSlug;
    previousSelection.current = selectedSlug;

    if (!map || !changed || selectedSlug === null) return;

    const point = points.find((candidate) => candidate.slug === selectedSlug);
    if (!point) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target: [number, number] = [point.lon, point.lat];
    if (reduceMotion) {
      map.jumpTo({ center: target });
    } else {
      map.flyTo({ center: target, zoom: Math.max(map.getZoom(), 9.4), duration: 900, essential: true });
    }
  }, [selectedSlug, ready, points]);

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-card)] border border-abyss-500/50 bg-abyss-900">
        <div ref={containerRef} className="h-full w-full" />

        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-abyss-900/95 p-6 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-mist-400">
              Não foi possível iniciar o mapa neste dispositivo — o browser não
              disponibilizou aceleração gráfica. A lista de spots ao lado tem a
              mesma informação.
            </p>
          </div>
        ) : null}

        {!ready && !failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-abyss-900/95">
            <div className="flex flex-col items-center gap-3">
              <span className="skeleton h-11 w-11 rounded-full" />
              <p className="text-xs tracking-wide text-mist-500 uppercase">
                A carregar o mapa…
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
