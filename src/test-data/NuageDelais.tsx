import { useLayoutEffect, useRef, useState } from "react";
import { scaleLinear } from "d3";
import { ChartAxis } from "../components/charts/ChartAxis";
import { ChartTooltip } from "../components/charts/ChartTooltip";
import { DELAIS_CLIENTS } from "./storyDemoData";

/**
 * Un nuage de points composé à la main avec les deux briques que le kit expose pour cela :
 * `ChartAxis` pour les axes (d3 garde la main sur les graduations, React sur le reste) et
 * `ChartTooltip` pour la bulle, qui se recale d'elle-même dans le tracé.
 *
 * Montré par les stories de `ChartAxis` et de `ChartTooltip`, qui affichent ce fichier tel quel
 * sous « Show code ».
 */
export function NuageDelais() {
  // Le graphique occupe la largeur de son conteneur : on la mesure.
  const ref = useRef<HTMLDivElement | null>(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [survol, setSurvol] = useState<number | null>(null);
  const hauteur = 280;
  const marge = { top: 12, right: 16, bottom: 34, left: 44 };
  const w = Math.max(0, largeur - marge.left - marge.right);
  const h = hauteur - marge.top - marge.bottom;
  const x = scaleLinear().domain([0, 170]).range([0, w]).nice();
  const y = scaleLinear().domain([0, 75]).range([h, 0]).nice();
  const point = survol === null ? null : DELAIS_CLIENTS[survol];

  return (
    // `position: relative` : la bulle se place en pixels par rapport à ce conteneur.
    <div ref={ref} style={{ position: "relative" }}>
      {largeur > 0 ? (
        <svg width={largeur} height={hauteur} role="img" aria-label="Délai de paiement selon le montant facturé">
          <g transform={`translate(${marge.left},${marge.top})`}>
            <ChartAxis scale={y} orientation="left" ticks={5} grid gridLength={w} tickFormat={(v) => `${v} j`} />
            <ChartAxis scale={x} orientation="bottom" transform={`translate(0,${h})`} ticks={6} tickFormat={(v) => `${v} k€`} />
            {DELAIS_CLIENTS.map((c, i) => (
              <circle
                key={c.client}
                cx={x(c.montant)}
                cy={y(c.delai)}
                r={survol === i ? 6 : 4.5}
                fill={c.delai > 45 ? "var(--lq-color-down)" : "var(--lq-color-accent)"}
                fillOpacity={survol === null || survol === i ? 0.85 : 0.35}
                onPointerEnter={() => setSurvol(i)}
                onPointerLeave={() => setSurvol(null)}
              />
            ))}
          </g>
        </svg>
      ) : null}
      <ChartTooltip visible={point !== null} x={point ? marge.left + x(point.montant) : 0} y={point ? marge.top + y(point.delai) : 0}>
        {point ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong>{point.client}</strong>
            <span>{point.montant} k€ facturés</span>
            <span>payé en {point.delai} jours en moyenne</span>
          </div>
        ) : null}
      </ChartTooltip>
    </div>
  );
}
