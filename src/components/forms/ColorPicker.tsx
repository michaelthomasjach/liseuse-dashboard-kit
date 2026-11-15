import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { Popover } from "./Popover";
import { useFocusTrap } from "../../internal/useFocusTrap";
import { CheckIcon, ChevronDownIcon, CloseIcon, PencilIcon, PlusIcon, StarIcon, TrashIcon } from "../icons";
import { formatHex, hsvaToRgba, normalizeColor, parseColor, parseHexInput, rgbaToHsva, type HsvaColor, type RgbaColor } from "./colorUtils";
import { MAX_SET_COLORS, pushRecentColor, useColorPreferences, type ColorSet } from "./ColorPreferences";
import "./ColorPicker.css";

const GRAYS = ["#ffffff", "#e6e6e6", "#cccccc", "#b3b3b3", "#999999", "#808080", "#666666", "#4d4d4d", "#333333", "#000000"];
const HUES = ["#f23645", "#ff9800", "#ffeb3b", "#4caf50", "#089981", "#00bcd4", "#2962ff", "#673ab7", "#9c27b0", "#e91e63"];
const mix = (hex: string, target: number, t: number) => {
  const c = parseColor(hex)!;
  return formatHex({ r: c.r + (target - c.r) * t, g: c.g + (target - c.g) * t, b: c.b + (target - c.b) * t, a: 1 });
};
/** Palette de base : une ligne de gris (blanc → noir), puis dix teintes en sept nuances (claires → foncées). */
export const COLOR_PICKER_BASE_PALETTE: string[] = [
  ...GRAYS,
  ...[0.8, 0.6, 0.4, 0.2].flatMap((t) => HUES.map((h) => mix(h, 255, t))),
  ...HUES,
  ...[0.3, 0.55].flatMap((t) => HUES.map((h) => mix(h, 0, t))),
];
const COLUMNS = 10;
const DEFAULT_THICKNESS_OPTIONS = [1, 2, 3, 4];

/** Fond d'un aperçu : la couleur par-dessus un damier, qui montre la transparence. */
export function colorSwatchBackground(color: string): string {
  return `linear-gradient(${color}, ${color}), repeating-conic-gradient(#c8c8c8 0 25%, #ffffff 0 50%) 0 0 / 8px 8px`;
}

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}
const eyeDropper = (): EyeDropperCtor | null =>
  typeof window !== "undefined" && "EyeDropper" in window ? ((window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper ?? null) : null;

export interface ColorPickerProps {
  /** Couleur courante : `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` ou toute couleur CSS lisible. */
  value: string;
  /** Appelé à chaque changement, avec `#rrggbb` (opaque) ou `#rrggbbaa` (transparente). */
  onChange: (color: string) => void;
  /** Curseur d'opacité (0–100 %). Défaut vrai ; faux pour une couleur qui doit rester opaque. */
  alpha?: boolean;
  /** Épaisseur du trait (pixels) : avec `onThicknessChange`, une rangée « Épaisseur » sous l'opacité, pour une
   *  couleur de ligne (courbe d'indicateur, dessin). */
  thickness?: number;
  onThicknessChange?: (width: number) => void;
  /** Épaisseurs proposées. Défaut 1, 2, 3, 4. */
  thicknessOptions?: number[];
  disabled?: boolean;
  /** Classe du bouton déclencheur. Sans enfants, le bouton *est* la pastille (28 × 20 par défaut). */
  className?: string;
  /** Avec des enfants (une icône, par exemple) : classe de la barre de couleur affichée sous eux. */
  swatchClassName?: string;
  /** Contenu du déclencheur, la couleur s'affichant alors dans une barre sous lui (`swatchClassName`). */
  children?: ReactNode;
  /** Palette de base à la place de celle du kit. */
  palette?: string[];
  id?: string;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Sélecteur de couleur : une pastille qui ouvre un panneau compact (≈ 240 px) — une rangée de gris et une grille de
 * dix teintes du clair au foncé (couleur actuelle cerclée), les couleurs récentes (communes à tous les sélecteurs,
 * voir `ColorPreferencesProvider`) suivies d'un « + » qui ouvre le sélecteur fin (saturation / luminosité, teinte,
 * hexadécimal, pipette du navigateur quand il en a une), l'opacité en % sur damier, l'épaisseur du trait en option
 * (`thickness`), et le menu « Jeux » : jeux de couleurs enregistrés (créer, renommer, compléter, supprimer,
 * appliquer — un jeu appliqué remplace la grille dans tous les sélecteurs).
 *
 * Clavier : flèches dans les grilles et dans la zone fine (Maj : par 10), Échap ferme. Au doigt : cases et curseurs
 * agrandis sur un écran tactile. Le panneau reste dans l'écran (il se retourne, se décale, défile).
 */
export function ColorPicker({
  value,
  onChange,
  alpha = true,
  thickness,
  onThicknessChange,
  thicknessOptions = DEFAULT_THICKNESS_OPTIONS,
  disabled,
  className,
  swatchClassName,
  children,
  palette = COLOR_PICKER_BASE_PALETTE,
  id,
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { preferences, update } = useColorPreferences();
  const openedWith = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // La couleur entre dans les récentes à la fermeture, si elle a changé (pas à chaque pas d'un glissé).
  const commitRecent = useCallback(() => {
    const start = openedWith.current;
    openedWith.current = null;
    if (start === null) return;
    if (normalizeColor(valueRef.current) !== normalizeColor(start)) update((p) => pushRecentColor(p, valueRef.current));
  }, [update]);
  const close = useCallback(() => {
    setOpen(false);
    commitRecent();
  }, [commitRecent]);
  // Fermé par le démontage (dialogue refermé, panneau ouvert) : la couleur choisie compte quand même.
  useEffect(() => () => commitRecent(), [commitRecent]);

  const shown = value || "#000000";
  // Sans aria-label : le libellé affiché juste avant la pastille (« Couleur », « Fond stop »…) la nomme.
  const [autoLabel, setAutoLabel] = useState<string | undefined>();
  useLayoutEffect(() => {
    if (ariaLabel || ariaLabelledBy) return;
    const prev = anchorRef.current?.previousElementSibling;
    const text = prev && (prev.tagName === "LABEL" || prev.classList.contains("lq-field__label")) ? prev.textContent?.trim() : undefined;
    setAutoLabel(text ? `Couleur : ${text}` : undefined);
  }, [ariaLabel, ariaLabelledBy]);
  const label = ariaLabel ?? (ariaLabelledBy ? undefined : autoLabel ?? "Choisir une couleur");
  const triggerStyle: CSSProperties | undefined = children ? undefined : { background: colorSwatchBackground(shown) };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        id={id}
        className={[children ? "lq-color-picker lq-color-picker--content" : className ? "lq-color-picker" : "lq-color-picker lq-color-picker__swatch", className].filter(Boolean).join(" ")}
        style={triggerStyle}
        disabled={disabled}
        title={title ?? shown}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-color={shown}
        onClick={() => {
          if (open) close();
          else {
            openedWith.current = value;
            setOpen(true);
          }
        }}
      >
        {children}
        {children && <span className={swatchClassName ?? "lq-color-picker__bar"} style={{ background: colorSwatchBackground(shown) }} aria-hidden="true" />}
      </button>
      {open && (
        <ColorPickerPanel
          anchorRef={anchorRef}
          value={shown}
          onChange={onChange}
          alpha={alpha}
          palette={palette}
          onClose={close}
          preferences={preferences}
          update={update}
          label={label ?? "Couleur"}
          thickness={thickness}
          onThicknessChange={onThicknessChange}
          thicknessOptions={thicknessOptions}
        />
      )}
    </>
  );
}

interface PanelProps {
  anchorRef: RefObject<HTMLButtonElement | null>;
  value: string;
  onChange: (c: string) => void;
  alpha: boolean;
  palette: string[];
  onClose: () => void;
  preferences: ReturnType<typeof useColorPreferences>["preferences"];
  update: ReturnType<typeof useColorPreferences>["update"];
  label: string;
  thickness?: number;
  onThicknessChange?: (w: number) => void;
  thicknessOptions: number[];
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

function ColorPickerPanel({ anchorRef, value, onChange, alpha, palette, onClose, preferences, update, label, thickness, onThicknessChange, thicknessOptions }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const [customOpen, setCustomOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const relayout = () => setLayoutKey((k) => k + 1);
  const uid = useId();

  // Teinte gardée à part : une couleur grise (saturation nulle) ne doit pas ramener la teinte au rouge.
  const [hsva, setHsva] = useState<HsvaColor>(() => rgbaToHsva(parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 }));
  const emitted = useRef<string | null>(null);
  useEffect(() => {
    if (emitted.current !== null && normalizeColor(value) === normalizeColor(emitted.current)) return;
    const c = parseColor(value);
    if (c) setHsva((prev) => {
      const next = rgbaToHsva(c);
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h, s: next.v === 0 ? prev.s : next.s } : next;
    });
  }, [value]);

  const emitHsva = (next: HsvaColor) => {
    const n = alpha ? next : { ...next, a: 1 };
    setHsva(n);
    const out = formatHex(hsvaToRgba(n));
    emitted.current = out;
    onChange(out);
  };
  const emitColor = (color: string, keepAlpha: boolean) => {
    const c = parseColor(color);
    if (!c) return;
    const rgba: RgbaColor = { ...c, a: !alpha ? 1 : keepAlpha ? hsva.a : c.a };
    const next = rgbaToHsva(rgba);
    emitHsva(next.s === 0 ? { ...next, h: hsva.h } : next);
  };

  const current = formatHex(hsvaToRgba(hsva));
  const opaque = formatHex({ ...hsvaToRgba(hsva), a: 1 });
  const activeSet = preferences.colorSets.find((s) => s.id === preferences.activeColorSetId) ?? null;
  const dropper = eyeDropper();

  return (
    <Popover
      open
      onClose={onClose}
      anchorRef={anchorRef}
      trackKey={`${customOpen}-${setsOpen}-${layoutKey}`}
      className="lq-color-picker__popover"
      initialFocus={(panel) => panel.querySelector<HTMLElement>("[data-lq-color-selected='true']") ?? panel.querySelector<HTMLElement>("button, input")}
    >
      <div
        ref={panelRef}
        className="lq-color-picker__panel"
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        // Le panneau est rendu ailleurs dans la page mais reste, pour React, l'enfant du déclencheur : ses gestes ne
        // doivent pas remonter jusqu'au graphique (glisser la barre flottante, raccourcis clavier, molette…).
        onPointerDown={stop}
        onMouseDown={stop}
        onClick={stop}
        onDoubleClick={stop}
        onWheel={stop}
        onContextMenu={stop}
        onKeyDown={(e) => {
          if (e.key !== "Escape") e.stopPropagation();
        }}
      >
        {activeSet && (
          <div className="lq-color-picker__heading">
            <span className="lq-color-picker__set-title">{activeSet.name}</span>
            <button type="button" className="lq-color-picker__link" onClick={() => update((p) => ({ ...p, activeColorSetId: null }))}>
              Palette de base
            </button>
          </div>
        )}
        <SwatchGrid
          label={activeSet ? `Couleurs du jeu ${activeSet.name}` : "Palette de base"}
          colors={activeSet ? activeSet.colors : palette}
          current={current}
          compareOpaque={!activeSet}
          opaque={opaque}
          onPick={(c) => emitColor(c, !activeSet)}
          emptyText="Ce jeu est vide : ajoutez-y des couleurs depuis « Jeux »."
          separateFirstRow={!activeSet}
        />

        <div className="lq-color-picker__divider" aria-hidden="true" />
        <SwatchGrid
          label="Couleurs récentes"
          colors={preferences.recentColors}
          current={current}
          onPick={(c) => emitColor(c, false)}
          trailing={
            <button
              type="button"
              className={["lq-color-picker__add", customOpen && "lq-color-picker__add--open"].filter(Boolean).join(" ")}
              aria-expanded={customOpen}
              aria-controls={`${uid}-custom`}
              aria-label={customOpen ? "Fermer le sélecteur fin" : "Couleur personnalisée (sélecteur fin)"}
              title="Couleur personnalisée"
              onClick={() => setCustomOpen((o) => !o)}
            >
              <PlusIcon size={14} />
            </button>
          }
        />

        {customOpen && (
          <div id={`${uid}-custom`} className="lq-color-picker__section">
            <SaturationArea hsva={hsva} onChange={emitHsva} />
            <input
              type="range"
              className="lq-color-picker__range lq-color-picker__hue"
              min={0}
              max={360}
              step={1}
              value={Math.round(hsva.h)}
              onChange={(e) => emitHsva({ ...hsva, h: Number(e.target.value), s: hsva.s === 0 && hsva.v > 0 ? 1 : hsva.s })}
              aria-label="Teinte"
              aria-valuetext={`${Math.round(hsva.h)} degrés`}
            />
            <div className="lq-color-picker__value-row">
              <span className="lq-color-picker__preview" style={{ background: colorSwatchBackground(current) }} aria-hidden="true" />
              <HexInput value={current} alpha={alpha} onCommit={(c) => emitColor(c, false)} />
              {dropper && (
                <button
                  type="button"
                  className="lq-color-picker__icon-button"
                  aria-label="Prendre une couleur à l'écran (pipette)"
                  title="Pipette"
                  onClick={async () => {
                    try {
                      const res = await new dropper().open();
                      emitColor(res.sRGBHex, true);
                    } catch {
                      /* annulé (Échap) */
                    }
                  }}
                >
                  <EyeDropperIcon />
                </button>
              )}
              <button
                type="button"
                className="lq-color-picker__icon-button"
                aria-label="Ajouter aux couleurs récentes"
                title="Ajouter aux couleurs récentes"
                onClick={() => {
                  update((p) => pushRecentColor(p, current));
                  setCustomOpen(false);
                }}
              >
                <CheckIcon size={14} />
              </button>
            </div>
          </div>
        )}

        {alpha && (
          <div className="lq-color-picker__row">
            <label className="lq-color-picker__label" htmlFor={`${uid}-alpha`}>
              Opacité
            </label>
            <div className="lq-color-picker__row-control">
              <input
                id={`${uid}-alpha`}
                type="range"
                className="lq-color-picker__range lq-color-picker__alpha"
                style={{ ["--lq-color-picker-opaque" as string]: opaque }}
                min={0}
                max={100}
                step={1}
                value={Math.round(hsva.a * 100)}
                onChange={(e) => emitHsva({ ...hsva, a: Number(e.target.value) / 100 })}
                aria-valuetext={`${Math.round(hsva.a * 100)} %`}
              />
              <AlphaInput value={Math.round(hsva.a * 100)} onChange={(pct) => emitHsva({ ...hsva, a: pct / 100 })} />
            </div>
          </div>
        )}

        {onThicknessChange && (
          <div className="lq-color-picker__row">
            <span className="lq-color-picker__label" id={`${uid}-thickness`}>
              Épaisseur
            </span>
            <div className="lq-color-picker__thickness" role="radiogroup" aria-labelledby={`${uid}-thickness`}>
              {thicknessOptions.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={thickness === w}
                  aria-label={`${w} px`}
                  title={`${w} px`}
                  className="lq-color-picker__thickness-option"
                  onClick={() => onThicknessChange(w)}
                >
                  <span style={{ height: w }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lq-color-picker__footer">
          <button
            type="button"
            className="lq-color-picker__link"
            aria-expanded={setsOpen}
            aria-controls={`${uid}-sets`}
            onClick={() => setSetsOpen((o) => !o)}
          >
            Jeux de couleurs{preferences.colorSets.length ? ` (${preferences.colorSets.length})` : ""}
            <ChevronDownIcon size={12} style={{ transform: setsOpen ? "rotate(180deg)" : undefined }} />
          </button>
        </div>
        {setsOpen && (
          <div id={`${uid}-sets`}>
            <ColorSetsSection
              sets={preferences.colorSets}
              activeId={preferences.activeColorSetId ?? null}
              current={current}
              recent={preferences.recentColors}
              update={update}
              onPick={(c) => emitColor(c, false)}
              onLayout={relayout}
            />
          </div>
        )}
      </div>
    </Popover>
  );
}

/** Grille de pastilles, navigable aux flèches (un seul arrêt de tabulation : la couleur choisie, sinon la première). */
function SwatchGrid({
  label,
  colors,
  current,
  onPick,
  compareOpaque,
  opaque,
  emptyText,
  onRemove,
  trailing,
  separateFirstRow,
}: {
  label: string;
  colors: string[];
  current: string;
  onPick: (c: string) => void;
  compareOpaque?: boolean;
  opaque?: string;
  emptyText?: string;
  onRemove?: (index: number) => void;
  /** Un élément de plus en fin de grille (le « + » des récentes). */
  trailing?: ReactNode;
  /** Un peu d'espace sous la première rangée (les gris de la palette de base). */
  separateFirstRow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const norm = colors.map((c) => normalizeColor(c));
  const target = compareOpaque ? opaque : current;
  const selectedIndex = norm.findIndex((c) => c === target);
  const [focusIndex, setFocusIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  if (colors.length === 0 && !trailing) return emptyText ? <p className="lq-color-picker__empty">{emptyText}</p> : null;
  const tabStop = Math.min(focusIndex, colors.length - 1);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button[data-lq-swatch]") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const cols = (ref.current ? getComputedStyle(ref.current).gridTemplateColumns.split(" ").filter(Boolean).length : 0) || COLUMNS;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: buttons.length - 1 - i };
    const delta = moves[e.key];
    if (delta === undefined) {
      if ((e.key === "Delete" || e.key === "Backspace") && onRemove) {
        e.preventDefault();
        onRemove(i);
      }
      return;
    }
    e.preventDefault();
    const next = Math.max(0, Math.min(buttons.length - 1, i + delta));
    setFocusIndex(next);
    buttons[next]?.focus();
  };

  return (
    <div ref={ref} className={["lq-color-picker__grid", separateFirstRow && "lq-color-picker__grid--first-row"].filter(Boolean).join(" ")} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {colors.map((c, i) => {
        const selected = norm[i] === target;
        return (
          <span key={`${c}-${i}`} className="lq-color-picker__cell">
            <button
              type="button"
              data-lq-swatch=""
              data-lq-color-selected={selected ? "true" : undefined}
              className="lq-color-picker__grid-swatch"
              style={{ background: colorSwatchBackground(c) }}
              tabIndex={i === tabStop ? 0 : -1}
              aria-label={`${norm[i]}${selected ? " (actuelle)" : ""}`}
              aria-pressed={selected}
              title={norm[i]}
              onFocus={() => setFocusIndex(i)}
              onClick={() => onPick(c)}
            />
            {onRemove && (
              <button type="button" className="lq-color-picker__remove" tabIndex={-1} aria-label={`Retirer ${norm[i]} du jeu`} onClick={() => onRemove(i)}>
                <CloseIcon size={10} />
              </button>
            )}
          </span>
        );
      })}
      {trailing}
    </div>
  );
}

/** Zone saturation (horizontale) × luminosité (verticale), à la souris, au doigt ou aux flèches. */
function SaturationArea({ hsva, onChange }: { hsva: HsvaColor; onChange: (c: HsvaColor) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hsvaRef = useRef(hsva);
  hsvaRef.current = hsva;
  const fromPointer = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    const s = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
    onChange({ ...hsvaRef.current, s, v });
  };
  const hueColor = formatHex(hsvaToRgba({ h: hsva.h, s: 1, v: 1, a: 1 }));
  return (
    <div
      ref={ref}
      className="lq-color-picker__area"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
      role="slider"
      tabIndex={0}
      aria-label="Saturation et luminosité"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsva.s * 100)}
      aria-valuetext={`Saturation ${Math.round(hsva.s * 100)} %, luminosité ${Math.round(hsva.v * 100)} %`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus({ preventScroll: true });
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        fromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) fromPointer(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const m = d[e.key];
        if (!m) return;
        e.preventDefault();
        onChange({ ...hsva, s: Math.min(1, Math.max(0, hsva.s + m[0])), v: Math.min(1, Math.max(0, hsva.v + m[1])) });
      }}
    >
      <span className="lq-color-picker__area-thumb" style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%`, background: formatHex({ ...hsvaToRgba(hsva), a: 1 }) }} aria-hidden="true" />
    </div>
  );
}

function HexInput({ value, alpha, onCommit }: { value: string; alpha: boolean; onCommit: (c: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.replace(/^#/, "").toUpperCase();
  const commit = () => {
    if (draft === null) return;
    const c = parseHexInput(draft);
    if (c) onCommit(formatHex(alpha ? c : { ...c, a: 1 }));
    setDraft(null);
  };
  const invalid = draft !== null && !parseHexInput(draft);
  return (
    <span className="lq-color-picker__hex">
      <span aria-hidden="true">#</span>
      <input
        type="text"
        inputMode="text"
        spellCheck={false}
        autoComplete="off"
        maxLength={alpha ? 9 : 7}
        aria-label={alpha ? "Code hexadécimal (RRVVBB ou RRVVBBAA)" : "Code hexadécimal (RRVVBB)"}
        aria-invalid={invalid || undefined}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          const c = parseHexInput(e.target.value);
          // Code complet (6 ou 8 chiffres) : appliqué tout de suite ; 3 ou 4 chiffres attendent Entrée ou la sortie du champ.
          if (c && /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value.trim())) onCommit(formatHex(alpha ? c : { ...c, a: 1 }));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </span>
  );
}

function AlphaInput({ value, onChange }: { value: number; onChange: (pct: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(",", "."));
    if (Number.isFinite(n)) onChange(Math.min(100, Math.max(0, Math.round(n))));
    setDraft(null);
  };
  return (
    <span className="lq-color-picker__pct">
      <input
        type="text"
        inputMode="numeric"
        aria-label="Opacité en pourcentage"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <span aria-hidden="true">%</span>
    </span>
  );
}

const newSetId = () => `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function ColorSetsSection({
  sets,
  activeId,
  current,
  recent,
  update,
  onPick,
  onLayout,
}: {
  sets: ColorSet[];
  activeId: string | null;
  current: string;
  recent: string[];
  update: PanelProps["update"];
  onPick: (c: string) => void;
  onLayout: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const uid = useId();
  useEffect(onLayout, [creating, editing, sets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultName = useMemo(() => `Jeu ${sets.length + 1}`, [sets.length]);
  const create = (colors: string[]) => {
    const set: ColorSet = { id: newSetId(), name: name.trim() || defaultName, colors: colors.map(normalizeColor).slice(0, MAX_SET_COLORS) };
    update((p) => ({ ...p, colorSets: [...p.colorSets, set] }));
    setCreating(false);
    setName("");
  };
  const patchSet = (id: string, fn: (s: ColorSet) => ColorSet) => update((p) => ({ ...p, colorSets: p.colorSets.map((s) => (s.id === id ? fn(s) : s)) }));
  const finishRename = (s: ColorSet) => {
    const n = editName.trim();
    if (n && n !== s.name) patchSet(s.id, (x) => ({ ...x, name: n }));
    setEditing(null);
  };

  return (
    <div className="lq-color-picker__section">
      <div className="lq-color-picker__heading lq-color-picker__heading--end">
        {!creating && (
          <button type="button" className="lq-color-picker__link" onClick={() => setCreating(true)}>
            <PlusIcon size={12} /> Nouveau jeu
          </button>
        )}
      </div>
      {creating && (
        <div className="lq-color-picker__create">
          <input
            type="text"
            className="lq-color-picker__text"
            autoFocus
            placeholder={defaultName}
            aria-label="Nom du nouveau jeu"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create(recent.length ? recent : [current]);
              }
            }}
          />
          <div className="lq-color-picker__create-actions">
            <button type="button" className="lq-color-picker__button" disabled={recent.length === 0} onClick={() => create(recent)} title="Le jeu reprend les couleurs récentes">
              Avec les récentes ({recent.length})
            </button>
            <button type="button" className="lq-color-picker__button" onClick={() => create([current])}>
              Avec la couleur actuelle
            </button>
            <button type="button" className="lq-color-picker__button lq-color-picker__button--ghost" onClick={() => setCreating(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {sets.length === 0 && !creating && <p className="lq-color-picker__empty">Enregistrez vos couleurs favorites pour les retrouver dans tous les sélecteurs.</p>}
      {sets.map((s) => {
        const isEditing = editing === s.id;
        const isActive = s.id === activeId;
        const hasCurrent = s.colors.some((c) => normalizeColor(c) === current);
        return (
          <div key={s.id} className={["lq-color-picker__set", isActive && "lq-color-picker__set--active"].filter(Boolean).join(" ")}>
            <div className="lq-color-picker__set-head">
              {isEditing ? (
                <input
                  type="text"
                  className="lq-color-picker__text"
                  autoFocus
                  aria-label={`Nouveau nom du jeu ${s.name}`}
                  value={editName}
                  maxLength={40}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => finishRename(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      finishRename(s);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <span className="lq-color-picker__set-name" id={`${uid}-${s.id}`}>
                  {s.name}
                </span>
              )}
              <button
                type="button"
                className="lq-color-picker__icon-button"
                aria-pressed={isActive}
                aria-label={isActive ? `Ne plus appliquer le jeu ${s.name}` : `Appliquer le jeu ${s.name} (ses couleurs en tête de chaque sélecteur)`}
                title={isActive ? "Jeu appliqué — cliquer pour revenir à la palette de base" : "Appliquer ce jeu"}
                onClick={() => update((p) => ({ ...p, activeColorSetId: isActive ? null : s.id }))}
              >
                <StarIcon size={14} fill={isActive ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                className="lq-color-picker__icon-button"
                disabled={hasCurrent || s.colors.length >= MAX_SET_COLORS}
                aria-label={`Ajouter la couleur actuelle au jeu ${s.name}`}
                title={hasCurrent ? "La couleur actuelle est déjà dans ce jeu" : "Ajouter la couleur actuelle"}
                onClick={() => patchSet(s.id, (x) => ({ ...x, colors: [...x.colors, current] }))}
              >
                <PlusIcon size={14} />
              </button>
              <button
                type="button"
                className="lq-color-picker__icon-button"
                aria-pressed={isEditing}
                aria-label={isEditing ? `Terminer la modification du jeu ${s.name}` : `Renommer ou modifier le jeu ${s.name}`}
                title={isEditing ? "Terminer" : "Renommer, retirer des couleurs"}
                onMouseDown={(e) => isEditing && e.preventDefault()}
                onClick={() => {
                  if (isEditing) finishRename(s);
                  else {
                    setEditName(s.name);
                    setEditing(s.id);
                  }
                }}
              >
                {isEditing ? <CheckIcon size={14} /> : <PencilIcon size={14} />}
              </button>
              <button
                type="button"
                className="lq-color-picker__icon-button"
                aria-label={`Supprimer le jeu ${s.name}`}
                title="Supprimer ce jeu"
                onClick={() => update((p) => ({ ...p, colorSets: p.colorSets.filter((x) => x.id !== s.id), activeColorSetId: p.activeColorSetId === s.id ? null : p.activeColorSetId }))}
              >
                <TrashIcon size={14} />
              </button>
            </div>
            <SwatchGrid
              label={`Couleurs du jeu ${s.name}`}
              colors={s.colors}
              current={current}
              onPick={onPick}
              emptyText="Jeu vide : « + » y ajoute la couleur actuelle."
              onRemove={isEditing ? (i) => patchSet(s.id, (x) => ({ ...x, colors: x.colors.filter((_, j) => j !== i) })) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

function EyeDropperIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  );
}
