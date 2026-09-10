import { useState } from "react";
import { Panel } from "../components/primitives/Panel";
import { TextField } from "../components/forms/TextField";
import { PasswordField } from "../components/forms/PasswordField";
import { NumberField } from "../components/forms/NumberField";
import { Select } from "../components/forms/Select";
import { DatePicker } from "../components/forms/DatePicker";
import { RangeSlider } from "../components/forms/RangeSlider";
import { Checkbox } from "../components/forms/Checkbox";
import { TagInput } from "../components/forms/TagInput";
import { Button } from "../components/primitives/Button";
import { SearchIcon } from "../components/icons";

/** The form half of the library, in one panel. Every field here is controlled by this component's
 *  own state, which is also how a consumer wires them: the library holds no form state. */
export function FormsShowcase() {
  const [symbol, setSymbol] = useState("MSFT");
  const [password, setPassword] = useState("");
  const [quantity, setQuantity] = useState<number | "">(18);
  const [account, setAccount] = useState<string | null>("pea");
  const [date, setDate] = useState<Date | null>(new Date(2026, 5, 11));
  const [range, setRange] = useState<[number, number]>([120, 460]);
  const [tags, setTags] = useState<string[]>(["Dividendes", "Long terme"]);
  const [confirm, setConfirm] = useState(true);

  return (
    <Panel title="Nouvel ordre" meta="Formulaires">
      <div className="lqx-form-grid">
        <TextField
          label="Symbole"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          leadingIcon={<SearchIcon size={16} />}
        />
        <NumberField label="Quantité" value={quantity} onChange={setQuantity} min={0} step={1} suffix="titres" />
        <Select
          label="Compte"
          value={account}
          onChange={setAccount}
          options={[
            { value: "pea", label: "PEA" },
            { value: "cto", label: "Compte-titres" },
            { value: "per", label: "PER" },
          ]}
        />
        <DatePicker label="Date d'exécution" value={date} onChange={setDate} />
        <PasswordField label="Code de validation" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TagInput label="Étiquettes" value={tags} onChange={setTags} />
        <div className="lqx-form-grid__wide">
          <RangeSlider
            label="Fourchette de prix"
            min={0}
            max={600}
            step={10}
            value={range}
            onChange={setRange}
            formatValue={(v) => `${v} €`}
          />
        </div>
        <div className="lqx-form-grid__wide lqx-form-grid__actions">
          <Checkbox checked={confirm} onChange={setConfirm} label="Demander une confirmation avant l'envoi" />
          <Button selected>Passer l'ordre</Button>
        </div>
      </div>
    </Panel>
  );
}
