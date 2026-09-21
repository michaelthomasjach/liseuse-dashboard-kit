import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Conveyor } from "./Conveyor";
import { projectIso } from "./warehouseIso";
import { NumberField } from "../forms";

const meta: Meta<typeof Conveyor> = {
  title: "Warehouse/Tapis roulant",
  component: Conveyor,
};
export default meta;
type Story = StoryObj<typeof Conveyor>;

export const Droit: Story = {
  name: "Tapis droit",
  args: {
    kind: "straight",
    length: 7,
    width: 1.6,
    legHeight: 1,
    bedThickness: 0.22,
    guardHeight: 0.14,
    load: "carton",
    loadCount: 2,
    speed: 1.1,
    reversed: false,
    running: true,
    cellSize: 34,
  },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <Conveyor {...args} />
    </div>
  ),
};

/** L'angle est le module de transfert carré qu'un vrai sol utilise pour tourner une ligne : la
 *  bande décrit un quart de cercle centré sur le coin, tangente à l'entrée comme à la sortie, donc
 *  elle se raccorde d'équerre à un tapis droit des deux côtés. Les trois orientations montrent que
 *  la rotation ne change pas le module, seulement d'où on le regarde : les faces visibles de chaque
 *  volume sont choisies d'après elle, et non supposées. */
export const Angle: Story = {
  name: "Tapis d'angle",
  args: {
    kind: "corner",
    width: 2.4,
    legHeight: 1,
    bedThickness: 0.22,
    guardHeight: 0.14,
    load: "carton",
    speed: 1.1,
    reversed: false,
    running: true,
    cellSize: 34,
  },
  render: (args) => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[0, 45, 90].map((angle) => (
        <div key={angle} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Conveyor {...args} rotation={angle} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{angle}°</span>
        </div>
      ))}
    </div>
  ),
};

/** Une seule flèche dit le sens, et elle ne bouge pas : une marque qu'il faut voir s'animer pour
 *  la lire est une marque que la moitié des lecteurs ne lit jamais — `prefers-reduced-motion`, un
 *  onglet en pause, une capture d'écran. Ce qui bouge, c'est la charge, qui est la chose honnête à
 *  animer : un convoyeur n'est intéressant que parce que quelque chose y va quelque part. */
export const Sens: Story = {
  name: "Avant, arrière, arrêté",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[
        { label: "Avant", reversed: false, running: true },
        { label: "Arrière", reversed: true, running: true },
        { label: "Arrêté", reversed: false, running: false },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Conveyor kind="straight" length={5} width={1.6} legHeight={1} cellSize={30} load="carton" reversed={it.reversed} running={it.running} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/** La vitesse est en **cases par seconde**, pas en durée : à la même vitesse, un tapis long et un
 *  angle vont à la même allure, alors qu'une durée les ferait aller à des allures différentes. */
export const Atelier: Story = {
  name: "Régler le tapis",
  render: function Render() {
    const [kind, setKind] = useState<"straight" | "corner">("straight");
    const [size, setSize] = useState({ length: 7, width: 1.6, legs: 1 });
    const [speed, setSpeed] = useState(1.1);
    const [reversed, setReversed] = useState(false);
    const [running, setRunning] = useState(true);

    const field = (
      label: string,
      value: number,
      onChange: (next: number) => void,
      { min, max, step }: { min: number; max: number; step: number }
    ) => (
      <NumberField
        label={label}
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => onChange(next === "" ? min : Math.max(min, Math.min(max, next)))}
      />
    );

    const button = (label: string, on: boolean, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        style={{ font: "inherit", fontSize: "0.7rem", padding: "6px 10px", cursor: "pointer", fontWeight: on ? 700 : 400 }}
      >
        {label}
      </button>
    );

    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 210 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {button("Droit", kind === "straight", () => setKind("straight"))}
            {button("Angle", kind === "corner", () => setKind("corner"))}
          </div>
          {kind === "straight" && field("Longueur", size.length, (length) => setSize((s) => ({ ...s, length })), { min: 2, max: 16, step: 0.5 })}
          {field("Largeur", size.width, (width) => setSize((s) => ({ ...s, width })), { min: 0.8, max: 4, step: 0.2 })}
          {field("Hauteur des pieds", size.legs, (legs) => setSize((s) => ({ ...s, legs })), { min: 0, max: 4, step: 0.1 })}
          {field("Vitesse (cases/s)", speed, setSpeed, { min: 0.1, max: 6, step: 0.1 })}
          <div style={{ display: "flex", gap: 6 }}>
            {button(reversed ? "← Arrière" : "Avant →", true, () => setReversed((r) => !r))}
            {button(running ? "En marche" : "Arrêté", running, () => setRunning((r) => !r))}
          </div>
        </div>

        <div style={{ flex: "1 1 360px", minWidth: 0, overflow: "auto" }}>
          <Conveyor
            kind={kind}
            length={size.length}
            width={size.width}
            legHeight={size.legs}
            load="carton"
            loadCount={kind === "straight" ? 2 : 1}
            speed={speed}
            reversed={reversed}
            running={running}
            cellSize={38}
          />
        </div>
      </div>
    );
  },
};

/**
 * Un droit et un angle **réellement raccordés**, et non posés côte à côte.
 *
 * Chacun est son propre dessin, avec sa propre `viewBox`, donc les accoler ne suffit pas : il faut
 * savoir de combien décaler le second. La réponse se lit sur la caméra du kit — le module d'angle
 * commence là où le droit finit, c'est-à-dire au point `(longueur, 0)` du monde, et `projectIso`
 * dit où ce point tombe à l'écran. Les deux tapis partageant la même largeur, la même hauteur de
 * pieds et la même épaisseur, leurs deux `viewBox` ont exactement la même origine, et ce décalage
 * est donc aussi celui de leurs coins supérieurs gauches.
 *
 * Le raccord tient parce que la bande de l'angle est **tangente** à ses deux bords : elle arrive
 * d'équerre sur le droit, à la même largeur et au même endroit.
 */
export const Ligne: Story = {
  name: "Un droit raccordé à un angle",
  render: function Render() {
    const cellSize = 34;
    const length = 5;
    const width = 2.2;
    const shift = projectIso(length * cellSize, 0, 0);

    return (
      <div style={{ padding: 40 }}>
        <div style={{ position: "relative", height: 320 }}>
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <Conveyor kind="straight" length={length} width={width} legHeight={1} cellSize={cellSize} load="carton" speed={1.1} />
          </div>
          <div style={{ position: "absolute", left: shift.x, top: shift.y }}>
            <Conveyor kind="corner" width={width} legHeight={1} cellSize={cellSize} load="carton" speed={1.1} />
          </div>
        </div>
      </div>
    );
  },
};

/** Un colis rond est dispensé du découpage en tronçons : un fût a le même dessin sous tous les
 *  caps, donc il est dessiné une fois et simplement porté. À côté, un carton, qui lui doit être
 *  redessiné à chaque cap. */
export const Rond: Story = {
  name: "Une charge ronde",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <Conveyor kind="corner" width={2.4} legHeight={1} cellSize={40} load="bidon" />
      <Conveyor kind="corner" width={2.4} legHeight={1} cellSize={40} load="carton" />
    </div>
  ),
};

/**
 * Une boucle fermée : droit, angle, droit, angle, droit, angle, droit, angle — et **un colis ne
 * disparaît jamais** à une jonction, il y passe.
 *
 * Trois choses le permettent, et aucune n'est un réglage à tâtons.
 *
 * Les huit modules **partagent un cadre** (`frame`), donc la même `viewBox` et la même taille : les
 * superposer suffit à les raccorder, il n'y a rien à aligner puisqu'ils sont déjà dans le même
 * repère. Chacun est posé par son `origin`, calculé en chaînant les modules : l'entrée de la bande
 * est au même endroit dans le repère local d'un droit et d'un angle — `(0, largeur / 2)` — donc il
 * suffit de faire coïncider l'entrée de l'un avec la sortie du précédent. Le cap s'accumule tout
 * seul : un angle tourne d'un quart, donc les rotations sont 0, 0, 90, 90, 180, 180, 270, 270.
 *
 * Le fondu d'entrée et de sortie est **coupé** (`fadeEnds={false}`) : un module seul n'a pas d'amont
 * à montrer et doit s'effacer, un module au milieu d'une chaîne en a un.
 *
 * Et **un seul colis** circule, pas un par module. Chaque module reçoit le `span` qu'il occupe dans
 * le tour de boucle — la distance parcourue avant lui et celle après, rapportées au périmètre — et
 * ne montre la charge que pendant qu'elle y est, restant vide le reste du temps. Son cycle
 * d'animation est donc le tour entier, et non sa propre traversée. La vitesse étant en cases par
 * seconde, tous les modules avancent du même pas, et le colis quitte un module à l'instant même où
 * le suivant le reçoit, au même point et au même cap.
 */
export const Boucle: Story = {
  name: "Une boucle fermée",
  render: function Render() {
    const cellSize = 26;
    const W = 2.2;
    const arc = (Math.PI / 4) * W; // la longueur d'un quart de cercle de rayon W / 2
    const L = 2 * arc; // pour que les deux longueurs soient commensurables
    const speed = 1.4;

    // La chaîne : on enfile les modules en faisant coïncider l'entrée de chacun avec la sortie du
    // précédent. L'entrée d'un module est en (0, W / 2) dans son repère avant rotation, la sortie
    // en (L, W / 2) pour un droit et en (W / 2, W) pour un angle.
    const turn = (deg: number, px: number, py: number, cx: number, cy: number) => {
      const r = (deg * Math.PI) / 180;
      const c = Math.cos(r);
      const sn = Math.sin(r);
      return { x: cx + (px - cx) * c - (py - cy) * sn, y: cy + (px - cx) * sn + (py - cy) * c };
    };

    const modules: {
      kind: "straight" | "corner";
      rotation: number;
      origin: { x: number; y: number };
      run: number;
      from: number;
    }[] = [];
    let here = { x: 0, y: 0 };
    let heading = 0;
    let travelled = 0;
    for (let i = 0; i < 8; i += 1) {
      const corner = i % 2 === 1;
      const spanX = corner ? W : L;
      const cx = spanX / 2;
      const cy = W / 2;
      const entry = turn(heading, 0, W / 2, cx, cy);
      const exit = corner ? turn(heading, W / 2, W, cx, cy) : turn(heading, L, W / 2, cx, cy);
      const origin = { x: here.x - entry.x, y: here.y - entry.y };
      const run = corner ? arc : L;
      modules.push({ kind: corner ? "corner" : "straight", rotation: heading, origin, run, from: travelled });
      here = { x: origin.x + exit.x, y: origin.y + exit.y };
      travelled += run;
      if (corner) heading += 90;
    }

    // Le cadre commun : l'emprise de tout le monde, plus une case de marge.
    const boxes = modules.map((m) => {
      const spanX = m.kind === "corner" ? W : L;
      const flat = m.rotation % 180 === 0;
      const halfW = (flat ? spanX : W) / 2;
      const halfH = (flat ? W : spanX) / 2;
      return { cx: m.origin.x + spanX / 2, cy: m.origin.y + W / 2, halfW, halfH };
    });
    const frame = {
      x: Math.min(...boxes.map((b) => b.cx - b.halfW)) - 0.5,
      y: Math.min(...boxes.map((b) => b.cy - b.halfH)) - 0.5,
      width: Math.max(...boxes.map((b) => b.cx + b.halfW)) - Math.min(...boxes.map((b) => b.cx - b.halfW)) + 1,
      depth: Math.max(...boxes.map((b) => b.cy + b.halfH)) - Math.min(...boxes.map((b) => b.cy - b.halfH)) + 1,
      height: 1 + 0.22 + 0.14,
    };

    // Du fond vers l'avant : les modules sont disjoints, donc leur ordre est celui de la profondeur,
    // qui tient dans x + y.
    const order = modules
      .map((m, i) => ({ m, key: boxes[i].cx + boxes[i].cy, i }))
      .sort((a, b) => a.key - b.key);

    // Les huit dessins sont en position absolue : le conteneur doit donc réserver la place lui-même,
    // qui est celle du cadre projeté — la même arithmétique que la `viewBox` des modules.
    const shot = [0, frame.height].flatMap((z) =>
      [
        [frame.x, frame.y],
        [frame.x + frame.width, frame.y],
        [frame.x + frame.width, frame.y + frame.depth],
        [frame.x, frame.y + frame.depth],
      ].map(([x, y]) => projectIso(x * cellSize, y * cellSize, z * cellSize))
    );
    const box = {
      width: Math.max(...shot.map((p) => p.x)) - Math.min(...shot.map((p) => p.x)) + 4,
      height: Math.max(...shot.map((p) => p.y)) - Math.min(...shot.map((p) => p.y)) + 4,
    };

    return (
      <div style={{ padding: 32 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {order.map(({ m, i }) => (
            <div key={i} style={{ position: "absolute", left: 0, top: 0 }}>
              <Conveyor
                kind={m.kind}
                length={L}
                width={W}
                legHeight={1}
                cellSize={cellSize}
                rotation={m.rotation}
                origin={m.origin}
                frame={frame}
                load="carton"
                span={{ start: m.from / travelled, end: (m.from + m.run) / travelled }}
                fadeEnds={false}
                speed={speed}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
};
