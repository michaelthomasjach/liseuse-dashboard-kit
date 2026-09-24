import { useEffect, useMemo } from "react";
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, SRGBColorSpace } from "three";
import { Builder } from "./three/builder";
import { Parts, useBuilt } from "./three/scene";
import { usePalette } from "./three/palette";

/**
 * Un panneau « À VENDRE » planté dans une friche : deux poteaux, une planche inclinée.
 *
 * La planche est **penchée vers le ciel**, comme un pupitre : dressée à la verticale, on ne la verrait
 * que par la tranche depuis la vue de dessus, qui est celle où l'on construit. Son texte est peint
 * sur une texture — le constructeur de volumes ne sait pas écrire — aux couleurs de la palette de la
 * scène, encre sur papier. Les coordonnées de texture sont posées **dans le repère du plan** (les
 * `x` vers la droite, les `y` vers le haut de l'écran en vue de dessus) : c'est ce qui la rend
 * lisible sous la symétrie qui retourne toute la scène (voir `MIRROR`), sans avoir à la retourner.
 */
export function ForSaleSign({ x, y, label }: { x: number; y: number; label?: string }) {
  const pal = usePalette();
  const W = 1.8;
  const H = 0.9;
  const tilt = (55 * Math.PI) / 180;
  const z0 = 0.72;
  const yb = 0.18;
  const yt = yb - H * Math.cos(tilt);
  const zt = z0 + H * Math.sin(tilt);

  const posts = useBuilt(() => {
    const b = new Builder();
    for (const px of [-W / 2 + 0.2, W / 2 - 0.2]) b.box("wood", px - 0.05, px + 0.05, -0.12, -0.02, 0, (z0 + zt) / 2 + 0.05);
    // La tranche de la planche, derrière le texte : c'est elle qui lui donne une épaisseur.
    b.hexa("wood", [
      [-W / 2, yb + 0.02, z0 - 0.02],
      [W / 2, yb + 0.02, z0 - 0.02],
      [W / 2, yt + 0.02, zt - 0.02],
      [-W / 2, yt + 0.02, zt - 0.02],
      [-W / 2, yb, z0],
      [W / 2, yb, z0],
      [W / 2, yt, zt],
      [-W / 2, yt, zt],
    ]);
    return b.build();
  }, []);

  const face = useMemo(() => {
    const g = new BufferGeometry();
    const e = 0.004;
    // Un rectangle, un rien devant la planche : bas-gauche, bas-droite, haut-droite, haut-gauche.
    const p = [
      [-W / 2 + 0.04, yb - 0.03, z0 + 0.03 + e],
      [W / 2 - 0.04, yb - 0.03, z0 + 0.03 + e],
      [W / 2 - 0.04, yt + 0.03, zt - 0.01 + e],
      [-W / 2 + 0.04, yt + 0.03, zt - 0.01 + e],
    ];
    const uv = [0, 0, 1, 0, 1, 1, 0, 1];
    const idx = [0, 1, 2, 0, 2, 3];
    g.setAttribute("position", new Float32BufferAttribute(idx.flatMap((i) => p[i]), 3));
    g.setAttribute("uv", new Float32BufferAttribute(idx.flatMap((i) => [uv[i * 2], uv[i * 2 + 1]]), 2));
    g.computeVertexNormals();
    return g;
  }, [yb, yt, z0, zt]);

  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const ink = `#${pal.ink.getHexString()}`;
    const paper = `#${pal.paper.getHexString()}`;
    if (ctx) {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 10, 492, 236);
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 92px system-ui, sans-serif";
      ctx.fillText("À VENDRE", 256, label ? 100 : 128);
      if (label) {
        ctx.font = "600 46px system-ui, sans-serif";
        ctx.fillText(label.length > 22 ? `${label.slice(0, 21)}…` : label, 256, 188, 470);
      }
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false });
  }, [label, pal]);

  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material]
  );
  useEffect(() => () => face.dispose(), [face]);

  return (
    <group position={[x, y, 0]}>
      <Parts built={posts} />
      <mesh geometry={face} material={material} />
    </group>
  );
}
