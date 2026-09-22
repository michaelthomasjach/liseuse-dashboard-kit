import type { Meta, StoryObj } from "@storybook/react";
import { useId } from "react";
import { Picker } from "./Picker";
import { Rail } from "./Rail";
import { RackV2 } from "./RackV2";
import { Conveyor } from "./Conveyor";
import { CatchBin } from "./CatchBin";
import { projectIso } from "./warehouseIso";

const meta: Meta = {
  title: "Warehouse/Allées",
};
export default meta;
type Story = StoryObj;

type Frame = { x: number; y: number; width: number; depth: number; height: number };

/** Le pavé du monde vers la place qu'il prend à l'écran — la même arithmétique que la `viewBox` des
 *  modules, les dessins étant en position absolue et le conteneur devant réserver la place. */
function frameBox(frame: Frame, cellSize: number) {
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

const at = { position: "absolute", left: 0, top: 0 } as const;

/**
 * Un magasin : des **rangées d'étagères**, un **rail et un picker dans chaque allée**, une **ligne
 * de tapis** perpendiculaire au bout des rangées, et un **bac** au bout de la ligne.
 *
 * ## Pourquoi un tapis d'amenée au bout de chaque allée
 *
 * Les fourches d'un picker sortent **sur le côté** — c'est ce qui lui fait desservir une alvéole —
 * et jamais vers l'avant. Il ne peut donc pas poser un colis sur une ligne qui lui barre la route.
 * Un vrai magasin automatique a pour ça un **poste de dépose** au bout de chaque allée : un court
 * tapis dans le prolongement de la rangée, sur lequel la machine pose le colis de côté, comme dans
 * une alvéole, et qui le verse sur la ligne. C'est ce que font les amenées ici : la rangée s'arrête,
 * l'amenée prend sa suite dans le même alignement, et le rail continue jusqu'au bout pour que la
 * machine arrive à sa hauteur.
 *
 * Les hauteurs s'enchaînent en descendant, et c'est ce qui fait tomber les colis dans le bon sens :
 * l'amenée est au-dessus de la ligne, qui est au-dessus des parois du bac.
 *
 * ## L'ordre de peinture
 *
 * Tout est posé en cases du monde, dans un seul cadre, et peint allée par allée du fond vers
 * l'avant : la rangée et son amenée, puis le rail, puis la machine, puis ce qui dans la rangée
 * **recouvre des fourches entrées dans une alvéole** — repeint par-dessus la machine, mais seulement
 * dans la silhouette de ses fourches (`cover` et `reachMask`). La rangée suivante, plus proche, vient
 * après et passe donc devant la machine de l'allée d'avant, ce qui est juste : elle est devant.
 *
 * La ligne est au-delà du bout de toutes les rangées, plus loin sur l'axe des `x` : elle est devant
 * tout ce qui la longe, donc peinte après. Le bac est au bout de la ligne, plus loin encore sur `y`.
 * Les ombres passent toutes avant, étant au sol.
 *
 * Chaque machine sert la rangée **du fond** de son allée, et la dépose se fait du même côté : une
 * fourche qui entre dans la rangée de devant passerait derrière ses montants arrière, et c'est un
 * autre cas de peinture que celui-ci.
 */
export const Magasin: Story = {
  name: "Un magasin : rangées, allées, ligne et bac",
  render: function Render() {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const cellSize = 30;

    // ---- les cotes, en cases ----
    const rows = 4;
    const rackLength = 7;
    const rackDepth = 1.4;
    const levelHeight = 1.5;
    const deck = 0.2;
    const aisle = 1.8; // la largeur d'un rail
    const spur = 2.2; // la longueur d'une amenée
    const lineWidth = 1.4;
    const bed = 0.22;

    // Les hauteurs, en descendant : l'amenée, la ligne, les parois du bac.
    const spurTop = 1.8;
    const lineTop = 1.3;
    const binWalls = 0.9;

    const pitch = rackDepth + aisle;
    const rowY = (i: number) => i * pitch;
    const railLength = rackLength + spur;
    const lineX = railLength;
    const lineLength = rows * rackDepth + (rows - 1) * aisle;

    // La ligne court vers +y, vers la caméra : un droit tourné d'un quart autour de son centre.
    const lineOrigin = { x: lineX + lineWidth / 2 - lineLength / 2, y: lineLength / 2 - lineWidth / 2 };
    const binSize = { width: 2.2, depth: 2 };
    const binRun = 1.3;
    const binOrigin = { x: lineX + lineWidth / 2 - binSize.width / 2, y: lineLength + binRun - binSize.depth / 2 };

    const frame: Frame = {
      x: -0.8,
      y: -0.8,
      width: lineX + lineWidth + 1.6,
      depth: binOrigin.y + binSize.depth + 1.2,
      height: 3.6,
    };
    const box = frameBox(frame, cellSize);
    const shared = { cellSize, frame, shadows: true };

    // ---- les allées ----
    const aisles = Array.from({ length: rows - 1 }, (_, i) => {
      const y0 = rowY(i);
      const axis = y0 + rackDepth + aisle / 2;
      return {
        i,
        rail: { x: 0, y: y0 + rackDepth },
        // Le plateau du haut de la rangée du fond, et le milieu de sa profondeur.
        pick: {
          at: 1.2 + ((i * 2.3) % (rackLength - 2)),
          side: "left" as const,
          level: levelHeight + deck,
          reach: axis - (y0 + rackDepth * 0.45),
        },
        // L'amenée, dans le prolongement de la rangée du fond : on la sert du même côté.
        drop: { at: rackLength + spur / 2, side: "left" as const, level: spurTop + 0.2, reach: axis - (y0 + rackDepth / 2) },
        mask: `aisle${uid}${i}`,
      };
    });

    const rackProps = (i: number) => ({
      ...shared,
      origin: { x: 0, y: rowY(i) },
      width: rackLength,
      depth: rackDepth,
      height: levelHeight,
      countZ: 2,
      slotsX: 4,
      contents: (["carton", "boite", null, "carton", "bidon", "carton", "boite", null] as const).slice(i % 3, (i % 3) + 4) as (
        | "carton"
        | "boite"
        | "bidon"
        | null
      )[],
      posts: true,
      braces: true,
      feet: true,
      deckThickness: deck,
    });

    const spurOf = (i: number, part: "shadow" | "machine" | "load") => (
      <div key={`spur${i}${part}`} style={at}>
        <Conveyor
          {...shared}
          kind="straight"
          origin={{ x: rackLength, y: rowY(i) }}
          length={spur}
          width={rackDepth}
          legHeight={spurTop - bed}
          bedThickness={bed}
          load="carton"
          loadCount={1}
          speed={0.9}
          phase={i * 0.37}
          // Le colis quitte l'amenée par son bout et tombe sur la ligne, au milieu de sa largeur.
          drop={{ fall: spurTop - lineTop, run: lineWidth / 2 }}
          parts={part}
        />
      </div>
    );

    const layer = (part: "shadow" | "machine") => (
      <>
        {Array.from({ length: rows }, (_, i) => {
          const served = aisles[i];
          return (
            <div key={`row${i}${part}`}>
              <div style={at}>
                <RackV2 {...rackProps(i)} parts={part} />
              </div>
              {i < rows - 1 && spurOf(i, part)}
              {i < rows - 1 && part === "machine" && spurOf(i, "load")}
              {served && (
                <>
                  <div style={at}>
                    <Rail {...shared} kind="straight" origin={served.rail} length={railLength} width={aisle} parts={part} />
                  </div>
                  <div style={at}>
                    <Picker
                      {...shared}
                      origin={served.rail}
                      travel={railLength}
                      width={aisle}
                      mastHeight={2.5}
                      speed={1.8}
                      dwell={0.4}
                      phase={served.i * 0.29}
                      pick={served.pick}
                      drop={served.drop}
                      load="carton"
                      parts={part}
                      reachMask={part === "machine" ? served.mask : undefined}
                    />
                  </div>
                  {part === "machine" && (
                    <div style={at}>
                      <RackV2 {...rackProps(i)} shadows={false} parts="machine" cover={served.pick.level} mask={served.mask} />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {(part === "machine" ? (["machine", "load"] as const) : (["shadow"] as const)).map((p) => (
          <div key={`line${p}`} style={at}>
            <Conveyor
              {...shared}
              kind="straight"
              origin={lineOrigin}
              rotation={90}
              length={lineLength}
              width={lineWidth}
              legHeight={lineTop - bed}
              bedThickness={bed}
              load="carton"
              loadCount={3}
              speed={1.1}
              drop={{ fall: lineTop - binWalls * 0.55, run: binRun }}
              parts={p}
            />
          </div>
        ))}
        <div style={at}>
          <CatchBin
            {...shared}
            origin={binOrigin}
            width={binSize.width}
            depth={binSize.depth}
            height={binWalls}
            count={8}
            itemSize={0.6}
            parts={part}
          />
        </div>
      </>
    );

    return (
      <div style={{ padding: 24 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {layer("shadow")}
          {layer("machine")}
        </div>
      </div>
    );
  },
};
