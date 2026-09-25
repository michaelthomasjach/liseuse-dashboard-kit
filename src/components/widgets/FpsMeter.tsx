import { useEffect, useState, type CSSProperties } from "react";
import "./FpsMeter.css";

/**
 * Un compteur d'images par seconde, posé en surimpression dans un coin : de quoi voir, en jouant,
 * si la simulation tient le rythme.
 *
 * ## Ce qu'il mesure
 *
 * Par défaut, la cadence de la **page** : une seule boucle `requestAnimationFrame` note l'écart
 * entre deux images. Avec `source`, celle d'une autre horloge — celle des scènes d'entrepôt
 * (`warehouseSceneFrames`), qui ne comptent que les images **réellement dessinées** : une scène au
 * repos ne redessine rien, et le compteur le dit (« au repos ») au lieu d'afficher 60 i/s qui ne
 * mesureraient que le navigateur.
 *
 * Toutes les `sampleMs` (500 ms par défaut), il résume la fenêtre écoulée : la cadence moyenne, la
 * plus basse (celle de l'image la plus lente) et la durée moyenne d'une image. Rien n'est rendu
 * par React entre deux résumés : la mesure elle-même ne coûte presque rien.
 *
 * ## La lecture
 *
 * Vert au-dessus de 50 i/s, ambre au-dessus de 30, rouge en dessous. Une petite courbe garde les
 * 60 derniers résumés (`showGraph`). La pastille ne capte aucun geste (`pointer-events: none`) :
 * on clique à travers. Son conteneur doit être positionné (`position: relative`), comme pour
 * n'importe quelle surimpression.
 */

/** Une horloge qu'on peut écouter : elle annonce la durée de chaque image, en millisecondes. */
export interface FpsSource {
  subscribe(listener: (frameMs: number) => void): () => void;
}

/** Une horloge à alimenter soi-même : `emit(ms)` à chaque image. */
export function createFpsSource(): FpsSource & { emit(frameMs: number): void; readonly listening: boolean } {
  const listeners = new Set<(ms: number) => void>();
  return {
    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    emit(ms) {
      for (const l of listeners) l(ms);
    },
    get listening() {
      return listeners.size > 0;
    },
  };
}

export interface FpsReading {
  /** La cadence moyenne sur la dernière fenêtre, en images par seconde (0 : aucune image). */
  fps: number;
  /** La plus basse : celle de l'image la plus lente de la fenêtre. */
  min: number;
  /** La durée moyenne d'une image, en millisecondes. */
  ms: number;
  /** Les derniers résumés, du plus ancien au plus récent. */
  history: number[];
  /** Aucune image dans la fenêtre : la source dort (une scène au repos). */
  idle: boolean;
}

export interface UseFpsOptions {
  /** La fenêtre d'un résumé, en millisecondes. Défaut : 500. */
  sampleMs?: number;
  /** Combien de résumés garder pour la courbe. Défaut : 60. */
  historySize?: number;
  /** L'horloge écoutée. Défaut : celle de la page (`requestAnimationFrame`). */
  source?: FpsSource;
}

const EMPTY: FpsReading = { fps: 0, min: 0, ms: 0, history: [], idle: true };

/** La mesure seule, pour un affichage à soi. Rend un nouveau résumé toutes les `sampleMs`. */
export function useFps({ sampleMs = 500, historySize = 60, source }: UseFpsOptions = {}): FpsReading {
  const [reading, setReading] = useState<FpsReading>(EMPTY);
  useEffect(() => {
    let frames = 0;
    let total = 0;
    let worst = 0;
    const history: number[] = [];
    const note = (ms: number) => {
      if (!(ms > 0) || ms > 2000) return;
      frames += 1;
      total += ms;
      if (ms > worst) worst = ms;
    };
    let stop: () => void;
    if (source) stop = source.subscribe(note);
    else {
      let raf = 0;
      let last = performance.now();
      const loop = (now: number) => {
        note(now - last);
        last = now;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      stop = () => cancelAnimationFrame(raf);
    }
    const timer = window.setInterval(() => {
      const idle = frames === 0;
      // Une page en arrière-plan ou une scène au repos : la cadence est nulle, pas « inconnue ».
      const fps = idle ? 0 : frames / (sampleMs / 1000);
      const ms = idle ? 0 : total / frames;
      const min = idle ? 0 : 1000 / worst;
      history.push(fps);
      if (history.length > historySize) history.shift();
      setReading({ fps, min: Math.min(min, fps), ms, history: history.slice(), idle });
      frames = 0;
      total = 0;
      worst = 0;
    }, sampleMs);
    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, [sampleMs, historySize, source]);
  return reading;
}

export type FpsMeterPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface FpsMeterProps {
  /** Le coin où la pastille se pose. Défaut : en bas à droite. */
  position?: FpsMeterPosition;
  /** Le retrait depuis ce coin, en pixels. Défaut : 8 et 8. */
  offset?: { x: number; y: number };
  /** La fenêtre d'un résumé, en millisecondes. Défaut : 500. */
  sampleMs?: number;
  /** La petite courbe des derniers résumés. Défaut : oui. */
  showGraph?: boolean;
  /** Seulement la cadence, sans le minimum ni la durée d'image. */
  compact?: boolean;
  /** L'horloge mesurée. Défaut : la page. `warehouseSceneFrames` : les images des scènes d'entrepôt. */
  source?: FpsSource;
  /** Un mot devant la mesure : « Scène », « Page ». */
  label?: string;
  className?: string;
}

const level = (fps: number) => (fps >= 50 ? "good" : fps >= 30 ? "warn" : "critical");

export function FpsMeter({ position = "bottom-right", offset = { x: 8, y: 8 }, sampleMs = 500, showGraph = true, compact = false, source, label, className }: FpsMeterProps) {
  const r = useFps({ sampleMs, source });
  const [v, h] = position.split("-") as ["top" | "bottom", "left" | "right"];
  const style: CSSProperties = { [v]: offset.y, [h]: offset.x };
  const peak = Math.max(60, ...r.history);
  const W = 60;
  const H = 16;
  const pts = r.history.map((f, i) => `${((i + (60 - r.history.length)) / 59) * W},${H - (f / peak) * (H - 2) - 1}`).join(" ");
  const state = r.idle ? "idle" : level(r.fps);
  return (
    <div className={["lq-fps", compact && "lq-fps--compact", className].filter(Boolean).join(" ")} style={style} data-level={state} role="status" aria-live="off" aria-label={r.idle ? "Cadence : au repos" : `Cadence : ${Math.round(r.fps)} images par seconde`}>
      {label && <span className="lq-fps__label">{label}</span>}
      <span className="lq-fps__value">
        {r.idle ? "au repos" : Math.round(r.fps)}
        {!r.idle && <small> i/s</small>}
      </span>
      {!compact && !r.idle && (
        <span className="lq-fps__detail">
          min {Math.round(r.min)} · {r.ms.toFixed(1)} ms
        </span>
      )}
      {showGraph && (
        <svg className="lq-fps__graph" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <line x1={0} x2={W} y1={H - (30 / peak) * (H - 2) - 1} y2={H - (30 / peak) * (H - 2) - 1} className="lq-fps__floor" />
          {r.history.length > 1 && <polyline points={pts} />}
        </svg>
      )}
    </div>
  );
}
