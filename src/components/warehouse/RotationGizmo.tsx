import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import "./RotationGizmo.css";

/**
 * Un gizmo de rotation : un cadran qu'on attrape et qu'on tourne, sur 360°.
 *
 * La poignée est là où pointe le cap, et la faire tourner d'un tour de cadran fait faire un tour à
 * la caméra : c'est l'angle du pointeur autour du centre qui **est** le cap, et non un déplacement
 * qu'on additionne. Rien ne dérive donc à force de tourner, et lâcher puis reprendre la poignée
 * repart de là où elle est.
 *
 * Au clavier : flèches ±15°, Maj + flèches ±1°, Début pour revenir à 0. Double-clic aussi. Le cadran
 * est un `slider` au sens de l'accessibilité, avec sa valeur en degrés.
 *
 * Il ne tourne rien lui-même : il donne un angle (`value`, `onChange`). Posé autour d'une scène, c'est
 * `IsoCamera` qui fait tourner la caméra de toutes les pièces isométriques qu'elle contient.
 *
 * Le cadran n'est pas le seul moyen de tourner : `useDragRotation`, dans ce fichier, fait tourner la
 * vue en **tirant dans la scène au clic molette**, et les deux règlent le même angle.
 */

export interface RotationGizmoProps {
  /** L'angle, en degrés, de 0 à 360. */
  value: number;
  onChange: (degrees: number) => void;
  /** Diamètre du cadran, en pixels. */
  size?: number;
  /** Pas de l'aimantation pendant le glisser, en degrés. `0` : aucune. */
  snap?: number;
  label?: string;
  className?: string;
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Tourner la vue **en tirant dans la scène elle-même**, au bouton du milieu — le clic molette, celui
 * qu'on trouve sous le doigt dans tous les visualiseurs 3D. Le gizmo dit l'angle et le règle au
 * degré près ; ceci le change là où l'on regarde, sans viser un cadran de 76 pixels.
 *
 * Le bouton du milieu plutôt que le gauche, parce que le gauche appartient au contenu : une scène
 * peut avoir des pièces qu'on sélectionne ou qu'on déplace, et un glisser qui ferait les deux à la
 * fois n'en ferait aucun correctement.
 *
 * C'est le **déplacement horizontal** qui tourne, et non l'angle du pointeur : on n'est pas sur un
 * cadran, il n'y a pas de centre autour duquel tourner. Le cap s'accumule donc, et on suit le cap
 * courant par une référence plutôt que par la valeur du rendu : deux `pointermove` peuvent arriver
 * avant le rendu suivant, et le second lirait alors un cap déjà périmé.
 *
 * Le navigateur ouvre son défilement automatique sur un clic molette : `preventDefault` sur
 * `mousedown` est ce qui l'empêche, le `pointerdown` ne suffisant pas.
 */
export function useDragRotation(value: number, onChange: (degrees: number) => void, degreesPerPixel = 0.6) {
  const from = useRef<{ x: number; yaw: number } | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const notify = useRef(onChange);
  notify.current = onChange;

  /**
   * Un angle par image affichée, et non un par événement.
   *
   *  Une souris rapporte sa position bien plus souvent que l'écran n'affiche : cent vingt fois par
   *  seconde, parfois davantage, contre soixante images. Chaque `pointermove` refaisait pourtant
   *  tourner toute la scène — jusqu'à deux rendus complets pour une seule image montrée, dont un
   *  que personne ne voit. On retient donc le dernier cap et on ne le publie qu'à la frame : le
   *  travail utile est le même, le travail perdu disparaît.
   *
   *  C'est bien le **dernier** cap qu'on garde, et non une moyenne : entre deux images, la position
   *  qui compte est celle où le pointeur se trouve, pas le chemin qu'il a pris pour y arriver.
   */
  const pending = useRef<number | null>(null);
  const raf = useRef(0);
  const flush = () => {
    raf.current = 0;
    const next = pending.current;
    pending.current = null;
    if (next !== null) notify.current(next);
  };
  const publish = (deg: number) => {
    pending.current = deg;
    if (raf.current === 0) raf.current = requestAnimationFrame(flush);
  };
  const settle = () => {
    if (raf.current !== 0) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    flush();
  };

  return {
    onMouseDown: (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    },
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      from.current = { x: event.clientX, yaw: latest.current };
    },
    onPointerMove: (event: PointerEvent) => {
      if (!from.current) return;
      const next = norm(from.current.yaw + (event.clientX - from.current.x) * degreesPerPixel);
      latest.current = next;
      publish(Math.round(next * 10) / 10);
    },
    onPointerUp: (event: PointerEvent) => {
      if (from.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      from.current = null;
      // Le dernier cap est publié tout de suite : attendre une image de plus laisserait la scène
      // s'arrêter un cheveu avant l'endroit où le doigt l'a lâchée.
      settle();
    },
    // Sans quoi un clic molette colle l'onglet ouvert d'un lien survolé, ou déclenche le défilement.
    onAuxClick: (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    },
  };
}

export function RotationGizmo({ value, onChange, size = 76, snap = 0, label = "Rotation de la vue", className }: RotationGizmoProps) {
  const dial = useRef<SVGSVGElement | null>(null);
  const r = size / 2;
  const track = r - 9;
  const angle = norm(value);
  // 0° en haut, dans le sens des aiguilles d'une montre — le sens où tourne une vue vue de dessus.
  const rad = ((angle - 90) * Math.PI) / 180;
  const knob = { x: r + track * Math.cos(rad), y: r + track * Math.sin(rad) };

  const fromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = dial.current?.getBoundingClientRect();
    if (!box) return;
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    if (dx * dx + dy * dy < 16) return;
    let deg = norm((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    // Maj aimante au quart de tour, comme dans tout éditeur.
    const step = event.shiftKey ? 45 : snap;
    if (step > 0) deg = norm(Math.round(deg / step) * step);
    onChange(Math.round(deg * 10) / 10);
  };

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = event.shiftKey ? 1 : 15;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") onChange(norm(angle + step));
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") onChange(norm(angle - step));
    else if (event.key === "Home") onChange(0);
    else return;
    event.preventDefault();
  };

  // Les graduations : un trait tous les 15°, plus long aux quarts.
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = ((i * 15 - 90) * Math.PI) / 180;
    const long = i % 6 === 0;
    const r0 = track + (long ? -6 : -3);
    const r1 = track + 3;
    return (
      <line
        key={i}
        className={long ? "lq-gizmo__tick lq-gizmo__tick--major" : "lq-gizmo__tick"}
        x1={r + r0 * Math.cos(a)}
        y1={r + r0 * Math.sin(a)}
        x2={r + r1 * Math.cos(a)}
        y2={r + r1 * Math.sin(a)}
      />
    );
  });

  return (
    <div className={["lq-gizmo", className].filter(Boolean).join(" ")}>
      <svg
        ref={dial}
        className="lq-gizmo__dial"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(angle)}
        aria-valuetext={`${Math.round(angle)}°`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          fromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event);
        }}
        onDoubleClick={() => onChange(0)}
        onKeyDown={onKey}
      >
        <circle className="lq-gizmo__face" cx={r} cy={r} r={r - 1} />
        <circle className="lq-gizmo__track" cx={r} cy={r} r={track} />
        {ticks}
        {/* L'arc parcouru depuis 0 : on voit d'un coup d'œil de combien la vue a tourné. */}
        {angle > 0.05 && (
          <path
            className="lq-gizmo__arc"
            d={`M ${r} ${r - track} A ${track} ${track} 0 ${angle > 180 ? 1 : 0} 1 ${knob.x} ${knob.y}`}
          />
        )}
        <line className="lq-gizmo__needle" x1={r} y1={r} x2={knob.x} y2={knob.y} />
        <circle className="lq-gizmo__hub" cx={r} cy={r} r={3} />
        <circle className="lq-gizmo__knob" cx={knob.x} cy={knob.y} r={6} />
      </svg>
      <output className="lq-gizmo__value">{Math.round(angle)}°</output>
    </div>
  );
}
