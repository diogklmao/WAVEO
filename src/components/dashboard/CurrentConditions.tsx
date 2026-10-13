/**
 * WAVEO — condições atuais.
 *
 * Combina a bússola com um mosaico de leituras. A ordem não é arbitrária:
 * começa no que determina se há ondas (altura, período), passa pelo que
 * determina se estão surfáveis (vento), e termina no que determina o conforto
 * (temperaturas, tempo). Cada valor em falta é apresentado como "—" com a
 * razão à vista, nunca como zero.
 */

import { CompassDial } from "@/components/ui/CompassDial";
import { StatTile } from "@/components/ui/StatTile";
import { weatherIconComponent } from "@/components/icons";
import {
  IconDroplet,
  IconGauge,
  IconThermometer,
  IconTide,
  IconWave,
  IconWind,
} from "@/components/icons";
import {
  formatCelsius,
  formatDecimal,
  formatFractionAsPercent,
  formatKmh,
  formatMeters,
  formatSeconds,
  tideStageLabel,
  weatherCodeLabel,
  weatherIcon,
} from "@/lib/format";
import { classifyWind, windRelationLabel } from "@/lib/geo";
import type { HourlyForecast, SurfSpot, TideState } from "@/lib/types";

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
  tide,
}: {
  spot: SurfSpot;
  current: HourlyForecast | null;
  tide: TideState;
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

  const WeatherIcon = weatherIconComponent(weatherIcon(current.weatherCode, current.isDay));

  const period = current.swellPeriod ?? current.wavePeriod;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
      <CompassDial
        swellDirection={current.swellDirection ?? current.waveDirection}
        swellPeriod={current.swellPeriod}
        waveHeight={current.waveHeight}
        windDirection={current.windDirection}
        windSpeed={current.windSpeed}
        windGusts={current.windGust}
        beachOrientation={characteristics.beachOrientation}
        swellWindow={characteristics.swellWindow}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatTile
          icon={<IconWave size={14} />}
          label="Altura de onda"
          value={current.waveHeight === null ? "—" : formatMeters(current.waveHeight).replace(" m", "")}
          unit="m"
          unavailable={current.waveHeight === null}
          sub={
            current.swellHeight === null
              ? "componente de swell indisponível"
              : `swell ${formatMeters(current.swellHeight)}`
          }
        />

        <StatTile
          icon={<IconGauge size={14} />}
          label="Período de pico"
          value={period === null ? "—" : formatSeconds(period).replace(" s", "")}
          unit="s"
          unavailable={period === null}
          tone={
            period === null
              ? "neutral"
              : period >= characteristics.idealPeriod.min &&
                  period <= characteristics.idealPeriod.max
                ? "good"
                : "fair"
          }
          sub={`preferido ${characteristics.idealPeriod.min}–${characteristics.idealPeriod.max} s`}
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
          icon={<IconDroplet size={14} />}
          label="Temperatura da água"
          value={
            current.seaSurfaceTemperature === null
              ? "—"
              : formatCelsius(current.seaSurfaceTemperature).replace(" °C", "")
          }
          unit="°C"
          unavailable={current.seaSurfaceTemperature === null}
          sub="temperatura à superfície"
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
          sub={
            <span className="flex items-center gap-1.5">
              <WeatherIcon size={14} className="shrink-0 text-mist-400" />
              <span className="truncate">{weatherCodeLabel(current.weatherCode)}</span>
            </span>
          }
        />

        <StatTile
          icon={<IconTide size={14} />}
          label="Maré"
          value={tide.available && tide.height !== null ? formatDecimal(tide.height) : "—"}
          unit="m"
          unavailable={!tide.available || tide.height === null}
          sub={
            tide.available
              ? `maré ${tideStageLabel(tide.stage)}${
                  tide.normalizedLevel === null
                    ? ""
                    : ` · ${Math.round(tide.normalizedLevel * 100)} % do intervalo`
                }`
              : "fornecedor sem dados de maré"
          }
        />

        <StatTile
          icon={<IconWave size={14} />}
          label="Energia de swell"
          value={
            current.swellEnergyShare === null
              ? "—"
              : formatFractionAsPercent(current.swellEnergyShare).replace(" %", "")
          }
          unit="%"
          unavailable={current.swellEnergyShare === null}
          tone={
            current.swellEnergyShare === null
              ? "neutral"
              : current.swellEnergyShare >= 0.7
                ? "good"
                : current.swellEnergyShare >= 0.45
                  ? "fair"
                  : "warning"
          }
          sub="proporção de swell face a onda de vento"
        />

        <StatTile
          icon={<IconGauge size={14} />}
          label="Onda de vento"
          value={
            current.windWaveHeight === null
              ? "—"
              : formatMeters(current.windWaveHeight).replace(" m", "")
          }
          unit="m"
          unavailable={current.windWaveHeight === null}
          sub="mar gerado localmente pelo vento"
        />
      </div>
    </div>
  );
}
