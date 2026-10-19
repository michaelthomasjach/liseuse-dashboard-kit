import type { Meta, StoryObj } from "@storybook/react";
import { UserMenu } from "./UserMenu";
import { UserIcon, SettingsIcon, LogoutIcon, BellIcon, CreditCardIcon, LockIcon } from "../icons";

const meta: Meta<typeof UserMenu> = {
  title: "Layouts/UserMenu",
  component: UserMenu,
};
export default meta;
type Story = StoryObj<typeof UserMenu>;

export const Default: Story = {
  render: () => (
    <UserMenu
      name="Michael Jach"
      subtitle="Compte Croissance"
      items={[
        { id: "profile", label: "Profil", icon: <UserIcon size={16} /> },
        { id: "settings", label: "Paramètres", icon: <SettingsIcon size={16} /> },
        { id: "logout", label: "Déconnexion", icon: <LogoutIcon size={16} />, danger: true },
      ]}
    />
  ),
};

export const WithSubmenu: Story = {
  name: "Avec sous-menu",
  render: () => (
    <div style={{ padding: 48 }}>
      <UserMenu
        name="Michael Jach"
        subtitle="Compte Croissance"
        items={[
          { id: "profile", label: "Profil", icon: <UserIcon size={16} /> },
          {
            id: "settings",
            label: "Paramètres",
            icon: <SettingsIcon size={16} />,
            children: [
              { id: "notifications", label: "Notifications", icon: <BellIcon size={16} /> },
              { id: "billing", label: "Facturation", icon: <CreditCardIcon size={16} /> },
              {
                id: "security",
                label: "Sécurité",
                icon: <LockIcon size={16} />,
                children: [
                  { id: "password", label: "Mot de passe" },
                  { id: "2fa", label: "Authentification à 2 facteurs" },
                ],
              },
            ],
          },
          { id: "logout", label: "Déconnexion", icon: <LogoutIcon size={16} />, danger: true },
        ]}
      />
    </div>
  ),
};
