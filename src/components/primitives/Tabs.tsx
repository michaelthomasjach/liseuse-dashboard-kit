import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import "./Tabs.css";
import { observeElementSize } from "../../internal/observeElementSize";
import { rovingTarget } from "../../internal/rovingFocus";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** Underlined tab navigation for switching panels (Positions / Orders / History…). The active
 *  indicator slides to the selected tab instead of jumping.
 *
 *  Clavier (motif « tablist » de l'APG) : un seul arrêt de tabulation, l'onglet actif ; les flèches
 *  ← → (↑ ↓ en vertical) passent à l'onglet voisin et l'activent, Début et Fin aux extrémités, en
 *  sautant les onglets désactivés et en bouclant aux deux bouts. */
export function Tabs({ items, value, onChange, orientation = "horizontal", className }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<CSSProperties>({ opacity: 0 });

  // L'arrêt de tabulation : l'onglet actif, ou le premier activable si `value` ne désigne rien.
  const focusableId = items.some((it) => it.id === value && !it.disabled) ? value : items.find((it) => !it.disabled)?.id;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((it) => it.id === (document.activeElement as HTMLElement | null)?.dataset.lqTabId);
    const target = rovingTarget(e.key, current < 0 ? 0 : current, items.length, orientation, (i) => !!items[i].disabled);
    if (target === null) return;
    e.preventDefault();
    const item = items[target];
    buttonRefs.current.get(item.id)?.focus();
    if (item.id !== value) onChange(item.id);
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    const button = buttonRefs.current.get(value);

    function update() {
      if (!container || !button) {
        setIndicator({ opacity: 0 });
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setIndicator(
        orientation === "horizontal"
          ? { opacity: 1, transform: `translateX(${buttonRect.left - containerRect.left}px)`, width: buttonRect.width }
          : { opacity: 1, transform: `translateY(${buttonRect.top - containerRect.top}px)`, height: buttonRect.height }
      );
    }

    update();
    if (!container) return;
    // Through the container's own document, so this keeps working when the component is
    // portalled into a second browser window — see observeElementSize.
    return observeElementSize(container, update);
  }, [value, orientation, items.length]);

  return (
    <div
      ref={containerRef}
      className={["lq-tabs", `lq-tabs--${orientation}`, className].filter(Boolean).join(" ")}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
    >
      <span className="lq-tabs__indicator" style={indicator} aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            if (el) buttonRefs.current.set(item.id, el);
            else buttonRefs.current.delete(item.id);
          }}
          type="button"
          role="tab"
          data-lq-tab-id={item.id}
          aria-selected={item.id === value}
          tabIndex={item.id === focusableId ? 0 : -1}
          disabled={item.disabled}
          className={["lq-tabs__tab", item.id === value && "lq-tabs__tab--active"].filter(Boolean).join(" ")}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
