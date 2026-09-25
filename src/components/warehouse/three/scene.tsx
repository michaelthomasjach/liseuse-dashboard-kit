import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Matrix4, NoToneMapping, PCFShadowMap, PCFSoftShadowMap, Vector3, type BufferGeometry, type DirectionalLight, type OrthographicCamera, type PerspectiveCamera } from "three";
import { projectIso } from "../warehouseIso";
import { IsoCamera, useIsoCamera, useIsoProjection, useIsoZoom } from "../isoCamera";
import { PERSPECTIVE_FOV, cameraBasis, heading, perspectiveDistance, type Projection } from "./camera";
import { PaletteContext, createPalette, usePalette, type Palette } from "./palette";
import { SimClockProvider } from "./time";
import { TrafficContext, TrafficRegistry } from "./traffic";
import { createFpsSource } from "../../widgets/FpsMeter";
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

/**
 * La caméra et la lumière.
 *
 *  La caméra est posée sur la sphère autour du centre de la scène, au cap et au site demandés — en
 *  isométrique, ou en perspective à la distance qui garde la même échelle au centre (voir
 *  `camera.ts`). Le soleil **suit la caméra**, comme dans le dessin : c'est un choix de lisibilité
 *  et non de réalisme. L'ombre tombe toujours du même côté à l'écran — vers la droite et l'arrière —
 *  si bien qu'une scène qu'on fait tourner garde la même lecture.
 */
function Rig({ yaw, tilt, scale, target, span, height, projection, quality }: { yaw: number; tilt: number; scale: number; target: Vector3; span: number; height: number; projection: Projection; quality: ResolvedQuality }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const light = useRef<DirectionalLight>(null);

  useLayoutEffect(() => {
    const { dir, up } = cameraBasis(yaw, tilt);
    camera.up.copy(up);
    if (projection === "perspective" && (camera as PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as PerspectiveCamera;
      const dist = perspectiveDistance(height, scale);
      cam.fov = PERSPECTIVE_FOV;
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.near = Math.max(0.05, dist * 0.02);
      cam.far = dist * 4 + span * 3 + 60;
      cam.zoom = 1;
      cam.lookAt(target);
      cam.updateProjectionMatrix();
    } else {
      const cam = camera as OrthographicCamera;
      const far = span * 4 + 60;
      cam.position.copy(target).addScaledVector(dir, far / 2);
      cam.near = 0.01;
      cam.far = far;
      cam.zoom = scale;
      cam.lookAt(target);
      cam.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, yaw, tilt, scale, target, span, height, projection, invalidate]);

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
    // En qualité basse, la carte d'ombre n'est pas refaite à chaque image (voir `ShadowCadence`) :
    // un soleil qui a tourné la redemande.
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [yaw, target, span, invalidate, gl, quality]);

  return (
    <>
      {/* Une lumière d'ambiance franche : les faces à l'ombre restent lisibles, comme les faces
          latérales du dessin, qui n'étaient qu'un ton plus sombres. */}
      <hemisphereLight args={["#ffffff", "#e8e4dc", 1.25]} />
      <directionalLight
        // Une carte d'ombre ne change pas de taille en place : changer de qualité, c'est une autre lumière.
        key={quality}
        ref={light}
        intensity={2.35}
        castShadow
        shadow-mapSize-width={SHADOW_MAP[quality]}
        shadow-mapSize-height={SHADOW_MAP[quality]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.14}
      />
    </>
  );
}

/** La qualité de rendu d'une scène : `"auto"` la choisit selon l'appareil. */
export type SceneQuality = "auto" | "high" | "low";
type ResolvedQuality = "high" | "low";

/**
 * La qualité qu'un appareil peut tenir.
 *
 * ## Ce que coûte une scène sur un téléphone
 *
 *  Mesurée sur une partie de 130 éléments (la story « Warehouse/Performance »), une image se paie
 *  surtout en **objets à dessiner** — chacun deux fois, pour l'image et pour la carte d'ombre —, en
 *  **triangles** — les marchandises des racks en font les quatre cinquièmes — et en **pixels** : un
 *  téléphone a trois pixels physiques par pixel CSS, neuf fois plus de surface à remplir qu'un écran
 *  de bureau pour la même toile. `"low"` rogne là où l'œil ne perd presque rien à la taille d'un
 *  téléphone : une densité de pixels bornée à 1,5, une carte d'ombre plus petite et refaite une image
 *  sur trois, des marchandises moins détaillées, un décor plus clair autour du terrain, des arbres
 *  sans vent. `"high"` est l'image de toujours.
 *
 *  `"auto"` choisit `"low"` sur un **petit écran tactile** — pointeur grossier et 900 px ou moins
 *  sur le petit côté : un téléphone, une petite tablette — ou sur un processeur de **quatre cœurs
 *  ou moins**, et `"high"` ailleurs.
 */
export function resolveSceneQuality(q: SceneQuality = "auto"): ResolvedQuality {
  if (q !== "auto") return q;
  if (typeof window === "undefined") return "high";
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) <= 900;
  const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 8;
  return (coarse && small) || cores <= 4 ? "low" : "high";
}

const SceneQualityContext = createContext<ResolvedQuality>("high");
/**
 * La qualité de la scène où l'on est — `"high"` hors d'une scène. Un module s'en sert pour alléger
 * ce qui ne se verrait pas à la taille d'un téléphone ; en `"high"`, il ne change rien.
 */
export const useSceneQuality = () => useContext(SceneQualityContext);

/** La densité de pixels la plus forte qu'on rend, par qualité. */
const DPR_CAP: Record<ResolvedQuality, number> = { high: 2, low: 1.5 };
/** Le côté de la carte d'ombre, par qualité. */
const SHADOW_MAP: Record<ResolvedQuality, number> = { high: 2048, low: 1024 };
/** Le temps sans mouvement de la vue après lequel la pleine densité revient, en millisecondes. */
const SETTLE_MS = 300;

/**
 * La carte d'ombre, **une image sur `every`** tant que la scène s'anime.
 *
 *  Refaire la carte d'ombre, c'est redessiner toute la scène une seconde fois, du point de vue du
 *  soleil : près de la moitié des appels de dessin d'une image. En qualité basse, on ne la refait
 *  qu'une image sur trois pendant une animation continue — l'ombre d'un camion qui roule suit avec
 *  une ou deux images de retard, invisibles à son allure — et **toujours** pour une image isolée, qui
 *  suit un changement de la scène (un élément posé, déplacé) : là, une ombre n'est jamais en retard.
 */
function ShadowCadence({ every }: { every: number }) {
  const gl = useThree((s) => s.gl);
  const last = useRef(0);
  const count = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = every <= 1;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, every]);
  useFrame(() => {
    if (every <= 1) return;
    const now = performance.now();
    const gap = now - last.current;
    last.current = now;
    count.current += 1;
    if (gap > 120 || count.current % every === 0) gl.shadowMap.needsUpdate = true;
  }, -200);
  return null;
}

export interface WarehouseSceneProps {
  /** Ce que la scène doit cadrer, en cases. */
  bounds: Bounds;
  /** La qualité de rendu (densité de pixels, ombres). Défaut : `"auto"`. */
  quality?: SceneQuality;
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
export function WarehouseScene({ bounds, quality: qualityProp = "auto", cellSize = 30, padding = 10, speed = 1, paused = false, catcher = false, viewport, lazy = true, className, style, ariaLabel, children }: WarehouseSceneProps) {
  const cam = useIsoCamera();
  const zoom = useIsoZoom();
  const projection = useIsoProjection();
  const scale = cellSize * zoom * (viewport?.zoom ?? 1);
  const box = projectedBox(bounds, cam.yaw, cam.tilt, scale);
  // En perspective, ce qui est près grossit : la toile garde une marge pour ne pas le couper.
  const grow = projection === "perspective" ? 1.35 : 1;
  const width = viewport ? viewport.width : Math.ceil(box.width * grow + padding * 2);
  const height = viewport ? viewport.height : Math.ceil(box.height * grow + padding * 2);
  const host = useRef<HTMLDivElement>(null);
  // La circulation de la scène : tous les engins qui y roulent s'y croisent (voir `traffic.ts`).
  const traffic = useMemo(() => new TrafficRegistry(), []);
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

  // La qualité, résolue pour l'appareil (et à nouveau si on la change).
  const quality = useMemo(() => resolveSceneQuality(qualityProp), [qualityProp]);
  // La densité de pixels : celle de l'écran, bornée — et **abaissée à 1 pendant que la vue bouge**.
  // Un glisser, un zoom, une rotation redessinent tout à chaque image : c'est là que la fluidité se
  // voit, pas la finesse du trait. La pleine densité revient quand la vue s'est posée.
  const moving = useViewMotion([cam.yaw, cam.tilt, scale, cx, cy, cz, projection].join(","));
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const dpr = Math.min(deviceDpr, moving ? 1 : DPR_CAP[quality]);

  return (
    <div ref={host} className={className} role="img" aria-label={ariaLabel} style={{ position: "relative", width, height, flex: "none", ...style }}>
      {palette !== null && visible && (
        <Canvas
          // Changer de projection, c'est changer de caméra : la toile est remontée avec l'autre.
          key={projection}
          orthographic={projection === "orthographic"}
          flat
          shadows={{ type: quality === "high" ? PCFSoftShadowMap : PCFShadowMap }}
          frameloop="demand"
          dpr={dpr}
          gl={{ antialias: true, alpha: true, toneMapping: NoToneMapping }}
          // Vérifier chaque shader compilé, c'est attendre la carte graphique à chaque matière neuve :
          // un aller-retour bloquant, pour des shaders qui sont tous ceux de three.
          onCreated={({ gl }) => {
            gl.debug.checkShaderErrors = false;
          }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Rig yaw={cam.yaw} tilt={cam.tilt} scale={scale} target={target} span={span} height={height} projection={projection} quality={quality} />
          <ShadowCadence every={quality === "low" ? 3 : 1} />
          <FrameTap />
          <SimClockProvider speed={speed} paused={paused}>
            <SceneQualityContext.Provider value={quality}>
            <InScene.Provider value={true}>
              <PaletteContext.Provider value={palette}>
                <IsoCamera yaw={cam.yaw} tilt={cam.tilt} zoom={zoom} projection={projection}>
                  <TrafficContext.Provider value={traffic}>
                    <group matrixAutoUpdate={false} matrix={MIRROR}>
                      {catcher && <ShadowCatcher bounds={bounds} />}
                      {children}
                    </group>
                  </TrafficContext.Provider>
                </IsoCamera>
              </PaletteContext.Provider>
            </InScene.Provider>
            </SceneQualityContext.Provider>
          </SimClockProvider>
        </Canvas>
      )}
    </div>
  );
}

/**
 * L'horloge des scènes d'entrepôt, pour un `FpsMeter` : la durée de chaque image **réellement
 * dessinée**. Une scène au repos ne dessine rien et n'annonce donc rien. Personne n'écoute : rien
 * n'est calculé.
 */
export const warehouseSceneFrames = createFpsSource();

function FrameTap() {
  useFrame((_, delta) => {
    // Le premier pas après un réveil mesure le sommeil, pas le rendu : on l'écarte.
    if (warehouseSceneFrames.listening && delta < 0.25) warehouseSceneFrames.emit(delta * 1000);
  });
  return null;
}

/**
 * La vue bouge-t-elle ? Vrai dès que `key` (la caméra, le cadre) change, et jusqu'à `SETTLE_MS`
 * après son dernier changement. Le premier cadrage ne compte pas : une scène qui s'ouvre est posée.
 */
function useViewMotion(key: string): boolean {
  const [moving, setMoving] = useState(false);
  const first = useRef(key);
  useEffect(() => {
    if (first.current === key) return;
    first.current = key;
    setMoving(true);
    const t = window.setTimeout(() => setMoving(false), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [key]);
  return moving;
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
  // Rien ici ne bouge par rapport à son parent : pas de matrice locale à recomposer à chaque image
  // (`matrixAutoUpdate`). Leur place dans le monde suit toujours celle du parent, que la scène
  // recalcule de haut en bas.
  return (
    <group matrixAutoUpdate={false}>
      {[...built.solids].map(([mat, g]) => (
        <mesh key={`s-${mat}`} geometry={g} material={pal.solid(mat)} castShadow={shadows} receiveShadow matrixAutoUpdate={false} />
      ))}
      {[...built.decals].map(([cls, g]) => (
        <mesh key={`d-${cls}`} geometry={g} material={pal.decal(cls)} receiveShadow matrixAutoUpdate={false} />
      ))}
      {built.edges && <lineSegments geometry={built.edges} material={pal.edge} matrixAutoUpdate={false} />}
      {[...built.strokes].map(([cls, g]) => (
        <lineSegments key={`l-${cls}`} geometry={g} material={pal.stroke(cls)} matrixAutoUpdate={false} />
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
