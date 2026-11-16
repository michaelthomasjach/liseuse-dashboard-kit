import type { Meta, StoryObj } from "@storybook/react";
import { KeyboardKey, ShortcutKeys } from "./ShortcutKeys";
import { ShortcutsPanel } from "../charts/candlestick/components/ShortcutsPanel";

const meta: Meta<typeof ShortcutKeys> = {
  title: "Primitives/ShortcutKeys",
  component: ShortcutKeys,
};
export default meta;
type Story = StoryObj<typeof ShortcutKeys>;

/** Une touche seule, puis des combinaisons : « + » entre les touches, « ou » entre deux combinaisons équivalentes,
 *  une icône de souris pour les gestes. */
export const Combinaisons: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <KeyboardKey>Échap</KeyboardKey>
      </div>
      <ShortcutKeys keys={[["Mod", "Z"]]} />
      <ShortcutKeys keys={[["Mod", "Y"], ["Mod", "Shift", "Z"]]} />
      <ShortcutKeys keys={[["Shift", "click"], ["Shift", "drag"]]} />
      <ShortcutKeys keys={[["dblclick"], ["rightclick"], ["wheel"], ["longpress"]]} />
      <ShortcutKeys keys={[["Alt", "ArrowUp"], ["Alt", "ArrowDown"]]} />
    </div>
  ),
};

/** Les mêmes, comme sur un Mac : ⌘ au lieu de Ctrl, ⌥ au lieu d'Alt. */
export const Mac: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <ShortcutKeys platform="mac" keys={[["Mod", "Z"]]} />
      <ShortcutKeys platform="mac" keys={[["Mod", "Alt", "G"]]} />
      <ShortcutKeys platform="mac" keys={[["Ctrl", "Space"]]} />
    </div>
  ),
};

/** Tous les raccourcis du kit (`CHART_SHORTCUTS`), tels que les montre l'onglet « Raccourcis » de l'aide de
 *  l'espace de travail : c'est la documentation de référence des raccourcis. */
export const TousLesRaccourcis: Story = {
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <ShortcutsPanel />
    </div>
  ),
};
