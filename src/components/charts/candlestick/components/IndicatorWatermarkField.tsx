import { useId } from "react";
import { Input } from "../../../forms/Input";
import { Checkbox } from "../../../forms/Checkbox";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorLabel } from "../indicatorCatalog";
import { DEFAULT_PANE_WATERMARK_OPACITY, indicatorWatermarkSetting } from "../indicatorWatermark";
import { SettingCheckRow, SettingRow } from "./IndicatorSettingsLayout";

export interface IndicatorWatermarkFieldProps {
  indicatorDraft: Indicator;
  setIndicatorDraft: (d: Indicator) => void;
}

/** « Filigrane » d'un indicateur en panneau séparé (onglet Style, section Affichage) : un texte en fond de son panneau,
 *  comme le nom du symbole derrière les bougies. Enregistré avec l'indicateur ; pour un script, il remplace celui que le
 *  script pose (`plot.pane(nom).watermark(…)`). Une case, puis texte, opacité et taille en lignes de la grille. */
export function IndicatorWatermarkField({ indicatorDraft, setIndicatorDraft }: IndicatorWatermarkFieldProps) {
  const current = indicatorWatermarkSetting(indicatorDraft);
  const visible = current !== undefined && current.visible !== false;
  const opacity = current?.opacity ?? DEFAULT_PANE_WATERMARK_OPACITY;
  const size = current?.size ?? 100;
  const textId = useId();
  const set = (patch: Partial<NonNullable<Indicator["watermark"]>>) =>
    setIndicatorDraft({ ...indicatorDraft, watermark: { ...current, visible, ...patch } });
  return (
    <>
      <SettingCheckRow>
        <Checkbox label="Filigrane du panneau" checked={visible} onChange={(checked) => set({ visible: checked })} />
      </SettingCheckRow>
      {visible && (
        <>
          <SettingRow label="Texte" htmlFor={textId} wide>
            <Input
              id={textId}
              value={current?.text ?? ""}
              placeholder={indicatorLabel(indicatorDraft)}
              maxLength={80}
              onChange={(e) => set({ text: e.target.value || undefined })}
            />
          </SettingRow>
          <SettingRow label="Opacité" wide trailing={<output className="lq-ind-settings__range-value">{Math.round(opacity * 100)} %</output>}>
            <input
              type="range"
              className="lq-ind-settings__range"
              min={2}
              max={40}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
              aria-label="Opacité du filigrane du panneau"
            />
          </SettingRow>
          <SettingRow label="Taille" wide trailing={<output className="lq-ind-settings__range-value">{Math.round(size)} %</output>}>
            <input
              type="range"
              className="lq-ind-settings__range"
              min={30}
              max={150}
              step={5}
              value={Math.round(size)}
              onChange={(e) => set({ size: Number(e.target.value) })}
              aria-label="Taille du filigrane du panneau"
            />
          </SettingRow>
        </>
      )}
    </>
  );
}
