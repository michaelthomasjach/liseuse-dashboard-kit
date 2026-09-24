import { useEffect, useRef, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { IsoCamera } from "../isoCamera";
import { WarehouseScene, projectedBox, type Bounds } from "./scene";

/**
 * Une vignette 3D : une scène rendue **une fois**, photographiée, et remplacée par son image.
 *
 *  Une palette d'outils illustrée de vraies scènes 3D en ouvrirait une par outil — et un
 *  navigateur n'accorde qu'une quinzaine de contextes WebGL par page, que l'éditeur lui-même
 *  utilise déjà. Les vignettes passent donc **une par une** : chaque scène est montée hors de
 *  l'écran, rendue, lue en image, puis démontée avant la suivante. Il n'en reste que des `<img>`,
 *  qui ne coûtent rien, et qu'on garde en mémoire d'un montage à l'autre (même `id`, même image).
 */

const cache = new Map<string, string>();
let queue: Promise<void> = Promise.resolve();

/** Lire l'image de la toile une fois la scène posée : deux images d'attente, un rendu, une lecture. */
function Capture({ onDone }: { onDone: (url: string) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // Le rappel change à chaque rendu du parent : on garde le dernier, sans relancer l'attente.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    // Un temps pour que la caméra, la palette et les ombres soient posées, puis un rendu et une
    // lecture dans la même tâche — la toile n'a pas à garder son image.
    const t = window.setTimeout(() => {
      gl.shadowMap.needsUpdate = true;
      gl.render(scene, camera);
      done.current(gl.domElement.toDataURL("image/png"));
    }, 180);
    return () => window.clearTimeout(t);
  }, [gl, scene, camera]);
  return null;
}

export interface SnapshotProps {
  /** Ce qui identifie l'image en mémoire : deux vignettes du même `id` sont la même image. */
  id: string;
  /** Le pavé à cadrer, en cases. */
  bounds: Bounds;
  /** La taille de la vignette, en pixels. */
  width: number;
  height: number;
  /** Le cap et le site de la prise de vue. */
  yaw?: number;
  tilt?: number;
  alt?: string;
  className?: string;
  /** La scène : des modules du kit, comme dans n'importe quelle scène. */
  children: ReactNode;
}

export function Snapshot({ id, bounds, width, height, yaw = 30, tilt = 30, alt = "", className, children }: SnapshotProps) {
  const [url, setUrl] = useState(() => cache.get(id) ?? null);
  const [turn, setTurn] = useState(false);

  useEffect(() => {
    if (url !== null) return;
    let release: () => void = () => undefined;
    let cancelled = false;
    // Attendre son tour : la chaîne ne tient qu'une scène à la fois.
    const mine = queue.then(
      () =>
        new Promise<void>((resolve) => {
          if (cancelled || cache.has(id)) {
            if (cache.has(id)) setUrl(cache.get(id) as string);
            resolve();
            return;
          }
          release = resolve;
          setTurn(true);
          // Un filet : une scène qui ne rend jamais ne bloque pas les suivantes.
          window.setTimeout(resolve, 4000);
        })
    );
    queue = mine;
    return () => {
      cancelled = true;
      release();
    };
  }, [id, url]);

  if (url !== null) return <img src={url} width={width} height={height} alt={alt} className={className} draggable={false} style={{ objectFit: "contain" }} />;

  // La prise de vue : le pavé projeté, ajusté à la vignette.
  const box = projectedBox(bounds, yaw, tilt, 1);
  const pad = 4;
  const cellSize = Math.min((width - pad * 2) / Math.max(0.01, box.width), (height - pad * 2) / Math.max(0.01, box.height)) * 2;
  const done = (data: string) => {
    cache.set(id, data);
    setTurn(false);
    setUrl(data);
  };
  return (
    <span className={className} style={{ display: "inline-block", width, height }} aria-label={alt}>
      {/* Hors de l'écran mais dans la page : la scène y lit les couleurs du thème courant. */}
      {turn && (
        <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }} aria-hidden>
          <IsoCamera yaw={yaw} tilt={tilt} zoom={1}>
            <WarehouseScene bounds={bounds} cellSize={cellSize} padding={pad * 2} lazy={false} catcher>
              {children}
              <Capture onDone={done} />
            </WarehouseScene>
          </IsoCamera>
        </div>
      )}
    </span>
  );
}

export interface SnapshotJob {
  id: string;
  bounds: Bounds;
  node: ReactNode;
}

/**
 * Un studio : **une seule** toile hors écran qui photographie une liste de scènes à la suite.
 *
 *  Chaque toile neuve recompile ses shaders ; une palette de quinze vignettes en quinze toiles
 *  prend des secondes. Ici, la toile reste, les matières restent compilées, et seule la scène change
 *  d'une prise à l'autre — la caméra recadrée sur chaque pavé. Quand la liste est vide, la toile
 *  est démontée et son contexte rendu.
 */
export function SnapshotStudio({ jobs, width, height, yaw = 30, tilt = 30, onShot }: { jobs: SnapshotJob[]; width: number; height: number; yaw?: number; tilt?: number; onShot: (id: string, url: string) => void }) {
  const job = jobs.find((j) => !cache.has(j.id));
  if (!job) return null;
  const b = job.bounds;
  const box = projectedBox(b, yaw, tilt, 1);
  const zoom = Math.min((width - 8) / Math.max(0.01, box.width), (height - 8) / Math.max(0.01, box.height));
  const done = (url: string) => {
    cache.set(job.id, url);
    onShot(job.id, url);
  };
  return (
    <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }} aria-hidden>
      <IsoCamera yaw={yaw} tilt={tilt} zoom={1}>
        <WarehouseScene
          bounds={b}
          cellSize={1}
          viewport={{ width, height, center: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, zoom }}
          lazy={false}
          catcher
        >
          <group key={job.id}>{job.node}</group>
          <Capture key={`capture-${job.id}`} onDone={done} />
        </WarehouseScene>
      </IsoCamera>
    </div>
  );
}

/** L'image déjà prise pour cet identifiant, s'il y en a une. */
export function cachedSnapshot(id: string): string | null {
  return cache.get(id) ?? null;
}
