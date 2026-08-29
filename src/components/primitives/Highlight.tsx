import { Card, type CardProps } from "./Card";

export type HighlightProps = Omit<CardProps, "highlight">;

/** A `Card` with `highlight` always on — a quiet KPI tile (thick top rule, small muted uppercase
 *  label, no box) rather than a boxed section card. `Card` itself is what actually implements this
 *  (see that component's own `highlight` prop doc); kept as its own named export for discoverability,
 *  same relationship `ExpandableCard` has to `expandable`. */
export function Highlight(props: HighlightProps) {
  return <Card {...props} highlight />;
}
