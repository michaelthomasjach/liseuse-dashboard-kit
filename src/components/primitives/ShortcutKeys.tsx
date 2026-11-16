import type { ComponentType, ReactNode } from "react";
import "./ShortcutKeys.css";
import {
  MouseClickIcon,
  MouseDoubleClickIcon,
  MouseDragIcon,
  MouseLongPressIcon,
  MouseRightClickIcon,
  MouseWheelIcon,
} from "../icons";
import { IS_APPLE_PLATFORM } from "../charts/internal/platformShortcut";
import { shortcutTokenLabel, type ShortcutToken } from "../charts/candlestick/chartShortcuts";

export interface KeyboardKeyProps {
  children: ReactNode;
  /** Nom lu par les lecteurs d'écran, quand le texte affiché est un symbole (« ⌘ », « ↑ »). */
  label?: string;
  className?: string;
}

/** Une touche de clavier : une capsule `<kbd>` en relief, coin arrondi, aux couleurs du thème. */
export function KeyboardKey({ children, label, className }: KeyboardKeyProps) {
  return (
    <kbd className={["lq-kbd", className].filter(Boolean).join(" ")} aria-label={label} title={label}>
      {children}
    </kbd>
  );
}

const MOUSE_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  click: MouseClickIcon,
  dblclick: MouseDoubleClickIcon,
  rightclick: MouseRightClickIcon,
  wheel: MouseWheelIcon,
  drag: MouseDragIcon,
  longpress: MouseLongPressIcon,
};

export interface ShortcutKeysProps {
  /** Une ou plusieurs combinaisons équivalentes, chacune une suite de touches (voir `ShortcutToken`) :
   *  `[["Mod", "Shift", "Z"], ["Mod", "Y"]]`. */
  keys: ShortcutToken[][];
  /** Force l'affichage Mac (⌘, ⌥, ⌃) ou PC (Ctrl, Alt). Par défaut, détecté depuis le navigateur. */
  platform?: "mac" | "pc";
  className?: string;
}

/** Les touches d'un raccourci, dessinées : une capsule par touche, « + » entre elles, « ou » entre deux combinaisons
 *  équivalentes, et une icône de souris pour un clic, un double-clic, un clic droit, la molette, un glisser ou un
 *  appui long. Sur Mac, ⌘ remplace Ctrl et ⌥ remplace Alt. */
export function ShortcutKeys({ keys, platform, className }: ShortcutKeysProps) {
  const apple = platform ? platform === "mac" : IS_APPLE_PLATFORM;
  return (
    <span className={["lq-shortcut-keys", className].filter(Boolean).join(" ")}>
      {keys.map((combo, i) => (
        <span className="lq-shortcut-keys__combo" key={i}>
          {i > 0 && <span className="lq-shortcut-keys__or">ou</span>}
          {combo.map((token, j) => {
            const label = shortcutTokenLabel(token, apple);
            const Icon = MOUSE_ICONS[token];
            return (
              <span className="lq-shortcut-keys__step" key={j}>
                {j > 0 && (
                  <span className="lq-shortcut-keys__plus" aria-hidden="true">
                    +
                  </span>
                )}
                {Icon ? (
                  <span className="lq-shortcut-keys__mouse" role="img" aria-label={label} title={label}>
                    <Icon size={16} />
                  </span>
                ) : (
                  <KeyboardKey label={label}>{label}</KeyboardKey>
                )}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
