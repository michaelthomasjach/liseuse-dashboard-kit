import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "../../../../icons";
import type { Indicator } from "../../interfaces/Indicator.interface";
import { indicatorLabel } from "../../indicatorCatalog";
import { buildStableIndicatorIds } from "../stableIndicatorId";
import "./AvailableIndicatorsList.css";

export interface AvailableIndicatorsListProps {
  indicators: Indicator[];
}

/** Exigence #5/#25's own "AVAILABLE INDICATORS" inspection panel — every indicator currently on
 *  the chart, alongside the exact stable slug `chart.indicator(id)` expects (see
 *  `stableIndicatorId.ts`'s own doc for why `Indicator.id` itself is useless to a script author).
 *  Clicking a row copies `chart.indicator("slug")` to the clipboard, the same copy-to-clipboard
 *  pattern `CodeBlock.tsx` already uses elsewhere in this library, rather than trying to insert
 *  directly into the CodeMirror instance (a sibling component this one has no reference to). */
export function AvailableIndicatorsList({ indicators }: AvailableIndicatorsListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const slugsById = useMemo(() => buildStableIndicatorIds(indicators), [indicators]);

  async function handleCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(`chart.indicator("${slug}")`);
      setCopiedId(slug);
      window.setTimeout(() => setCopiedId((id) => (id === slug ? null : id)), 1600);
    } catch {
      // Clipboard API unavailable or permission denied — nothing else to do.
    }
  }

  const scriptIndicators = indicators.filter((ind) => !ind.customData);

  return (
    <div className="lq-script-available-indicators">
      <div className="lq-script-available-indicators__title">Indicateurs disponibles</div>
      {scriptIndicators.length === 0 ? (
        <div className="lq-script-available-indicators__empty">Aucun indicateur sur cette chart pour l'instant.</div>
      ) : (
        <ul className="lq-script-available-indicators__list">
          {scriptIndicators.map((ind) => {
            const slug = slugsById.get(ind.id);
            if (!slug) return null;
            return (
              <li key={ind.id} className="lq-script-available-indicators__item">
                <button type="button" className="lq-script-available-indicators__row" onClick={() => handleCopy(slug)}>
                  <code className="lq-script-available-indicators__slug">{slug}</code>
                  <span className="lq-script-available-indicators__label">{indicatorLabel(ind)}</span>
                  {copiedId === slug ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
