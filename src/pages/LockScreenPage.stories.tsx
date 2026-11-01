import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LockScreenPage } from "./LockScreenPage";
import { DEMO_AVATAR } from "../test-data/pagesData";

const meta: Meta<typeof LockScreenPage> = {
  title: "Pages/LockScreenPage",
  component: LockScreenPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof LockScreenPage>;

/** La page remplit son conteneur : on lui en donne un à la hauteur de la zone d'affichage (moins
 *  la marge du décorateur). */
const FRAME = { height: "calc(100vh - 64px)", minHeight: 560 } as const;

/** Démonstration : « secret » déverrouille, tout autre mot de passe est refusé après 600 ms. */
function useDemoUnlock() {
  const [error, setError] = useState<string>();
  const [unlocked, setUnlocked] = useState(false);
  const onUnlock = (password: string) =>
    new Promise<void>((resolve, reject) => {
      setError(undefined);
      setTimeout(() => {
        if (password === "secret") {
          setUnlocked(true);
          resolve();
        } else {
          setError("Mot de passe incorrect.");
          reject(new Error("refusé"));
        }
      }, 600);
    });
  return { error, unlocked, onUnlock };
}

export const Default: Story = {
  render: function Render() {
    const { error, unlocked, onUnlock } = useDemoUnlock();
    return (
      <div style={FRAME}>
        <LockScreenPage
          name="Claire Lemoine"
          avatarSrc={DEMO_AVATAR}
          time="09:41"
          date="dimanche 1 novembre 2026"
          eyebrow={unlocked ? "Déverrouillé (démonstration)" : undefined}
          onUnlock={onUnlock}
          error={error}
          onSwitchUser={() => {}}
          footer="Essayez « secret » ; tout autre mot de passe est refusé."
        />
      </div>
    );
  },
};

export const WithError: Story = {
  render: () => (
    <div style={FRAME}>
      <LockScreenPage name="Claire Lemoine" avatarSrc={DEMO_AVATAR} onUnlock={() => {}} error="Mot de passe incorrect. Il vous reste 2 essais." switchUserHref="#connexion" />
    </div>
  ),
};

export const Unlocking: Story = {
  render: () => (
    <div style={FRAME}>
      <LockScreenPage name="Hugo Martin" onUnlock={() => {}} unlocking time="18:05" date="vendredi 30 octobre" />
    </div>
  ),
};

export const InFrame: Story = {
  render: () => (
    <div style={{ width: 360, height: 520, border: "1px solid var(--lq-color-border)" }}>
      <LockScreenPage name="Claire Lemoine" avatarSrc={DEMO_AVATAR} onUnlock={() => {}} onSwitchUser={() => {}} />
    </div>
  ),
};
