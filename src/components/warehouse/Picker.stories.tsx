import { useEffect, useId, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Picker } from "./Picker";
import { Rail } from "./Rail";
import { RackV2 } from "./RackV2";
import { Conveyor } from "./Conveyor";
import { projectIso } from "./warehouseIso";
import { NumberField } from "../forms";
import { railCircuit, type CircuitPiece } from "./railCircuit";

const meta: Meta<typeof Picker> = {
  title: "Warehouse/Picker",
  component: Picker,
};
export default meta;
type Story = StoryObj<typeof Picker>;

/** Le pavé du monde vers la place qu'il prend à l'écran : la même arithmétique que la `viewBox` des
 *  modules, puisque les dessins sont en position absolue et que le conteneur doit réserver la place
 *  lui-même. */
function frameBox(frame: { x: number; y: number; width: number; depth: number; height: number }, cellSize: number) {
  const shot = [0, frame.height].flatMap((z) =>
    [
      [frame.x, frame.y],
      [frame.x + frame.width, frame.y],
      [frame.x + frame.width, frame.y + frame.depth],
      [frame.x, frame.y + frame.depth],
    ].map(([x, y]) => projectIso(x * cellSize, y * cellSize, z * cellSize))
  );
  return {
    width: Math.max(...shot.map((p) => p.x)) - Math.min(...shot.map((p) => p.x)) + 4,
    height: Math.max(...shot.map((p) => p.y)) - Math.min(...shot.map((p) => p.y)) + 4,
  };
}

export const Machine: Story = {
  name: "Le picker",
  args: {
    travel: 10,
    width: 1.8,
    mastHeight: 2.8,
    pick: { at: 2, side: "left", level: 1.9 },
    drop: { at: 8, side: "right", level: 1.1 },
    load: "carton",
    speed: 1.6,
    dwell: 0.5,
    running: true,
    shadows: true,
    cellSize: 34,
  },
  render: (args) => (
    <div style={{ padding: 40, overflow: "auto" }}>
      <Picker {...args} />
    </div>
  ),
};

/**
 * Le picker sur sa voie.
 *
 * Les deux modules **partagent un cadre** (`frame`), donc la même `viewBox` et la même taille : les
 * superposer suffit à les mettre en place. Ils partagent aussi leur emprise — même `origin`, même
 * largeur, et `travel` égal à la longueur du rail — donc les galets tombent sur les files sans que
 * rien n'ait à être ajusté : la hauteur du plan de roulement est la **même constante** des deux
 * côtés (`RAIL_TOP`), et non un nombre recopié.
 *
 * Le rail passe avant la machine, qui se tient dessus. Les ombres passent avant les deux.
 */
export const SurSonRail: Story = {
  name: "Le picker sur son rail",
  render: function Render() {
    const cellSize = 34;
    const L = 11;
    const W = 1.8;
    const frame = { x: -0.5, y: -2.2, width: L + 1, depth: W + 4.4, height: 3.6 };
    const box = frameBox(frame, cellSize);
    const shared = { width: W, cellSize, frame, shadows: true, origin: { x: 0, y: 0 } };

    return (
      <div style={{ padding: 32 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {(["shadow", "machine"] as const).map((part) => (
            <div key={part}>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Rail {...shared} kind="straight" length={L} parts={part} />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Picker
                  {...shared}
                  travel={L}
                  mastHeight={2.8}
                  parts={part}
                  pick={{ at: 2, side: "left", level: 1.9 }}
                  drop={{ at: 9, side: "right", level: 1.1 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Ce pour quoi la machine existe : **prendre dans l'étagère, déposer sur le tapis**.
 *
 * Les quatre modules partagent un cadre, donc un seul repère : l'étagère, le rail, le tapis et la
 * machine sont posés par leur `origin` en cases du monde, et rien n'est ajusté à l'œil. Les cotes de
 * la machine se lisent alors directement sur la scène — `level` est le plan du plateau visé, et
 * `reach` la distance de l'axe du rail à ce qu'on vise.
 *
 * Étagère et tapis sont **du même côté** de la voie, et ce n'est pas une facilité de mise en scène :
 * c'est ce qui permet de peindre la scène dans un ordre juste. La profondeur d'un module tient en
 * `x + y`, et ce classement n'a de sens qu'entre modules qui ne s'interpénètrent pas — or le tablier
 * de la machine passe *au-dessus* de ce qu'il dessert. Tout mettre au fond de la voie et la machine
 * devant règle la question : le picker est le module le plus proche, donc le dernier peint, et son
 * tablier ne peut plus se retrouver derrière ce qu'il va chercher. La desserte des deux côtés est
 * une autre histoire, et c'est la story d'à côté qui la montre.
 *
 * Les ombres passent toutes avant les machines : une ombre est au sol et doit passer sous *tous* les
 * modules, sans quoi l'ombre de l'étagère se poserait par-dessus le rail qu'elle traverse.
 */
export const Scene: Story = {
  name: "Prendre dans l'étagère, déposer sur le tapis",
  render: function Render() {
    const cellSize = 30;
    const W = 1.8;
    const L = 12;

    // ---- la scène, en cases du monde ----
    const rail = { x: 0, y: 5 }; // la voie occupe y 5 → 6,8 ; son axe est à 5,9
    const axis = rail.y + W / 2;

    // L'étagère, au fond : deux niveaux de 1,5, trois portions par plateau.
    const rack = { x: 1, y: 2.6, width: 5, depth: 2, level: 1.5, deck: 0.2 };
    // Le plan qu'un plateau offre : le dessus de la dalle du niveau visé.
    const shelfTop = rack.level + rack.deck;
    // De l'axe du rail au milieu de l'étagère, pour que la charge se pose dans une alvéole et non
    // sur le bord.
    const intoRack = axis - (rack.y + rack.depth * 0.45);

    // Le tapis, au fond lui aussi, dans le prolongement de l'étagère.
    const belt = { x: 7, y: 2.8, width: 1.8, length: 5, legs: 1, bed: 0.22 };
    const beltTop = belt.legs + belt.bed;
    const ontoBelt = axis - (belt.y + belt.width / 2);

    const frame = { x: -0.5, y: 2.1, width: L + 1, depth: 5.2, height: 3.8 };
    const box = frameBox(frame, cellSize);
    const shared = { cellSize, frame, shadows: true };
    const reach = `reach${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const rackProps = {
      ...shared,
      origin: { x: rack.x, y: rack.y },
      width: rack.width,
      depth: rack.depth,
      height: rack.level,
      countZ: 2,
      slotsX: 3,
      contents: ["carton", null, "boite"] as ("carton" | "boite" | null)[],
      posts: true,
      braces: true,
      feet: true,
      deckThickness: rack.deck,
    };

    return (
      <div style={{ padding: 28 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {/* Du fond vers l'avant : l'étagère, le tapis (plus loin sur l'axe des x, donc plus
              proche), la voie, puis la machine qui roule dessus. */}
          {(["shadow", "machine"] as const).map((part) => (
            <div key={part}>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <RackV2 {...rackProps} parts={part} />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Conveyor
                  {...shared}
                  origin={{ x: belt.x, y: belt.y }}
                  kind="straight"
                  length={belt.length}
                  width={belt.width}
                  legHeight={belt.legs}
                  bedThickness={belt.bed}
                  load="carton"
                  speed={1.2}
                  parts={part}
                />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Rail {...shared} origin={rail} kind="straight" length={L} width={W} parts={part} />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Picker
                  {...shared}
                  origin={rail}
                  travel={L}
                  width={W}
                  mastHeight={2.6}
                  speed={1.7}
                  dwell={0.6}
                  load="carton"
                  // Le niveau haut de l'étagère, au milieu de sa longueur.
                  pick={{ at: rack.x + rack.width / 2, side: "left", level: shelfTop, reach: intoRack }}
                  // Le brin du tapis, au milieu de sa longueur. Le tablier s'engage juste au-dessus
                  // et redescend de quoi y laisser le colis.
                  drop={{ at: belt.x + belt.length / 2, side: "left", level: beltTop + 0.2, reach: ontoBelt }}
                  parts={part}
                  reachMask={part === "machine" ? reach : undefined}
                />
              </div>
            </div>
          ))}
          {/* Ce qui, dans l'étagère, passe devant des fourches entrées dans une alvéole : repeint
              par-dessus la machine, mais seulement dans la silhouette des fourches et du colis. */}
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <RackV2 {...rackProps} shadows={false} parts="machine" cover={shelfTop} mask={reach} />
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Desservir **les deux côtés** de la voie, et ce que ça coûte au dessin.
 *
 * Le côté décide de l'ordre de peinture, et l'ordre de peinture est l'ordre du DOM, qui ne peut pas
 * changer en cours d'animation. Le tablier est donc dessiné deux fois — une fois avant le mât, une
 * fois après — et seul celui du côté en cours est visible. Le relais se fait **tablier rentré**, où
 * les deux dessins coïncident exactement : on ne le voit pas, et c'est bien le but.
 *
 * Quand les deux postes sont du même côté, il n'y a qu'un tablier à dessiner et pas de relais à
 * faire — la machine de droite ci-dessous n'en a qu'un.
 */
export const Cotes: Story = {
  name: "Servir les deux côtés",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[
        { label: "De gauche à droite", drop: "right" as const },
        { label: "Du même côté", drop: "left" as const },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Picker
            travel={8}
            mastHeight={2.6}
            cellSize={30}
            shadows
            pick={{ at: 2, side: "left", level: 1.9 }}
            drop={{ at: 6, side: it.drop, level: 1 }}
          />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Le cycle, temps par temps.
 *
 * Douze arrêts sur image d'une seule et même machine — `running={false}` et un `phase` différent.
 * Ce ne sont pas douze dessins : c'est la pose que le composant calcule à une fraction du cycle, la
 * même que celle que le navigateur interpole quand il tourne. Ce qu'on voit ici est donc exactement
 * ce qui passe, et non une reconstitution.
 *
 * On y lit les trois axes et leur ordre : translation et levée **ensemble** (0 → 0,16), puis le
 * tablier qui s'engage (0,25), la prise (0,33), le dégagement (0,42 → 0,5), le transfert (0,58), la
 * présentation au-dessus du tapis (0,75) et la dépose (0,83). Le colis n'apparaît qu'à la prise et
 * ne disparaît qu'à la dépose : entre les deux il ne quitte jamais les fourches.
 */
export const Cycle: Story = {
  name: "Le cycle, temps par temps",
  render: () => (
    <div style={{ display: "flex", gap: 4, padding: 24, flexWrap: "wrap" }}>
      {[0, 0.1, 0.16, 0.25, 0.33, 0.42, 0.5, 0.58, 0.66, 0.75, 0.83, 0.92].map((phase) => (
        <div key={phase} style={{ textAlign: "center" }}>
          <Picker
            travel={7}
            mastHeight={2.6}
            cellSize={24}
            shadows
            running={false}
            phase={phase}
            pick={{ at: 1.6, side: "left", level: 1.9 }}
            drop={{ at: 5.4, side: "right", level: 0.9 }}
          />
          <div style={{ fontSize: "0.68rem", fontVariantNumeric: "tabular-nums" }}>{phase}</div>
        </div>
      ))}
    </div>
  ),
};

/** À vide, et figée. `load={null}` fait tourner la machine sans rien transporter — le cycle est le
 *  même, c'est la charge qui manque. `running={false}` la fige dans la pose que `phase` lui donne :
 *  une capture d'écran, une vue imprimée ou un lecteur qui refuse le mouvement voient cette
 *  pose-là, et non une machine coupée au hasard au milieu d'un geste. */
export const Repos: Story = {
  name: "À vide, et figée",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[
        { label: "À vide", load: null, running: true, phase: 0 },
        { label: "Figée sur la prise", load: "carton" as const, running: false, phase: 0.33 },
        { label: "Figée sur la dépose", load: "carton" as const, running: false, phase: 0.8 },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Picker travel={7} mastHeight={2.6} cellSize={30} shadows load={it.load} running={it.running} phase={it.phase} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Régler la machine.
 *
 * La vitesse est en **cases par seconde** et non en durée, comme celle du tapis : à la même vitesse,
 * un rail long et un rail court vont à la même allure, alors qu'une durée les ferait aller à des
 * allures différentes. La levée et la sortie du tablier s'en déduisent — ce sont des rapports de la
 * machine et non des réglages, et trois curseurs laisseraient régler un transstockeur qui roule
 * moins vite qu'il ne sort ses fourches.
 */
export const Atelier: Story = {
  name: "Régler le picker",
  render: function Render() {
    const [size, setSize] = useState({ travel: 10, width: 1.8, mast: 2.8 });
    const [stops, setStops] = useState({ pickAt: 2, pickLevel: 1.9, dropAt: 8, dropLevel: 1 });
    const [speed, setSpeed] = useState(1.6);
    const [dwell, setDwell] = useState(0.5);

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

    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 210 }}>
          {field("Longueur du rail", size.travel, (travel) => setSize((s) => ({ ...s, travel })), { min: 3, max: 20, step: 0.5 })}
          {field("Hauteur du mât", size.mast, (mast) => setSize((s) => ({ ...s, mast })), { min: 1, max: 6, step: 0.2 })}
          {field("Prise — travée", stops.pickAt, (pickAt) => setStops((s) => ({ ...s, pickAt })), { min: 0, max: 20, step: 0.5 })}
          {field("Prise — niveau", stops.pickLevel, (pickLevel) => setStops((s) => ({ ...s, pickLevel })), { min: 0.2, max: 5, step: 0.1 })}
          {field("Dépose — travée", stops.dropAt, (dropAt) => setStops((s) => ({ ...s, dropAt })), { min: 0, max: 20, step: 0.5 })}
          {field("Dépose — niveau", stops.dropLevel, (dropLevel) => setStops((s) => ({ ...s, dropLevel })), { min: 0.2, max: 5, step: 0.1 })}
          {field("Vitesse (cases/s)", speed, setSpeed, { min: 0.2, max: 6, step: 0.1 })}
          {field("Arrêt (s)", dwell, setDwell, { min: 0, max: 3, step: 0.1 })}
        </div>

        <div style={{ flex: "1 1 360px", minWidth: 0, overflow: "auto" }}>
          <Picker
            travel={size.travel}
            width={size.width}
            mastHeight={size.mast}
            speed={speed}
            dwell={dwell}
            shadows
            pick={{ at: stops.pickAt, side: "left", level: stops.pickLevel }}
            drop={{ at: stops.dropAt, side: "right", level: stops.dropLevel }}
            cellSize={34}
          />
        </div>
      </div>
    );
  },
};

/** Accélérer, rouler, freiner : une machine de plusieurs centaines de kilos ne part ni ne s'arrête
 *  d'un coup. */
const easeInOut = (u: number) => u * u * (3 - 2 * u);

/**
 * Un **circuit** : la machine fait le tour de la voie, prend dans l'étagère, et dépose sur le tapis
 * trois virages plus loin.
 *
 * La voie est faite de droits et d'angles chaînés par `railCircuit`, qui donne aussi, à toute
 * distance du départ, le point de l'axe et le cap. La machine y est posée par ces deux nombres —
 * `origin` et `rotation` — et redessinée à chaque image. Sur un droit on pourrait se contenter d'une
 * translation ; dans un virage elle **tourne**, et une rotation d'un volume n'est pas une
 * transformation d'écran sous cette caméra. On la redessine donc partout, le même code servant pour
 * les deux.
 *
 * Aux postes, elle s'arrête et joue la moitié de son cycle : la prise d'un côté, la dépose de
 * l'autre. C'est `phase` qu'on fait avancer, `running` restant éteint — la pose est calculée, pas
 * animée, donc un arrêt sur image et une image du film sont la même chose. Les deux postes sont
 * **au même niveau et à la même portée**, ce qui fait tomber la fin de la prise exactement à la
 * moitié du cycle : la machine repart de là, charge à bord, fourches rentrées.
 *
 * L'étagère et le tapis sont à l'extérieur de la boucle, du côté du fond, et la machine sert à
 * gauche : les fourches ne passent donc jamais derrière la voie qu'elle vient de quitter.
 */
export const Circuit: Story = {
  name: "Un circuit de rail",
  render: function Render() {
    const cellSize = 26;
    const W = 2.2;
    const L1 = 8;
    const L2 = 4;
    const reach = 2.2;
    const level = 1.7;
    const chassis = 1.8;

    const circuit = useMemo(() => {
      const pieces: CircuitPiece[] = [
        { kind: "straight", length: L1 },
        { kind: "corner" },
        { kind: "straight", length: L2 },
        { kind: "corner" },
        { kind: "straight", length: L1 },
        { kind: "corner" },
        { kind: "straight", length: L2 },
        { kind: "corner" },
      ];
      return railCircuit(pieces, W);
    }, []);

    // ---- les postes ----
    // La prise : au milieu du premier droit, l'étagère de l'autre côté de sa file gauche.
    const sPick = L1 / 2;
    const pickAt = circuit.at(sPick);
    const rackDepth = 1.6;
    const rack = { x: pickAt.x - 2, y: pickAt.y - reach - rackDepth * 0.45, width: 4, depth: rackDepth, level: 1.5, deck: 0.2 };
    // La dépose : au milieu du dernier droit, qui remonte vers le fond ; le tapis est à sa gauche.
    const last = circuit.modules[6];
    const sDrop = last.start + last.run / 2;
    const dropAt = circuit.at(sDrop);
    const belt = { length: 3.4, width: 1.4, bed: 0.22 };
    const beltCenter = { x: dropAt.x - reach, y: dropAt.y };
    const beltOrigin = { x: beltCenter.x - belt.length / 2, y: beltCenter.y - belt.width / 2 };

    // ---- le temps ----
    const station = 3.4;
    const cruise = 1.5;
    const ahead = sDrop - sPick;
    const back = circuit.length - ahead;
    const legs = [station, (ahead / cruise) * 1.3, station, (back / cruise) * 1.3];
    const total = legs.reduce((a, b) => a + b, 0);

    const [clock, setClock] = useState(0);
    useEffect(() => {
      // Qui refuse le mouvement voit la machine à la prise, et rien ne tourne.
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      let frame = 0;
      const t0 = performance.now();
      const tick = (now: number) => {
        setClock((now - t0) / 1000);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, []);

    let t = clock % total;
    let s = sPick;
    let phase = 0;
    if (t < legs[0]) {
      phase = (t / legs[0]) * 0.5;
    } else if ((t -= legs[0]) < legs[1]) {
      s = sPick + ahead * easeInOut(t / legs[1]);
      phase = 0.5;
    } else if ((t -= legs[1]) < legs[2]) {
      s = sDrop;
      phase = 0.5 + (t / legs[2]) * 0.5;
    } else {
      t -= legs[2];
      s = sDrop + back * easeInOut(t / legs[3]);
      phase = 0;
    }
    const pose = circuit.at(s);

    const frame = {
      x: Math.min(circuit.bounds.x, beltOrigin.x) - 1,
      y: Math.min(circuit.bounds.y, rack.y) - 1,
      width: circuit.bounds.width + 3.5,
      depth: circuit.bounds.depth + 3,
      height: 4,
    };
    const box = frameBox(frame, cellSize);
    const shared = { cellSize, frame, shadows: true };
    const rails = [...circuit.modules].sort((a, b) => a.depth - b.depth);
    const stop = { at: chassis / 2, side: "left" as const, level, reach };

    const reachId = `reach${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const rackProps = {
      ...shared,
      origin: { x: rack.x, y: rack.y },
      width: rack.width,
      depth: rack.depth,
      height: rack.level,
      countZ: 2,
      slotsX: 3,
      contents: ["boite", "carton", null] as ("carton" | "boite" | null)[],
      posts: true,
      braces: true,
      feet: true,
      deckThickness: rack.deck,
    };

    const layer = (part: "shadow" | "machine") => (
      <>
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <RackV2 {...rackProps} parts={part} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Conveyor
            {...shared}
            origin={beltOrigin}
            rotation={90}
            kind="straight"
            length={belt.length}
            width={belt.width}
            legHeight={level - 0.2 - belt.bed}
            bedThickness={belt.bed}
            speed={0.8}
            parts={part}
          />
        </div>
        {rails.map((m, i) => (
          <div key={i} style={{ position: "absolute", left: 0, top: 0 }}>
            <Rail {...shared} kind={m.kind} length={m.length} width={W} rotation={m.rotation} origin={m.origin} parts={part} />
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Picker
            {...shared}
            travel={chassis}
            chassisLength={chassis}
            width={W}
            mastHeight={2.4}
            rotation={pose.heading}
            origin={{ x: pose.x - chassis / 2, y: pose.y - W / 2 }}
            pick={stop}
            drop={stop}
            load="carton"
            running={false}
            phase={phase}
            parts={part}
            reachMask={part === "machine" ? reachId : undefined}
          />
        </div>
      </>
    );

    return (
      <div style={{ padding: 24 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {layer("shadow")}
          {layer("machine")}
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <RackV2 {...rackProps} shadows={false} parts="machine" cover={level} mask={reachId} />
          </div>
        </div>
      </div>
    );
  },
};
