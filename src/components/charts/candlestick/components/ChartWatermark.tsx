import { useLayoutEffect, useRef, useState } from "react";

export interface ChartWatermarkProps {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  /** Taille choisie dans les paramètres, en % de la taille par défaut (100). */
  size: number;
}

/** Nom du symbole en fond du graphique. La taille choisie est un maximum : un nom trop long pour la largeur du
 *  graphique est réduit jusqu'à tenir dedans (mesuré sur le texte rendu, pas estimé au nombre de lettres). */
export function ChartWatermark({ text, left, top, width, height, opacity, size }: ChartWatermarkProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const base = Math.max(12, (Math.min(height * 0.32, 160) * size) / 100);
  const [fontSize, setFontSize] = useState(base);
  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    el.style.fontSize = `${base}px`;
    const textWidth = el.scrollWidth;
    const room = width * 0.92;
    const next = textWidth > room && textWidth > 0 ? Math.max(8, (base * room) / textWidth) : base;
    el.style.fontSize = `${next}px`;
    setFontSize(next);
  }, [text, base, width]);
  return (
    <div className="lq-chart__watermark" aria-hidden="true" style={{ left, top, width, height, opacity }}>
      <span ref={spanRef} style={{ fontSize }}>
        {text}
      </span>
    </div>
  );
}
