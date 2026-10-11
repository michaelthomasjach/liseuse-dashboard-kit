import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LoginPage } from "./LoginPage";
import { Input } from "../components/forms/Input";
import { InputPassword } from "../components/forms/InputPassword";
import { Button } from "../components/primitives/Button";
import { UserIcon } from "../components/icons";

const meta: Meta<typeof LoginPage> = {
  title: "Pages/LoginPage",
  component: LoginPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof LoginPage>;

// Local, offline placeholder — swap for a real product image in your app.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f1420"/>
          <stop offset="1" stop-color="#1e3a5f"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1400" fill="url(#g)"/>
    </svg>
  `);

export const Default: Story = {
  render: () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    return (
      <LoginPage
        imageSrc={PLACEHOLDER_IMAGE}
        imageAlt="Illustration"
        logo={<strong style={{ fontSize: "1.1rem" }}>Finance Kit</strong>}
        title="Bon retour"
        subtitle="Connectez-vous à votre espace."
        footer={<span>Pas de compte ? Contactez votre conseiller.</span>}
      >
        <Input label="Email" type="email" placeholder="vous@exemple.com" leadingIcon={<UserIcon size={16} />} value={email} onChange={(e) => setEmail(e.target.value)} />
        <InputPassword label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button block selected>
          Se connecter
        </Button>
      </LoginPage>
    );
  },
};
