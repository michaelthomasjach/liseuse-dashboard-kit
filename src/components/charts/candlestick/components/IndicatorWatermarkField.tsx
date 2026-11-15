import { Input } from "../../../forms/Input";
import { Toggle } from "../../../primitives/Toggle";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorLabel } from "../indicatorCatalog";
import { DEFAULT_PANE_WATERMARK_OPACITY, indicatorWatermarkSetting } from "../indicatorWatermark";

export interface IndicatorWatermarkFieldProps {
  indicatorDraft: Indicator;
  setIndicatorDraft: (d: Indicator) => void;
}

/** « Filigrane » d'un indicateur en panneau séparé (onglet Style) : un texte en fond de son panneau, comme le nom du
 *  symbole derrière les bougies. Enregistré avec l'indicateur ; pour un script, il remplace celui que le script pose
 *  (`plot.pane(nom).watermark(…)`). */
export function IndicatorWatermarkField({ indicatorDraft, setIndicatorDraft }: IndicatorWatermarkFieldProps) {
  const current = indicatorWatermarkSetting(indicatorDraft);
  const visible = current !== undefined && current.visible !== false;
  const opacity = current?.opacity ?? DEFAULT_PANE_WATERMARK_OPACITY;
  const size = current?.size ?? 100;
  const set = (patch: Partial<NonNullable<Indicator["watermark"]>>) =>
    setIndicatorDraft({ ...indicatorDraft, watermark: { ...current, visible, ...patch } });
  return (
    <div className="lq-field">
      <label className="lq-field__label">Filigrane</label>
      <div className="lq-chart__settings-layout-row">
        <Toggle checked={visible} onChange={() => set({ visible: !visible })} ariaLabel="Filigrane du panneau" />
        <span className="lq-chart__settings-layout-label">Texte en fond du panneau</span>
      </div>
      {visible && (
        <>
          <Input
            size="small"
            label="Texte"
            value={current?.text ?? ""}
            placeholder={indicatorLabel(indicatorDraft)}
            maxLength={80}
            onChange={(e) => set({ text: e.target.value || undefined })}
          />
          <label className="lq-chart__settings-opacity">
            <span>Opacité : {Math.round(opacity * 100)} %</span>
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
              aria-label="Opacité du filigrane du panneau"
            />
          </label>
          <label className="lq-chart__settings-opacity">
            <span>Taille : {Math.round(size)} %</span>
            <input
              type="range"
              min={30}
              max={150}
              step={5}
              value={Math.round(size)}
              onChange={(e) => set({ size: Number(e.target.value) })}
              aria-label="Taille du filigrane du panneau"
            />
          </label>
        </>
      )}
    </div>
  );
}
