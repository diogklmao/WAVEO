/**
 * WAVEO — ícones.
 *
 * SVG em linha, sem dependências externas nem pedidos de rede. Todos usam
 * `currentColor` e uma grelha de 24×24 com traço consistente, para que se
 * comportem como um sistema e não como uma coleção de desenhos soltos.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconWave(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2 8.5c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0 2.6 1.2 3.8.4" />
      <path d="M2 14c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0 2.6 1.2 3.8.4" />
      <path d="M2 19.5c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0 2.6 1.2 3.8.4" />
    </Base>
  );
}

export function IconWind(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 16h13a3 3 0 1 1-3 3" />
      <path d="M3 12h8" />
    </Base>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 18a9 9 0 1 1 16 0" />
      <path d="M12 14.5 15.5 9" />
      <circle cx="12" cy="16" r="1.6" />
    </Base>
  );
}

export function IconThermometer(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" />
    </Base>
  );
}

export function IconDroplet(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.2s5.5 6 5.5 10a5.5 5.5 0 1 1-11 0c0-4 5.5-10 5.5-10Z" />
    </Base>
  );
}

export function IconTide(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 15h18" />
      <path d="M3 19h18" />
      <path d="M12 3v9" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M8.5 11.5 12 15l3.5-3.5" />
    </Base>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </Base>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </Base>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Base>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5.2-5.2 2 2-5.2 5.2-2Z" />
    </Base>
  );
}

export function IconHeart({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5c0 5.1-7 9.5-7 9.5Z" />
    </Base>
  );
}

export function IconStar({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base {...props} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8L12 3.5Z" />
    </Base>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5V7A3 3 0 0 0 7 9.9" />
      <path d="M17 5.5h2.5V7a3 3 0 0 1-2.5 2.9" />
      <path d="M12 14v4" />
      <path d="M8.5 20h7" />
      <path d="M10 18h4l1 2H9l1-2Z" />
    </Base>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 20V4" />
      <path d="M3.5 20h17" />
      <path d="M7 16.5l4-5 3 3 4.5-6" />
    </Base>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m3.5 6.5 5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2v-13Z" />
      <path d="M8.5 4.5v13M15.5 7v13" />
    </Base>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </Base>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </Base>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Base>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Base>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20V5M6 11l6-6 6 6" />
    </Base>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4v15M6 13l6 6 6-6" />
    </Base>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Base>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Base>
  );
}

export function IconCloud(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 18.5h11a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.6 3.2 3.2 0 0 0 .2 6.4Z" />
    </Base>
  );
}

export function IconCloudSun(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2" />
      <circle cx="11" cy="11" r="3.2" />
      <path d="M9 18.5h9.5a3.5 3.5 0 0 0 .3-7 5.2 5.2 0 0 0-9.9 1.3A2.9 2.9 0 0 0 9 18.5Z" />
    </Base>
  );
}

export function IconRain(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 15.5h11a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.7 9.3a3.1 3.1 0 0 0-.2 6.2Z" />
      <path d="M8.5 18.5 7.5 21M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" />
    </Base>
  );
}

export function IconDrizzle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 15.5h11a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.7 9.3a3.1 3.1 0 0 0-.2 6.2Z" />
      <path d="M9 18.5v1.5M13 18.5v1.5M17 18.5v1.5" />
    </Base>
  );
}

export function IconStorm(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 14.5h11a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.7 8.3a3.1 3.1 0 0 0-.2 6.2Z" />
      <path d="m13 16-3 4h4l-2.5 3.5" />
    </Base>
  );
}

export function IconFog(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 12.5h11a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.7 6.3a3.1 3.1 0 0 0-.2 6.2Z" />
      <path d="M4 16h13M6 19.5h13" />
    </Base>
  );
}

export function IconSnow(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5" />
    </Base>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
      <path d="m3.5 16.5 8.5 4.7 8.5-4.7" />
    </Base>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </Base>
  );
}

const WEATHER_ICON_MAP = {
  sol: IconSun,
  "sol-nuvens": IconCloudSun,
  nuvens: IconCloud,
  nevoeiro: IconFog,
  chuvisco: IconDrizzle,
  chuva: IconRain,
  aguaceiro: IconRain,
  trovoada: IconStorm,
  neve: IconSnow,
} as const;

export type WeatherIconName = keyof typeof WEATHER_ICON_MAP;

/** Devolve o componente de ícone correspondente a uma categoria de tempo. */
export function weatherIconComponent(name: WeatherIconName) {
  return WEATHER_ICON_MAP[name] ?? IconCloud;
}
