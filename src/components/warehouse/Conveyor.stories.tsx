import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Conveyor } from "./Conveyor";
import { useIsoCamera } from "./isoCamera";
import { Scene, footprint, layer, useFrameBox, type SceneUnit } from "./sceneStory";
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
    shadows: true,
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
    shadows: true,
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
 * Les deux **partagent un cadre** (`frame`), donc la même `viewBox` : on les superpose, et chacun
 * est posé par son `origin` en cases du monde. Le module d'angle commence là où le droit finit, au
 * point `(longueur, 0)`. Rien n'est décalé à l'écran — un décalage calculé pour une caméra serait
 * faux dès qu'elle tourne — et c'est la caméra qui dit lequel des deux passe devant.
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
    const frame = { x: -0.5, y: -0.5, width: length + width + 1, depth: width + 1, height: 2.2 };
    const shared = { width, legHeight: 1, cellSize, frame, load: "carton" as const, speed: 1.1, shadows: true };
    const straight = (part: "shadow" | "machine" | "load") => (
      <div style={layer}>
        <Conveyor {...shared} kind="straight" length={length} parts={part} />
      </div>
    );
    const corner = (part: "shadow" | "machine" | "load") => (
      <div style={layer}>
        <Conveyor {...shared} kind="corner" origin={{ x: length, y: 0 }} parts={part} />
      </div>
    );
    const units: SceneUnit[] = [
      { key: "straight", x: 0, y: 0, width: length, height: width, shadow: straight("shadow"), machine: straight("machine"), load: straight("load") },
      { key: "corner", x: length, y: 0, width, height: width, shadow: corner("shadow"), machine: corner("machine"), load: corner("load") },
    ];
    return <Scene frame={frame} cellSize={cellSize} units={units} padding={40} />;
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
 * Les machines sont toutes dessinées avant les charges (`parts`). Un colis appartient au module
 * qu'il traverse, donc il hérite de sa place dans la pile — et le module suivant, dessiné après
 * parce qu'il est plus proche, le recouvrait juste au moment où il arrivait à la jonction, ce qui
 * se lisait comme un colis passant *sous* le tapis.
 *
 * Le fondu d'entrée et de sortie est **coupé** (`fadeIn={false}
                  fadeOut={false}`) : un module seul n'a pas d'amont
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
    const cam = useIsoCamera();
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

    // Du fond vers l'avant, pour la caméra courante : les modules sont disjoints, donc c'est elle
    // qui dit lequel est devant.
    const order = cam.order(modules.map((m, i) => ({ m, i, ...footprint(m.origin, m.kind === "corner" ? W : L, W, m.rotation) })));

    // Les huit dessins sont en position absolue : le conteneur doit donc réserver la place lui-même,
    // qui est celle du cadre projeté — la même arithmétique que la `viewBox` des modules.
    const box = useFrameBox(frame, cellSize);

    return (
      <div style={{ padding: 32 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {/* D'abord les huit machines, du fond vers l'avant ; puis les huit couches de charge, par
              dessus. Un colis appartient au module qu'il traverse, donc il hérite de sa place dans
              la pile — et le module suivant, dessiné après parce qu'il est plus proche, le
              recouvrait juste au moment où il arrivait à la jonction. */}
          {(["shadow", "machine", "load"] as const).map((part) =>
            order.map(({ m, i }) => (
              <div key={`${part}${i}`} style={{ position: "absolute", left: 0, top: 0 }}>
                <Conveyor
                  kind={m.kind}
                  length={L}
                  width={W}
                  legHeight={1}
                  cellSize={cellSize}
                  rotation={m.rotation}
                  origin={m.origin}
                  frame={frame}
                  parts={part}
                  load="carton"
                  span={{ start: m.from / travelled, end: (m.from + m.run) / travelled }}
                  shadows
                  fadeIn={false}
                  fadeOut={false}
                  speed={speed}
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
};

/**
 * Un circuit qui tourne des deux côtés.
 *
 * Un angle tourne à gauche : sa bande entre par `+x` et sort par `+y`. Pour tourner à **droite**, on
 * le parcourt à l'envers — `reversed` fait entrer la charge par la sortie, donc le module prend le
 * flux par `−y` et le rend par `−x`, soit un quart de tour dans l'autre sens. Il n'y a pas de
 * module miroir à écrire : une rotation ne peut pas retourner une forme, mais un sens de marche,
 * si.
 *
 * Un circuit fermé tourne en tout d'un tour complet, donc **gauches − droites = 4** : celui-ci a
 * cinq virages à gauche et un à droite. Sa fermeture n'est pas ajustée à l'œil non plus — un
 * segment droit avance de sa longueur dans son cap, un angle avance de `W/2` dans le cap d'entrée
 * *plus* `W/2` dans celui de sortie, et il suffit d'imposer que la somme soit nulle sur les deux
 * axes pour trouver les deux dernières longueurs.
 *
 * Les longueurs n'ont ici aucune raison d'être commensurables, contrairement à une ligne pleine :
 * avec un seul colis, chaque module reçoit la part du tour qui lui revient et le reste suit.
 */
export const Circuit: Story = {
  name: "Un circuit plus complexe",
  render: function Render() {
    const cam = useIsoCamera();
    const cellSize = 18;
    const W = 2;
    const r = W / 2;
    const speed = 2.2;
    const arc = (Math.PI / 2) * r;

    // gauche − droite = 4, et les deux derniers segments ferment le tracé : e = a + c + 2r sur x,
    // f = b + d + 2r sur y.
    const plan = [
      { run: 3 },
      { turn: "left" as const },
      { run: 2.5 },
      { turn: "right" as const },
      { run: 2.5 },
      { turn: "left" as const },
      { run: 2.5 },
      { turn: "left" as const },
      { run: 3 + 2.5 + 2 * r },
      { turn: "left" as const },
      { run: 2.5 + 2.5 + 2 * r },
      { turn: "left" as const },
    ];

    const spin = (deg: number, px: number, py: number, cx: number, cy: number) => {
      const a = (deg * Math.PI) / 180;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      return { x: cx + (px - cx) * c - (py - cy) * sn, y: cy + (px - cx) * sn + (py - cy) * c };
    };

    const modules: {
      kind: "straight" | "corner";
      length: number;
      rotation: number;
      reversed: boolean;
      origin: { x: number; y: number };
      run: number;
      from: number;
      box: { cx: number; cy: number; halfW: number; halfH: number };
    }[] = [];
    let here = { x: 0, y: 0 };
    let heading = 0;
    let done = 0;
    for (const step of plan) {
      const corner = step.turn !== undefined;
      const right = step.turn === "right";
      const length = corner ? W : (step.run as number);
      // Le module est tourné de façon que le cap d'entrée de sa bande soit celui du flux.
      const rotation = ((corner && right ? heading - 270 : heading) % 360 + 360) % 360;
      const cx = (corner ? W : length) / 2;
      const cy = W / 2;
      const localIn = right ? { x: W / 2, y: W } : { x: 0, y: W / 2 };
      const localOut = right ? { x: 0, y: W / 2 } : corner ? { x: W / 2, y: W } : { x: length, y: W / 2 };
      const entry = spin(rotation, localIn.x, localIn.y, cx, cy);
      const exit = spin(rotation, localOut.x, localOut.y, cx, cy);
      const origin = { x: here.x - entry.x, y: here.y - entry.y };
      const run = corner ? arc : length;
      const flat = rotation % 180 === 0;
      modules.push({
        kind: corner ? "corner" : "straight",
        length,
        rotation,
        reversed: right,
        origin,
        run,
        from: done,
        box: {
          cx: origin.x + cx,
          cy: origin.y + cy,
          halfW: (flat ? (corner ? W : length) : W) / 2,
          halfH: (flat ? W : corner ? W : length) / 2,
        },
      });
      here = { x: origin.x + exit.x, y: origin.y + exit.y };
      done += run;
      heading += corner ? (right ? -90 : 90) : 0;
    }

    const lo = (pick: (b: (typeof modules)[number]["box"]) => number) => Math.min(...modules.map((m) => pick(m.box)));
    const hi = (pick: (b: (typeof modules)[number]["box"]) => number) => Math.max(...modules.map((m) => pick(m.box)));
    const frame = {
      x: lo((b) => b.cx - b.halfW) - 0.5,
      y: lo((b) => b.cy - b.halfH) - 0.5,
      width: hi((b) => b.cx + b.halfW) - lo((b) => b.cx - b.halfW) + 1,
      depth: hi((b) => b.cy + b.halfH) - lo((b) => b.cy - b.halfH) + 1,
      height: 1 + 0.22 + 0.14,
    };
    const box = useFrameBox(frame, cellSize);

    const order = cam.order(
      modules.map((m, i) => ({ m, i, x: m.box.cx - m.box.halfW, y: m.box.cy - m.box.halfH, width: 2 * m.box.halfW, height: 2 * m.box.halfH }))
    );

    return (
      <div style={{ padding: 32 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {(["shadow", "machine", "load"] as const).map((part) =>
            order.map(({ m, i }) => (
              <div key={`${part}${i}`} style={{ position: "absolute", left: 0, top: 0 }}>
                <Conveyor
                  kind={m.kind}
                  length={m.length}
                  width={W}
                  legHeight={1}
                  cellSize={cellSize}
                  rotation={m.rotation}
                  reversed={m.reversed}
                  origin={m.origin}
                  frame={frame}
                  parts={part}
                  load="carton"
                  span={{ start: m.from / done, end: (m.from + m.run) / done }}
                  shadows
                  fadeIn={false}
                  fadeOut={false}
                  speed={speed}
                />
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
};

/** `rise` dit ce que le tapis gagne en hauteur sur toute sa longueur. Ce n'est pas un effet appliqué
 *  après coup : le bâti devient un prisme dont le dessus et le dessous suivent la pente, les pieds
 *  s'allongent à mesure, les barrières montent avec, et la charge aussi — tout ce qui repose sur le
 *  tapis lit sa hauteur à l'abscisse où il se trouve, faute de quoi la moitié du dessin resterait de
 *  niveau. Un tapis incliné est aussi plus *long* que son ombre au sol, donc à vitesse égale il
 *  prend plus de temps. */
export const Pente: Story = {
  name: "Monter et descendre",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[
        { label: "Descend", rise: -1.2 },
        { label: "De niveau", rise: 0 },
        { label: "Monte", rise: 1.2 },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Conveyor kind="straight" length={5} width={1.8} legHeight={0.9} rise={it.rise} cellSize={30} load="carton" speed={1.2} shadows />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Un tapis qui en alimente un autre, **plus bas et à quatre-vingt-dix degrés** : le colis quitte la
 * bande, tombe, et repart.
 *
 * La chute n'est pas une descente en ligne droite mais une **parabole** — un colis qui quitte un
 * tapis garde sa vitesse horizontale et n'acquiert la verticale qu'en tombant. Elle compte dans le
 * trajet du premier module au même titre que sa bande, donc dans sa part du cycle, et le colis y
 * garde le cap qu'il avait en quittant la bande.
 *
 * Le second tapis est posé là où le colis atterrit : le point de chute se déduit de la sortie du
 * premier, et la hauteur de ses pieds de la hauteur de chute. Les deux fondus sont réglés
 * séparément — le premier module fond à l'arrivée mais pas au départ, le second l'inverse — parce
 * qu'un colis ne doit pas s'effacer à une jonction, il doit y passer.
 */
export const Transfert: Story = {
  name: "Une chute vers un autre tapis",
  render: function Render() {
    const cellSize = 26;
    const W = 2;
    const L1 = 5;
    const L2 = 5;
    const thick = 0.22;
    const highLegs = 1.7;
    const fall = 0.7;
    const lowLegs = highLegs - fall;
    const dropRun = 0.9;
    const speed = 1.4;

    // Le colis quitte le premier tapis en (L1, W/2) et touche le second `dropRun` plus loin.
    const landing = { x: L1 + dropRun, y: W / 2 };
    // Le second tapis est tourné d'un quart : son entrée, en (0, W/2) avant rotation, se retrouve
    // en (L2/2, W/2 − L2/2) après. On le pose donc de façon que ce point tombe sur l'atterrissage.
    const origin2 = { x: landing.x - L2 / 2, y: landing.y - (W / 2 - L2 / 2) };

    const boxes = [
      { cx: L1 / 2, cy: W / 2, halfW: L1 / 2, halfH: W / 2 },
      { cx: origin2.x + L2 / 2, cy: origin2.y + W / 2, halfW: W / 2, halfH: L2 / 2 },
    ];
    const frame = {
      x: Math.min(...boxes.map((b) => b.cx - b.halfW)) - 0.5,
      y: Math.min(...boxes.map((b) => b.cy - b.halfH)) - 0.5,
      width: Math.max(...boxes.map((b) => b.cx + b.halfW)) - Math.min(...boxes.map((b) => b.cx - b.halfW)) + 1,
      depth: Math.max(...boxes.map((b) => b.cy + b.halfH)) - Math.min(...boxes.map((b) => b.cy - b.halfH)) + 1,
      height: highLegs + thick + 0.2,
    };
    const total = L1 + dropRun + L2;
    const shared = { width: W, bedThickness: thick, cellSize, frame, load: "carton" as const, speed, shadows: true };
    const high = (part: "shadow" | "machine" | "load") => (
      <div style={layer}>
        <Conveyor
          {...shared}
          kind="straight"
          length={L1}
          legHeight={highLegs}
          parts={part}
          drop={{ fall, run: dropRun }}
          span={{ start: 0, end: (L1 + dropRun) / total }}
          fadeOut={false}
        />
      </div>
    );
    const low = (part: "shadow" | "machine" | "load") => (
      <div style={layer}>
        <Conveyor
          {...shared}
          kind="straight"
          length={L2}
          legHeight={lowLegs}
          rotation={90}
          origin={origin2}
          parts={part}
          span={{ start: (L1 + dropRun) / total, end: 1 }}
          fadeIn={false}
        />
      </div>
    );
    const units: SceneUnit[] = [high, low].map((draw, i) => ({
      key: String(i),
      x: boxes[i].cx - boxes[i].halfW,
      y: boxes[i].cy - boxes[i].halfH,
      width: 2 * boxes[i].halfW,
      height: 2 * boxes[i].halfH,
      shadow: draw("shadow"),
      machine: draw("machine"),
      load: draw("load"),
    }));

    return <Scene frame={frame} cellSize={cellSize} units={units} padding={32} />;
  },
};

/** Le T est le module de bifurcation ou de jonction : la ligne le traverse tout droit et une
 *  dérivation part du milieu, à angle droit. `flow` dit si elle sort de la ligne ou y entre — c'est
 *  la seule chose qui distingue les deux quand rien ne bouge, d'où ses deux flèches — et `branch`
 *  dit si la charge l'emprunte. Une charge n'y **tourne pas** : sur un vrai transfert à angle droit
 *  elle est poussée de côté, donc son cap change d'un coup au milieu et le colis garde le sien. */
export const Te: Story = {
  name: "Tapis en T",
  render: () => (
    <div style={{ display: "flex", gap: 44, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[
        { label: "Bifurcation, tout droit", flow: "split" as const, branch: false },
        { label: "Bifurcation, dérivé", flow: "split" as const, branch: true },
        { label: "Jonction", flow: "merge" as const, branch: true },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Conveyor kind="tee" width={2.4} legHeight={1} cellSize={40} load="carton" flow={it.flow} branch={it.branch} shadows />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};
