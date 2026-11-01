import type { Meta, StoryObj } from "@storybook/react";
import { InvoicePage, type InvoiceLine } from "./InvoicePage";
import { Badge } from "../components/finance/Badge";
import { Button } from "../components/primitives/Button";
import { ChevronLeftIcon } from "../components/icons";
import { DEMO_INVOICE_LINES } from "../test-data/pagesData";

const meta: Meta<typeof InvoicePage> = {
  title: "Pages/InvoicePage",
  component: InvoicePage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof InvoicePage>;

const LOGO = <strong style={{ fontSize: "1.25rem", letterSpacing: "-0.03em" }}>atelier&nbsp;nord</strong>;

const ISSUER = {
  name: "Atelier Nord SAS",
  details: ["12 rue des Tanneurs, 69002 Lyon", "contact@ateliernord.fr · 04 78 00 00 00", "SIRET 812 345 678 00021 · TVA FR12 812345678"],
};

const CLIENT = {
  name: "Lemoine & Associés",
  details: ["À l'attention de Claire Lemoine", "48 quai Saint-Vincent", "69001 Lyon"],
};

const TERMS = (
  <>
    Paiement à 30 jours par virement (IBAN FR76 0000 0000 0000 0000 0000 000). En cas de retard, pénalités au taux de trois fois le taux d'intérêt
    légal et indemnité forfaitaire de 40 € pour frais de recouvrement. Pas d'escompte pour paiement anticipé.
  </>
);

export const Default: Story = {
  render: () => (
    <InvoicePage
      number="F-2026-0147"
      issueDate="2026-10-15"
      dueDate="2026-11-14"
      logo={LOGO}
      issuer={ISSUER}
      client={CLIENT}
      lines={DEMO_INVOICE_LINES}
      notes="Merci pour votre confiance. Référence de commande : BC-5531."
      terms={TERMS}
      onDownload={() => {}}
    />
  ),
};

const MIXED_LINES: InvoiceLine[] = [
  { id: "a", description: "Formation « Lire un tableau de bord »", detail: "Session de 7 heures, 8 participants.", quantity: 1, unitPrice: 1800 },
  { id: "b", description: "Support de cours imprimé", quantity: 8, unit: "ex.", unitPrice: 24, vatRate: 0.055 },
  { id: "c", description: "Déplacement", quantity: 1, unitPrice: 96.4 },
];

export const MixedVatRates: Story = {
  render: () => (
    <InvoicePage
      number="F-2026-0151"
      issueDate="2026-10-22"
      dueDate="2026-10-22"
      logo={LOGO}
      issuer={ISSUER}
      client={CLIENT}
      lines={MIXED_LINES}
      status={<Badge tone="up">Payée</Badge>}
      toolbar={
        <Button icon={<ChevronLeftIcon size={16} />} onClick={() => {}}>
          Factures
        </Button>
      }
      onPrint={() => {}}
    />
  ),
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export const CustomFormat: Story = {
  render: () => (
    <InvoicePage
      title="Invoice"
      number="0047"
      issueDate="2026-09-29"
      issuer={{ name: "Atelier Nord Inc.", details: ["1600 Market Street, San Francisco, CA"] }}
      client={{ name: "Northwind Traders", details: ["Seattle, WA"] }}
      lines={[
        { id: "x", description: "Character illustration", quantity: 84, unit: "h", unitPrice: 65 },
        { id: "y", description: "Charity branding", quantity: 100, unit: "h", unitPrice: 89 },
      ]}
      vatRate={0}
      formatMoney={(n) => usd.format(n)}
      formatDate={(d) => usDate.format(d)}
      labels={{
        number: "Invoice no.",
        issueDate: "Invoice date",
        billedTo: "Invoice to",
        description: "Description",
        quantity: "Qty",
        unitPrice: "Rate",
        lineTotal: "Total",
        subtotal: "Subtotal",
        vat: "Tax",
        total: "Total due",
        print: "Print",
      }}
      onPrint={() => {}}
    />
  ),
};

export const WithoutActions: Story = {
  render: () => (
    <InvoicePage
      number="F-2026-0147"
      issueDate="2026-10-15"
      issuer={ISSUER}
      client={CLIENT}
      lines={DEMO_INVOICE_LINES.slice(0, 2)}
      onPrint={null}
    />
  ),
};

export const InFrame: Story = {
  render: () => (
    <div style={{ width: 480, height: 640, overflow: "auto", border: "1px solid var(--lq-color-border)" }}>
      <InvoicePage
        number="F-2026-0147"
        issueDate="2026-10-15"
        dueDate="2026-11-14"
        logo={LOGO}
        issuer={ISSUER}
        client={CLIENT}
        lines={DEMO_INVOICE_LINES}
        onPrint={() => {}}
        onDownload={() => {}}
      />
    </div>
  ),
};
