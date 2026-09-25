import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AlertMarker, AlertMarkerStack, type AlertMarkerProps } from "./AlertMarker";

/**
 * Des épingles d'alerte plantées sur une scène. Chacune est placée par son point d'ancrage — le bout
 * de sa pointe — avec `left`/`top` puis `transform: translate(-50%, -100%)` ; les petites croix
 * marquent ces points. Le rebond s'arrête si le système demande moins d'animations
 * (`prefers-reduced-motion`), avec `bounce={false}`, et en palette e-ink.
 */
const meta: Meta<typeof AlertMarker> = {
  title: "Widgets/AlertMarker",
  component: AlertMarker,
};
export default meta;
type Story = StoryObj<typeof AlertMarker>;

/** Une fausse scène : un sol quadrillé, quelques « bâtiments ». */
const Scene = ({ children, height = 380 }: { children: ReactNode; height?: number }) => (
  <div
    style={{
      position: "relative",
      height,
      overflow: "hidden",
      background: `repeating-linear-gradient(0deg, color-mix(in srgb, var(--lq-color-text) 7%, transparent) 0 1px, transparent 1px 32px),
        repeating-linear-gradient(90deg, color-mix(in srgb, var(--lq-color-text) 7%, transparent) 0 1px, transparent 1px 32px),
        color-mix(in srgb, var(--lq-color-green) 12%, var(--lq-color-bg))`,
    }}
  >
    <div style={{ position: "absolute", left: "12%", top: "30%", width: 180, height: 110, background: "color-mix(in srgb, var(--lq-color-text) 14%, var(--lq-color-bg))" }} />
    <div style={{ position: "absolute", left: "52%", top: "48%", width: 140, height: 90, background: "color-mix(in srgb, var(--lq-color-text) 14%, var(--lq-color-bg))" }} />
    {children}
  </div>
);

/** Plante une épingle en (x, y) : le point d'ancrage est le milieu du bord bas. */
const Pin = ({ x, y, children }: { x: string; y: string; children: ReactNode }) => (
  <>
    <span aria-hidden="true" style={{ position: "absolute", left: x, top: y, width: 9, height: 9, transform: "translate(-50%, -50%)", background: "linear-gradient(var(--lq-color-text), var(--lq-color-text)) center / 1px 100% no-repeat, linear-gradient(var(--lq-color-text), var(--lq-color-text)) center / 100% 1px no-repeat", opacity: 0.6 }} />
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -100%)" }}>{children}</div>
  </>
);

export const OnScene: Story = {
  name: "Sur la scène",
  render: function Render() {
    const [last, setLast] = useState("—");
    return (
      <Scene>
        <Pin x="20%" y="36%">
          <AlertMarker severity="critical" count={4} label="Critique : quai 3 engorgé" onClick={() => setLast("Quai 3")} />
        </Pin>
        <Pin x="36%" y="52%">
          <AlertMarker severity="warning" label="Rack B presque plein" onClick={() => setLast("Rack B")} />
        </Pin>
        <Pin x="62%" y="55%">
          <AlertMarker severity="info" label="Nouveau cariste disponible" onClick={() => setLast("Cariste")} />
        </Pin>
        <Pin x="70%" y="70%">
          <AlertMarker severity="warning" size="sm" count={2} label="Convoyeur ralenti" onClick={() => setLast("Convoyeur")} />
        </Pin>
        <Pin x="82%" y="30%">
          <AlertMarker severity="critical" bounce={false} label="Panne : chariot 2 (sans rebond)" onClick={() => setLast("Chariot 2")} />
        </Pin>
        <p style={{ position: "absolute", left: 12, bottom: 4, fontSize: 13, color: "var(--lq-color-text-muted)" }}>Dernier clic : {last}</p>
      </Scene>
    );
  },
};

export const Severities: Story = {
  name: "Gravités et tailles",
  render: () => (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-end", padding: "24px 8px" }}>
      {(["critical", "warning", "info"] as const).map((s) => (
        <div key={s} style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <AlertMarker severity={s} label={s} onClick={() => {}} bounce={false} />
          <AlertMarker severity={s} label={`${s} ×3`} count={3} onClick={() => {}} bounce={false} />
          <AlertMarker severity={s} label={`${s} petit`} size="sm" onClick={() => {}} bounce={false} />
          <AlertMarker severity={s} label={`${s} ×120`} size="sm" count={120} onClick={() => {}} bounce={false} />
        </div>
      ))}
    </div>
  ),
};

const STACK: (AlertMarkerProps & { id: string })[] = [
  { id: "cash", severity: "critical", label: "Trésorerie négative", onClick: () => {} },
  { id: "late", severity: "critical", count: 3, label: "3 commandes en retard", onClick: () => {} },
  { id: "contract", severity: "warning", label: "Contrat client à renouveler", onClick: () => {} },
  { id: "staff", severity: "warning", label: "Équipe de nuit incomplète", onClick: () => {} },
  { id: "research", severity: "info", label: "Recherche terminée", onClick: () => {} },
  { id: "ach", severity: "info", label: "Succès débloqué", onClick: () => {} },
  { id: "mail", severity: "info", label: "Nouveau message", onClick: () => {} },
];

export const Stack: Story = {
  name: "Pile d'alertes sans lieu",
  render: () => (
    <Scene height={420}>
      <AlertMarkerStack alerts={STACK} corner="top-right" max={4} />
      <AlertMarkerStack alerts={STACK.slice(0, 2).map((a) => ({ ...a, size: "sm" as const }))} corner="bottom-left" aria-label="Alertes urgentes" />
    </Scene>
  ),
};
