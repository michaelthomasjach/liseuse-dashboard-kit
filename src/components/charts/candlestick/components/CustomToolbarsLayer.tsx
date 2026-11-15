import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Input } from "../../../forms/Input";
import type { CustomToolbarsLayerState } from "../hooks/useCustomToolbars";
import { CustomToolbar } from "./CustomToolbar";

export interface CustomToolbarsLayerProps extends CustomToolbarsLayerState {
  plotWidth: number;
  plotLeft: number;
  plotBottom: number;
}

/** Les barres d'outils personnalisées affichées, et la fenêtre « Renommer la barre ». Rendu dans le même parent que la
 *  barre flottante d'un dessin, pour s'aimanter aux mêmes bords du tracé. */
export function CustomToolbarsLayer({
  toolbars,
  catalog,
  isActive,
  activate,
  setTools,
  setPlacement,
  close,
  renamingId,
  startRename,
  rename,
  cancelRename,
  pickerRequestId,
  clearPickerRequest,
  plotWidth,
  plotLeft,
  plotBottom,
}: CustomToolbarsLayerProps) {
  const catalogById = useMemo(() => new Map(catalog.map((d) => [d.id, d])), [catalog]);
  const renaming = renamingId ? (toolbars.find((t) => t.id === renamingId) ?? null) : null;
  const [nameValue, setNameValue] = useState("");
  useEffect(() => {
    if (renaming) setNameValue(renaming.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renamingId]);

  return (
    <>
      {plotWidth > 0 &&
        toolbars
          .filter((t) => t.visible)
          .map((t) => (
            <CustomToolbar
              key={t.id}
              toolbar={t}
              catalog={catalog}
              catalogById={catalogById}
              isActive={isActive}
              activate={activate}
              onToolsChange={(tools) => setTools(t.id, tools)}
              onPlacementChange={(p) => setPlacement(t.id, p)}
              onClose={() => close(t.id)}
              onRename={() => startRename(t.id)}
              openPickerOnMount={pickerRequestId === t.id}
              onPickerOpened={clearPickerRequest}
              plotWidth={plotWidth}
              plotLeft={plotLeft}
              plotBottom={plotBottom}
            />
          ))}
      {renaming && (
        <Modal
          open
          onClose={cancelRename}
          title="Renommer la barre d'outils"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={cancelRename}>
                Annuler
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={() => rename(renaming.id, nameValue)} disabled={!nameValue.trim()}>
                Renommer
              </button>
            </div>
          }
        >
          <Input
            label="Nom de la barre"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={40}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && nameValue.trim()) rename(renaming.id, nameValue);
            }}
          />
        </Modal>
      )}
    </>
  );
}
