import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./Tabs.css";
import { observeElementSize } from "../../internal/observeElementSize";

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
 *  indicator slides to the selected tab instead of jumping. */
export function Tabs({ items, value, onChange, orientation = "horizontal", className }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<CSSProperties>({ opacity: 0 });

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
          aria-selected={item.id === value}
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
