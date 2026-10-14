/**
 * WAVEO — sparkline.
 *
 * Versão minúscula de uma série, para cartões de spot. Não tem eixos nem
 * etiquetas: serve para dar forma à evolução antes de o utilizador abrir a
 * previsão completa. Sem texto, pode ser esticada sem perder legibilidade — daí
 * o `preserveAspectRatio="none"` com traço de espessura fixa.
 */

import { scoreColor } from "@/lib/format";

export function MiniSparkline({
  values,
  width = 132,
  height = 34,
  color,
  ariaLabel,
}: {
  /** Valores em falta (`null`) quebram a linha, tal como no gráfico grande. */
  values: readonly (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}) {
  const usable = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (usable.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-abyss-500/50 text-[0.625rem] text-mist-500"
        style={{ width, height }}
      >
        sem dados
      </div>
    );
  }

  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const span = max - min || 1;
  const stroke = color ?? scoreColor(usable[usable.length - 1] ?? 0);
  const pad = 3;
  const plotHeight = height - pad * 2;

  const x = (index: number) =>
    values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
  const y = (value: number) => pad + plotHeight - ((value - min) / span) * plotHeight;

  const runs: string[] = [];
  let current: string[] = [];

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current.length > 0) runs.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`);
  });
  if (current.length > 0) runs.push(current.join(" "));

  const lastUsableIndex = values.reduce<number>(
    (acc, value, index) => (value !== null && Number.isFinite(value) ? index : acc),
    0,
  );
  const lastValue = values[lastUsableIndex];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "Evolução da pontuação ao longo das próximas horas"}
      className="overflow-visible"
    >
      {runs.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {lastValue !== null && lastValue !== undefined && Number.isFinite(lastValue) ? (
        <circle
          cx={x(lastUsableIndex)}
          cy={y(lastValue)}
          r={2.4}
          fill={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
