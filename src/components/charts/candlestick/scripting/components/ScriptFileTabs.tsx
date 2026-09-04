import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../../icons";
import type { ScriptFile } from "../../interfaces/ScriptDef.interface";

export interface ScriptFileTabsProps {
  files: ScriptFile[];
  /** `null` is the entry file, which is always first and can be neither renamed nor removed. */
  activeFile: string | null;
  onSelect: (name: string | null) => void;
  onRename: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
}

/** How far a pointer travels before the gesture counts as a pan rather than a tap on a tab. Below
 *  it, a press-move-release still selects the tab under the finger — a scrolling strip whose tabs
 *  stop being clickable because the hand wobbled two pixels reads as broken. */
const PAN_SLOP = 4;

/** The script's own files, as one horizontally scrollable row. More files than fit is the normal
 *  case once a script is split up, so this scrolls three ways — the wheel (vertical wheels included,
 *  translated to horizontal, since a strip like this is what a trackpad user aims at), a drag
 *  anywhere on the strip, and the chevrons at either edge — with no scrollbar of its own: a
 *  scrollbar under a 22px row costs more height than the row itself.
 *
 *  A chevron appears only on the side that actually has more to show, so it doubles as the "there
 *  is more this way" signal (exigence : « simplement une flèche pour indiquer que davantage
 *  d'éléments sont disponibles »). Both are overlaid on the strip rather than laid out beside it,
 *  so appearing and disappearing never shifts the tabs sideways under the pointer. */
export function ScriptFileTabs({ files, activeFile, onSelect, onRename, onRemove, onAdd }: ScriptFileTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  // Set the moment a press turns into a pan, cleared on the click that follows it — a pan that
  // ends over a tab must not also select that tab.
  const pannedRef = useRef(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 1px of slack: a fractional scroll width (fractional zoom, a half-pixel font metric) would
    // otherwise leave the right chevron permanently lit at the end of the strip.
    setOverflow({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  // Re-measured on every reason the answer can change: a scroll, a resize of the window or of the
  // strip itself (the editor window is resizable), and the file list changing under it.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, files]);

  // Keeps the selected file in view — the tab a new file adds sits at the end of the strip, past
  // the edge on any script with a few files, so without this creating one would select a tab the
  // user cannot see.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const selected = el.querySelector('[aria-selected="true"]');
    if (selected instanceof HTMLElement) selected.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeFile, files.length]);

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    // Two thirds of what is on screen, so a click always leaves a little of the previous content
    // visible to anchor against.
    el.scrollBy({ left: direction * el.clientWidth * 0.66, behavior: "smooth" });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    // Only a primary press, and only when there is anything to pan to.
    if (!el || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    pannedRef.current = false;

    function onMove(move: PointerEvent) {
      const delta = move.clientX - startX;
      if (!pannedRef.current && Math.abs(delta) < PAN_SLOP) return;
      pannedRef.current = true;
      el!.scrollLeft = startScroll - delta;
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    // On the window, not the strip: a pan that leaves the row (this is a 22px-tall target) has to
    // keep tracking rather than stopping dead at the border.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Capture phase, so the swallowed click never reaches the tab's own handler.
  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (!pannedRef.current) return;
    pannedRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    // A plain vertical wheel scrolls this strip sideways — there is nothing to scroll vertically in
    // a single row, and a wheel over it that did nothing would read as dead.
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;
    el.scrollLeft += delta;
    measure();
  }

  return (
    <div className="lq-script-editor-panel__files">
      <div className="lq-script-editor-panel__files-viewport">
        <div
          ref={scrollerRef}
          className="lq-script-editor-panel__files-scroller"
          role="tablist"
          aria-label="Fichiers du script"
          onScroll={measure}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeFile === null}
            className={["lq-script-editor-panel__file", activeFile === null && "lq-script-editor-panel__file--active"].filter(Boolean).join(" ")}
            onClick={() => onSelect(null)}
            title="Fichier principal — celui qui s'exécute"
          >
            Principal
          </button>
          {files.map((file) => (
            <div
              key={file.name}
              role="tab"
              aria-selected={activeFile === file.name}
              tabIndex={-1}
              className={["lq-script-editor-panel__file", activeFile === file.name && "lq-script-editor-panel__file--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(file.name)}
              onDoubleClick={() => onRename(file.name)}
              title={`import { … } from "./${file.name}"  ·  double-clic pour renommer`}
            >
              <span className="lq-script-editor-panel__file-name">{file.name}</span>
              <button
                type="button"
                className="lq-script-editor-panel__file-remove"
                aria-label={`Supprimer ${file.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(file.name);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {overflow.left && (
          <button
            type="button"
            className="lq-script-editor-panel__files-more lq-script-editor-panel__files-more--left"
            aria-label="Fichiers précédents"
            title="Fichiers précédents"
            onClick={() => scrollBy(-1)}
          >
            <ChevronLeftIcon size={12} />
          </button>
        )}
        {overflow.right && (
          <button
            type="button"
            className="lq-script-editor-panel__files-more lq-script-editor-panel__files-more--right"
            aria-label="Fichiers suivants"
            title="Fichiers suivants"
            onClick={() => scrollBy(1)}
          >
            <ChevronRightIcon size={12} />
          </button>
        )}
      </div>
      {/* Outside the scroller: adding a file must not require scrolling to the end of the strip to
          find the button first. */}
      <button type="button" className="lq-script-editor-panel__file-add" aria-label="Nouveau fichier" title="Nouveau fichier" onClick={onAdd}>
        +
      </button>
    </div>
  );
}
