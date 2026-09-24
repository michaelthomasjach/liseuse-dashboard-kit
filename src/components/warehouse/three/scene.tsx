import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Matrix4, NoToneMapping, PCFSoftShadowMap, Vector3, type BufferGeometry, type DirectionalLight, type OrthographicCamera } from "three";
import { projectIso } from "../warehouseIso";
import { IsoCamera, useIsoCamera, useIsoZoom } from "../isoCamera";
import { PaletteContext, createPalette, usePalette, type Palette } from "./palette";
import { SimClockProvider } from "./time";
import type { Built } from "./builder";
// Toutes les matières du kit, pour qu'un module posé seul — un bâtiment, un conteneur — trouve
// celles qu'il emprunte aux autres (le verre du camion, le béton du mur, l'acier des racks).
import "../rackItems.css";
import "../Floor.css";
import "../Wall.css";
import "../SemiTruck.css";
import "../Amr.css";
import "../Parking.css";
import "./warehouse3d.css";

/**
 * La scène 3D de l'entrepôt.
 *
 * ## Une vraie scène, la même image
 *
 * Tout ce que le dessin isométrique faisait à la main, la carte graphique le fait ici : chaque
 * module est un groupe de volumes en coordonnées monde, et c'est **le tampon de profondeur** qui
 * décide de ce qui passe devant quoi. Il n'y a plus d'ordre de peinture — plus de rangement en
 * longueur, en travers, par face visible — parce qu'il n'y a plus rien à ranger : un pixel est
 * celui de la surface la plus proche. Une bonne part des défauts corrigés dans les modules
 * isométriques étaient des erreurs de cet ordre ; ils disparaissent avec lui. Et les ombres ne sont
 * plus des polygones calculés à part : c'est la lumière qui les porte, sur tout ce qu'elle touche.
 *
 * La caméra, elle, reste celle du dessin : **orthographique**, au cap et au site de l'`IsoCamera`
 * qui l'entoure. À 30° de site on retrouve exactement la projection 2:1 de `projectIso` — une case
 * le long du sol fait deux fois sa hauteur à l'écran — si bien qu'une case fait toujours
 * `cellSize` pixels et que les cadrages de toutes les scènes restent valables.
 *
 * ## Le repère
 *
 * Les modules parlent en **cases** (une case vaut deux mètres), `x` et `y` au sol, `z` vers le
 * haut : aucune cote n'a à être convertie d'un dessin à l'autre.
 */

/** Le pavé qu'un module ou une scène occupe, en cases. */
export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * La symétrie qui garde le dessin **dans le sens où on l'a toujours vu**.
 *
 *  La projection isométrique d'origine n'est pas l'image d'une vraie caméra : c'est son reflet.
 *  Elle envoie les `x` croissants en bas à droite et les `y` croissants en bas à gauche, alors
 *  qu'une caméra posée du côté des `x` et `y` croissants les verrait à l'inverse — le repère d'un
 *  SVG a son `y` vers le bas, et un dessin fait dedans est un monde gaucher. Sans correction, toutes
 *  les scènes seraient retournées : les camions regarderaient de l'autre côté, le quai changerait
 *  de façade, alors qu'elles ont toutes été composées à l'œil. On échange donc `x` et `y` à la
 *  racine. C'est une réflexion — la seule transformation qui rende la même image — et le moteur la
 *  gère de lui-même en retournant le sens des faces de ce qu'elle porte.
 */
const MIRROR = new Matrix4().set(0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

const InScene = createContext(false);
/** Le module est-il déjà dans une scène ? S'il ne l'est pas, il ouvre la sienne. */
export const useInScene = () => useContext(InScene);

/** Les huit coins d'un pavé projetés comme le fait le dessin : la taille de la toile, et donc la
 *  même mise en page qu'avant, qui change de taille avec le cap exactement comme avant. */
export function projectedBox(b: Bounds, yaw: number, tilt: number, scale: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const x of [b.x0, b.x1])
    for (const y of [b.y0, b.y1])
      for (const z of [b.z0, b.z1]) {
        const p = projectIso(x, y, z, yaw, tilt);
        xs.push(p.x * scale);
        ys.push(p.y * scale);
      }
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Une direction horizontale au cap `deg`, depuis la diagonale des `x` et `y` croissants — vue à
 *  travers `MIRROR`, qui renverse le sens de toute rotation, d'où `+deg`. */
function heading(deg: number) {
  const t = (deg * Math.PI) / 180;
  const hx = Math.cos(t) - Math.sin(t);
  const hy = Math.sin(t) + Math.cos(t);
  const n = Math.hypot(hx, hy);
  return { hx: hx / n, hy: hy / n };
}

/**
 * La caméra et la lumière.
 *
 *  La caméra est posée sur la sphère autour du centre de la scène, au cap et au site demandés. Le
 *  soleil **suit la caméra**, comme dans le dessin : c'est un choix de lisibilité et non de
 *  réalisme. L'ombre tombe toujours du même côté à l'écran — vers la droite et l'arrière — si bien
 *  qu'une scène qu'on fait tourner garde la même lecture ; un soleil fixe ferait passer les ombres
 *  devant les objets à certains caps, et on perdrait ce qu'elles apportent : le contact avec le sol.
 */
function Rig({ yaw, tilt, scale, target, span }: { yaw: number; tilt: number; scale: number; target: Vector3; span: number }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const light = useRef<DirectionalLight>(null);

  useLayoutEffect(() => {
    const { hx, hy } = heading(yaw);
    const el = (Math.max(0.5, Math.min(89.9, tilt)) * Math.PI) / 180;
    const dir = new Vector3(hx * Math.cos(el), hy * Math.cos(el), Math.sin(el));
    const far = span * 4 + 60;
    // À la verticale, « le haut » ne peut plus être le ciel : c'est alors le fond de la scène.
    if (tilt > 89) camera.up.set(-hx, -hy, 0);
    else camera.up.set(0, 0, 1);
    camera.position.copy(target).addScaledVector(dir, far / 2);
    camera.near = 0.01;
    camera.far = far;
    camera.zoom = scale;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, yaw, tilt, scale, target, span, invalidate]);

  useLayoutEffect(() => {
    const l = light.current;
    if (l === null) return;
    // Le soleil vient de l'avant gauche de la caméra, haut dans le ciel.
    const { hx, hy } = heading(yaw - 62);
    const el = (55 * Math.PI) / 180;
    const sun = new Vector3(hx * Math.cos(el), hy * Math.cos(el), Math.sin(el));
    l.position.copy(target).addScaledVector(sun, span * 2 + 12);
    l.target.position.copy(target);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    const r = span * 0.62 + 2;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = span * 5 + 40;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
  }, [yaw, target, span, invalidate]);

  return (
    <>
      {/* Une lumière d'ambiance franche : les faces à l'ombre restent lisibles, comme les faces
          latérales du dessin, qui n'étaient qu'un ton plus sombres. */}
      <hemisphereLight args={["#ffffff", "#e8e4dc", 1.25]} />
      <directionalLight
        ref={light}
        intensity={2.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0015}
        shadow-normalBias={0.14}
      />
    </>
  );
}

export interface WarehouseSceneProps {
  /** Ce que la scène doit cadrer, en cases. */
  bounds: Bounds;
  /** Pixels par case, au grossissement 1. */
  cellSize?: number;
  /** Marge autour du cadre, en pixels. */
  padding?: number;
  /** Vitesse de la simulation : `2` fait tout aller deux fois plus vite. */
  speed?: number;
  /** Arrêter le temps. */
  paused?: boolean;
  /**
   * Poser un sol invisible qui ne reçoit que les ombres.
   *
   *  Un module seul n'a pas de dalle sous lui : sa lumière porte une ombre que rien ne reçoit, et il
   *  flotte sur la page. Ce sol-là ne se voit pas — il n'a ni couleur ni trait — il ne rend que
   *  l'ombre, posée sur le papier. Une scène qui a sa propre dalle n'en a pas besoin.
   */
  catcher?: boolean;
  /**
   * Une fenêtre de taille fixe sur la scène, au lieu d'une toile taillée sur ce qu'elle cadre :
   * sa taille en pixels, le point du sol au centre, en cases, et un grossissement. C'est ce que
   * pilote un éditeur qui fait défiler et zoomer la vue.
   */
  viewport?: { width: number; height: number; center: { x: number; y: number; z?: number }; zoom?: number };
  /** Ne monter la toile que quand elle est à l'écran (défaut). `false` : tout de suite, même hors
   *  de la vue — pour une scène qu'on photographie hors écran. */
  lazy?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * La scène : une toile WebGL dimensionnée sur ce qu'elle cadre.
 *
 *  Elle se dimensionne comme les dessins — le pavé cadré, projeté au cap courant — de sorte
 *  qu'une scène qui tourne change de taille comme avant, et qu'une page garde sa mise en page. Le
 *  rendu est **à la demande** : rien n'est redessiné tant que ni la caméra, ni la scène, ni une
 *  animation ne le demande.
 *
 *  La toile n'est **montée que quand elle est à l'écran**. Un navigateur n'accorde qu'une
 *  quinzaine de contextes WebGL par page, et une page de documentation empile toutes les scènes
 *  d'un fichier : au-delà, les plus anciennes perdraient leur contexte et s'effaceraient. Montées à
 *  la vue et démontées hors de vue, elles ne sont jamais plus nombreuses que ce qu'on regarde.
 *
 *  Le contexte React ne traverse pas la frontière de la toile : ce qui vient de l'extérieur — la
 *  caméra, la palette — est relu ici et redonné à l'intérieur.
 */
export function WarehouseScene({ bounds, cellSize = 30, padding = 10, speed = 1, paused = false, catcher = false, viewport, lazy = true, className, style, ariaLabel, children }: WarehouseSceneProps) {
  const cam = useIsoCamera();
  const zoom = useIsoZoom();
  const scale = cellSize * zoom * (viewport?.zoom ?? 1);
  const box = projectedBox(bounds, cam.yaw, cam.tilt, scale);
  const width = viewport ? viewport.width : Math.ceil(box.width + padding * 2);
  const height = viewport ? viewport.height : Math.ceil(box.height + padding * 2);
  const host = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (host.current === null) return;
    const p = createPalette(host.current);
    setPalette(p);
    return () => p.dispose();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    if (!lazy || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lazy]);

  // Le centre du cadre, passé par la symétrie comme tout le reste de la scène.
  const cx = viewport ? viewport.center.x : (bounds.x0 + bounds.x1) / 2;
  const cy = viewport ? viewport.center.y : (bounds.y0 + bounds.y1) / 2;
  const cz = viewport ? viewport.center.z ?? 0 : (bounds.z0 + bounds.z1) / 2;
  const target = useMemo(() => new Vector3(cy, cx, cz), [cx, cy, cz]);
  const span = Math.hypot(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0, bounds.z1 - bounds.z0);

  return (
    <div ref={host} className={className} role="img" aria-label={ariaLabel} style={{ position: "relative", width, height, flex: "none", ...style }}>
      {palette !== null && visible && (
        <Canvas
          orthographic
          flat
          shadows={{ type: PCFSoftShadowMap }}
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, toneMapping: NoToneMapping }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Rig yaw={cam.yaw} tilt={cam.tilt} scale={scale} target={target} span={span} />
          <SimClockProvider speed={speed} paused={paused}>
            <InScene.Provider value={true}>
              <PaletteContext.Provider value={palette}>
                <IsoCamera yaw={cam.yaw} tilt={cam.tilt} zoom={zoom}>
                  <group matrixAutoUpdate={false} matrix={MIRROR}>
                    {catcher && <ShadowCatcher bounds={bounds} />}
                    {children}
                  </group>
                </IsoCamera>
              </PaletteContext.Provider>
            </InScene.Provider>
          </SimClockProvider>
        </Canvas>
      )}
    </div>
  );
}

/** Le sol invisible d'un module seul : il ne rend que l'ombre qu'on y porte. */
function ShadowCatcher({ bounds }: { bounds: Bounds }) {
  const pal = usePalette();
  const w = bounds.x1 - bounds.x0;
  const d = bounds.y1 - bounds.y0;
  const m = Math.max(w, d) * 0.6 + 2;
  return (
    <mesh position={[(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, -0.002]} receiveShadow>
      <planeGeometry args={[w + m * 2, d + m * 2]} />
      <shadowMaterial color={pal.ink} opacity={0.16} transparent />
    </mesh>
  );
}

/**
 * Un module, **seul ou en scène**.
 *
 *  Posé seul, un module ouvre sa propre scène, cadrée sur lui ; posé dans une scène, il y ajoute
 *  simplement ses volumes. C'est ce qui garde l'API de tous les composants intacte : `<SemiTruck />`
 *  s'emploie comme avant, et se compose avec les autres sans rien changer à son écriture.
 */
export function Solo({
  bounds,
  cellSize,
  className,
  ariaLabel,
  children,
}: {
  bounds: Bounds;
  cellSize?: number;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  if (useInScene()) return <>{children}</>;
  return (
    <WarehouseScene bounds={bounds} cellSize={cellSize} className={className} ariaLabel={ariaLabel} catcher>
      {children}
    </WarehouseScene>
  );
}

/** Le cadre partagé d'une scène composée — `{ x, y, width, depth, height }` — traduit en pavé. */
export function frameBounds(frame: { x: number; y: number; width: number; depth: number; height: number }): Bounds {
  return { x0: frame.x, x1: frame.x + frame.width, y0: frame.y, y1: frame.y + frame.depth, z0: -0.1, z1: frame.height };
}

/** Construire une géométrie une fois par jeu de paramètres, et la libérer quand elle change. */
export function useBuilt(make: () => Built, deps: unknown[]): Built {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(make, deps);
  useEffect(
    () => () => {
      const all: (BufferGeometry | null)[] = [...built.solids.values(), ...built.decals.values(), ...built.strokes.values(), built.edges];
      for (const g of all) g?.dispose();
    },
    [built]
  );
  return built;
}

/** Ce qu'un constructeur a produit, à l'écran : un maillage par matière, un tracé par trait. */
export function Parts({ built, shadows = true }: { built: Built; shadows?: boolean }) {
  const pal = usePalette();
  return (
    <group>
      {[...built.solids].map(([mat, g]) => (
        <mesh key={`s-${mat}`} geometry={g} material={pal.solid(mat)} castShadow={shadows} receiveShadow />
      ))}
      {[...built.decals].map(([cls, g]) => (
        <mesh key={`d-${cls}`} geometry={g} material={pal.decal(cls)} receiveShadow />
      ))}
      {built.edges && <lineSegments geometry={built.edges} material={pal.edge} />}
      {[...built.strokes].map(([cls, g]) => (
        <lineSegments key={`l-${cls}`} geometry={g} material={pal.stroke(cls)} />
      ))}
    </group>
  );
}

/**
 * La pose d'un module et le pavé qu'il occupe une fois posé.
 *
 *  Tous les modules du kit tournent **autour du centre de leur emprise** puis se posent à `origin` :
 *  c'est la règle qu'ils suivaient déjà, reprise ici une fois pour toutes. Le pavé rendu est
 *  l'emprise tournée, ce qui sert à cadrer un module seul.
 */
export function placed(
  origin: { x: number; y: number },
  rotation: number,
  span: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number },
  pivot?: { x: number; y: number }
) {
  const pv = pivot ?? { x: (span.x0 + span.x1) / 2, y: (span.y0 + span.y1) / 2 };
  const t = (rotation * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const m = new Matrix4().makeTranslation(origin.x + pv.x, origin.y + pv.y, 0).multiply(new Matrix4().makeRotationZ(t)).multiply(new Matrix4().makeTranslation(-pv.x, -pv.y, 0));
  const pts = [
    [span.x0, span.y0],
    [span.x1, span.y0],
    [span.x1, span.y1],
    [span.x0, span.y1],
  ].map(([x, y]) => ({ x: origin.x + pv.x + (x - pv.x) * c - (y - pv.y) * s, y: origin.y + pv.y + (x - pv.x) * s + (y - pv.y) * c }));
  const bounds: Bounds = {
    x0: Math.min(...pts.map((p) => p.x)),
    x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    y1: Math.max(...pts.map((p) => p.y)),
    z0: span.z0,
    z1: span.z1,
  };
  return { pose: m, bounds };
}
