/**
 * WAVEO — condições atuais.
 *
 * Combina a bússola com um mosaico de seis leituras, na ordem em que se decide
 * se vale a pena ir: o que determina se há ondas (altura, período), o que
 * determina se estão surfáveis (vento, rajadas) e o que determina o conforto
 * (temperaturas). Cada valor em falta é apresentado como "—" com a razão à
 * vista, nunca como zero.
 */

import { CompassDial } from "@/components/ui/CompassDial";
import { StatTile } from "@/components/ui/StatTile";
import {
  IconDroplet,
  IconGauge,
  IconThermometer,
  IconWave,
  IconWind,
} from "@/components/icons";
import {
  formatCelsius,
  formatKmh,
  formatMeters,
  formatSeconds,
} from "@/lib/format";
import { classifyWind, windRelationLabel } from "@/lib/geo";
import type { HourlyForecast, SurfSpot } from "@/lib/types";

/**
 * Abaixo desta fração da tolerância do spot o mar está praticamente liso, seja
 * qual for a direção do vento. É o mesmo limiar que o motor de pontuação usa
 * para decidir se a direção do vento chega a influenciar o resultado — mantê-lo
 * igual aqui evita que o indicador contradiga a pontuação.
 */
const LIGHT_WIND_FRACTION = 0.3;

export function CurrentConditions({
  spot,
  current,
}: {
  spot: SurfSpot;
  current: HourlyForecast | null;
}) {
  if (!current) {
    return (
      <p className="rounded-xl border border-dashed border-abyss-500/60 bg-abyss-800/40 px-4 py-8 text-center text-sm text-mist-400">
        Não há dados para o momento atual. Ajuste o período de previsão ou
        tente novamente dentro de alguns minutos.
      </p>
    );
  }

  const { characteristics } = spot;
  // A tolerância passada é a do próprio spot (e não o valor por omissão), para
  // que a etiqueta de direção seja coerente com a pontuação.
  const windRelation =
    current.windDirection === null
      ? null
      : classifyWind(
          current.windDirection,
          characteristics.beachOrientation,
          characteristics.windOffshoreTolerance,
        );

  const lightWind =
    current.windSpeed !== null &&
    current.windSpeed < characteristics.windTolerance * LIGHT_WIND_FRACTION;

  const windTone: "neutral" | "good" | "fair" | "bad" | "warning" =
    windRelation === null
      ? "neutral"
      : lightWind || windRelation === "terral"
        ? "good"
        : windRelation === "maritimo"
          ? "bad"
          : "fair";

  const windSub =
    windRelation === null
      ? "direção indisponível"
      : `${lightWind ? "vento fraco, " : ""}${windRelationLabel(windRelation)} · limite ${characteristics.windTolerance} km/h`;

  const period = current.swellPeriod ?? current.wavePeriod;

  const periodTone: "neutral" | "good" | "fair" =
    period === null
      ? "neutral"
      : period >= characteristics.idealPeriod.min &&
          period <= characteristics.idealPeriod.max
        ? "good"
        : "fair";

  return (
    <div className="grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:items-start">
      <CompassDial
        swellDirection={current.swellDirection ?? current.waveDirection}
        swellPeriod={current.swellPeriod}
        waveHeight={current.waveHeight}
        windDirection={current.windDirection}
        windSpeed={current.windSpeed}
        windGusts={current.windGust}
        beachOrientation={characteristics.beachOrientation}
        swellWindow={characteristics.swellWindow}
        size={232}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatTile
          icon={<IconWave size={14} />}
          label="Altura de ondas"
          value={current.waveHeight === null ? "—" : formatMeters(current.waveHeight).replace(" m", "")}
          unit="m"
          unavailable={current.waveHeight === null}
          sub={
            current.swellHeight === null
              ? "componente de swell indisponível"
              : `Swell ${formatMeters(current.swellHeight)}`
          }
        />

        <StatTile
          icon={<IconGauge size={14} />}
          label="Período de picos"
          value={period === null ? "—" : formatSeconds(period).replace(" s", "")}
          unit="s"
          unavailable={period === null}
          tone={periodTone}
          sub={
            <span
              className={
                periodTone === "good"
                  ? "text-signal-good"
                  : periodTone === "fair"
                    ? "text-signal-fair"
                    : "text-mist-500"
              }
            >
              preferido {characteristics.idealPeriod.min}–{characteristics.idealPeriod.max} s
            </span>
          }
        />

        <StatTile
          icon={<IconWind size={14} />}
          label="Vento"
          value={current.windSpeed === null ? "—" : formatKmh(current.windSpeed).replace(" km/h", "")}
          unit="km/h"
          unavailable={current.windSpeed === null}
          tone={current.windSpeed === null ? "neutral" : windTone}
          sub={windSub}
        />

        <StatTile
          icon={<IconWind size={14} />}
          label="Rajadas"
          value={
            current.windGust === null ? "—" : formatKmh(current.windGust).replace(" km/h", "")
          }
          unit="km/h"
          unavailable={current.windGust === null}
          sub={
            current.windGust === null || current.windSpeed === null
              ? "sem dados"
              : `+${Math.round(current.windGust - current.windSpeed)} km/h face à média`
          }
        />

        <StatTile
          icon={<IconThermometer size={14} />}
          label="Temperatura do ar"
          value={
            current.airTemperature === null
              ? "—"
              : formatCelsius(current.airTemperature).replace(" °C", "")
          }
          unit="°C"
          unavailable={current.airTemperature === null}
          sub="temperatura à superfície"
        />

        <StatTile
          icon={<IconDroplet size={14} />}
          label="Temperatura da água"
          value={
            current.seaSurfaceTemperature === null
              ? "—"
              : formatCelsius(current.seaSurfaceTemperature).replace(" °C", "")
          }
          unit="°C"
          unavailable={current.seaSurfaceTemperature === null}
          sub="Maioritariamente estável nas próximas horas"
        />
      </div>
    </div>
  );
}
