import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Le curseur de défilement de la colonne d'outils verticale, dessiné par-dessus elle.
 *
 * La colonne fait une quarantaine de pixels : une barre de défilement native y prend sa largeur
 * (10 à 17 px selon le navigateur et le système) et pousse les icônes vers la gauche. Et elle ne
 * peut pas rester cachée jusqu'au survol de façon fiable : dès qu'un ancêtre pose `scrollbar-color`
 * (la racine du kit le fait, et la propriété s'hérite), Chrome ignore `::-webkit-scrollbar` et
 * dessine sa barre système, flèches comprises, en permanence. La barre native est donc toujours
 * masquée (`scrollbar-width: none`), et ce curseur la remplace : 4 px, posé sur le bord droit sans
 * prendre de place, visible seulement quand le pointeur est sur la colonne et qu'elle déborde.
 * La molette et le doigt font défiler la colonne elle-même ; le curseur se tire aussi à la souris.
 */
export function RailScrollThumb({ scrollerRef }: { scrollerRef: RefObject<HTMLElement> }) {
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; scrollTop: number } | null>(null);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const height = Math.max(24, (clientHeight / scrollHeight) * clientHeight);
    const top = el.offsetTop + (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ top, height });
  }, [scrollerRef]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // La colonne change de hauteur avec le graphique, et son contenu avec les outils affichés.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));
    const parent = el.parentElement;
    parent?.addEventListener("pointerenter", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      parent?.removeEventListener("pointerenter", measure);
    };
  }, [scrollerRef, measure]);

  if (!thumb) return null;

  return (
    <div
      className={["lq-chart__tools-rail-thumb", dragging && "lq-chart__tools-rail-thumb--dragging"].filter(Boolean).join(" ")}
      style={{ top: thumb.top, height: thumb.height }}
      aria-hidden="true"
      onPointerDown={(e) => {
        const el = scrollerRef.current;
        if (!el) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, scrollTop: el.scrollTop };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const el = scrollerRef.current;
        const start = drag.current;
        if (!el || !start) return;
        const track = el.clientHeight - thumb.height;
        if (track <= 0) return;
        el.scrollTop = start.scrollTop + ((e.clientY - start.y) / track) * (el.scrollHeight - el.clientHeight);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
    />
  );
}
