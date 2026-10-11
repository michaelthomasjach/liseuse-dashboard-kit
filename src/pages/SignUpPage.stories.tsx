import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SignUpPage } from "./SignUpPage";
import { Input } from "../components/forms/Input";
import { InputPassword } from "../components/forms/InputPassword";
import { PhoneInput } from "../components/forms/PhoneInput";
import { Checkbox } from "../components/forms/Checkbox";
import { Button } from "../components/primitives/Button";
import { UserIcon } from "../components/icons";

const meta: Meta<typeof SignUpPage> = {
  title: "Pages/SignUpPage",
  component: SignUpPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SignUpPage>;

// Local, offline placeholder — swap for a real product image in your app.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400">
      <defs>
        <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#0f1420"/>
          <stop offset="1" stop-color="#16a34a" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1400" fill="url(#g)"/>
    </svg>
  `);

export const Default: Story = {
  render: () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    return (
      <SignUpPage
        imageSrc={PLACEHOLDER_IMAGE}
        imageAlt="Illustration"
        logo={<strong style={{ fontSize: "1.1rem" }}>Finance Kit</strong>}
        title="Créer un compte"
        subtitle="Quelques informations pour commencer."
        terms={
          <Checkbox
            checked={acceptedTerms}
            onChange={setAcceptedTerms}
            label="J'accepte les conditions générales et la politique de confidentialité"
          />
        }
        footer={<span>Déjà un compte ? Connectez-vous.</span>}
      >
        <Input label="Nom complet" placeholder="Jane Doe" leadingIcon={<UserIcon size={16} />} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
        <InputPassword label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button block selected disabled={!acceptedTerms}>
          Créer mon compte
        </Button>
      </SignUpPage>
    );
  },
};
