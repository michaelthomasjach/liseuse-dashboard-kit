import { NumberField } from "../../../forms/NumberField";
import { Select } from "../../../forms/Select";
import type { StrategySettings } from "../interfaces/StrategySettings.interface";

export interface StrategySettingsFormProps {
  settings: StrategySettings;
  onChange: (next: StrategySettings) => void;
}

/** Currencies offered by the account selector. Display-only (this engine converts nothing, see
 *  `StrategySettings.currency`), so the list is about covering what someone is likely to keep an
 *  account in rather than being exhaustive — anything missing is a one-line addition. */
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"];

/** The strategy's own settings, in the two groups a trading platform separates them into — and for
 *  a reason worth keeping: the top group describes *your account*, the bottom one describes *the
 *  broker you are pretending to trade through*. Mixing them makes it far too easy to read a
 *  backtest as a property of the strategy when half of what shaped it was the friction model. */
export function StrategySettingsForm({ settings, onChange }: StrategySettingsFormProps) {
  const set = <K extends keyof StrategySettings>(key: K, value: StrategySettings[K]) => onChange({ ...settings, [key]: value });
  const num = (key: keyof StrategySettings) => (value: number | "") => {
    if (value !== "") set(key, value as never);
  };

  return (
    <div className="lq-strategy__settings">
      <section className="lq-strategy__settings-group">
        <h4 className="lq-strategy__settings-title">Général</h4>
        <div className="lq-strategy__settings-grid">
          <NumberField label="Capital initial" value={settings.initialCapital} min={0} step={100} onChange={num("initialCapital")} />
          <Select
            label="Devise du compte"
            value={settings.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => set("currency", v)}
          />
          <NumberField label="Taille d'ordre" value={settings.orderSize} min={0} step={1} onChange={num("orderSize")} />
          <Select
            label="Unité de taille"
            value={settings.orderSizeUnit}
            options={[
              { value: "contracts", label: "Contrats" },
              { value: "currency", label: settings.currency },
              { value: "equityPercent", label: "% de l'équité" },
            ]}
            onChange={(v) => set("orderSizeUnit", v as StrategySettings["orderSizeUnit"])}
            helperText="En contrats, dans la devise du compte, ou en pourcentage de l'équité courante — la seule des trois qui compose."
          />
          <NumberField
            label="Pyramiding"
            value={settings.pyramiding}
            min={1}
            step={1}
            onChange={num("pyramiding")}
            helperText="Nombre d'entrées ouvertes simultanément. 1 = une position à la fois."
          />
          <Select
            label="Exécution"
            value={settings.fillTiming}
            options={[
              { value: "barClose", label: "À la clôture de la bougie" },
              { value: "barOpen", label: "À l'ouverture suivante" },
              { value: "historyTick", label: "À chaque tick historique" },
              { value: "realtimeTick", label: "À chaque tick en direct" },
            ]}
            onChange={(v) => set("fillTiming", v as StrategySettings["fillTiming"])}
            helperText="Ce moteur rejoue des bougies, pas des ticks : les deux modes tick se comportent aujourd'hui comme « à la clôture »."
          />
        </div>
      </section>

      <section className="lq-strategy__settings-group">
        <h4 className="lq-strategy__settings-title">Émulateur de broker</h4>
        <div className="lq-strategy__settings-grid">
          <Select
            label="Type de commission"
            value={settings.commissionKind}
            options={[
              { value: "percent", label: "Pourcentage" },
              { value: "fixed", label: "Montant fixe" },
            ]}
            onChange={(v) => set("commissionKind", v as StrategySettings["commissionKind"])}
          />
          <NumberField
            label={settings.commissionKind === "percent" ? "Commission (%)" : `Commission (${settings.currency})`}
            value={settings.commissionValue}
            min={0}
            step={0.01}
            onChange={num("commissionValue")}
          />
          <NumberField label="Levier long" value={settings.leverageLong} min={1} step={1} onChange={num("leverageLong")} />
          <NumberField label="Levier short" value={settings.leverageShort} min={1} step={1} onChange={num("leverageShort")} />
          <NumberField
            label="Slippage (ticks)"
            value={settings.slippageTicks}
            min={0}
            step={1}
            onChange={num("slippageTicks")}
            helperText="Toujours défavorable : un achat est rempli au-dessus du prix vu, une vente en dessous."
          />
          <NumberField
            label="Taille du tick"
            value={settings.tickSize}
            min={0}
            step={0.01}
            onChange={num("tickSize")}
            helperText="Ce que vaut un tick en unités de prix — propriété de l'instrument, pas déductible de ses bougies."
          />
        </div>
      </section>
    </div>
  );
}
