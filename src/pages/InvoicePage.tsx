import type { ReactNode } from "react";
import { Button } from "../components/primitives/Button";
import "./InvoicePage.css";

/** Une ligne de facture. Les montants sont hors taxes ; le total de la ligne est calculé. */
export interface InvoiceLine {
  /** Clé React ; à défaut, l'index. */
  id?: string;
  /** Désignation. */
  description: string;
  /** Précision sous la désignation, en plus petit. */
  detail?: string;
  quantity: number;
  /** Unité accolée à la quantité (« h », « j », « u. »). */
  unit?: string;
  /** Prix unitaire hors taxes. */
  unitPrice: number;
  /** Taux de TVA propre à la ligne (0,055 pour 5,5 %) ; à défaut, `vatRate` de la facture. */
  vatRate?: number;
}

interface InvoiceParty {
  name: string;
  /** Lignes d'adresse, de contact, d'identifiant (SIRET, TVA intracommunautaire)… une par entrée. */
  details?: string[];
}

export interface InvoicePageProps {
  /** Numéro de facture. */
  number: string;
  /** Date d'émission — `Date` ou chaîne ISO (`"2026-10-15"`, lue comme une date locale). */
  issueDate: Date | string;
  /** Date d'échéance. */
  dueDate?: Date | string;
  /** Émetteur, en haut à gauche, sous `logo`. */
  issuer: InvoiceParty;
  /** Client, sous « Facturé à ». */
  client: InvoiceParty;
  /** Marque de l'émetteur, au-dessus de son nom. */
  logo?: ReactNode;
  lines: InvoiceLine[];
  /** Taux de TVA par défaut, appliqué aux lignes qui n'ont pas le leur. Défaut 0,2. */
  vatRate?: number;
  /** Formate un montant. Défaut : euros à la française (`1 234,50 €`). */
  formatMoney?: (amount: number) => string;
  /** Formate une date. Défaut : `15/10/2026`. */
  formatDate?: (date: Date) => string;
  /** Mot affiché en grand en haut à droite. Défaut « Facture ». */
  title?: string;
  /** Pastille d'état à côté du titre (un `Badge` « Payée », « En retard »). */
  status?: ReactNode;
  /** Notes libres sous les totaux (remerciements, référence de commande). */
  notes?: ReactNode;
  /** Conditions de paiement, mentions légales — en bas de la feuille. */
  terms?: ReactNode;
  /** Bouton « Imprimer ». Défaut : `window.print()`. `null` retire le bouton. */
  onPrint?: (() => void) | null;
  /** Ajoute le bouton « Télécharger » (le PDF est votre affaire). */
  onDownload?: () => void;
  /** Contenu libre à gauche de la barre d'actions (un retour à la liste, un menu). */
  toolbar?: ReactNode;
  /** Textes de l'interface. */
  labels?: Partial<InvoiceLabels>;
  /** Occupe au moins toute la hauteur de la fenêtre (`100dvh`). Sans, la page remplit son
   *  conteneur (`min-height: 100%`). */
  fullHeight?: boolean;
  className?: string;
}

interface InvoiceLabels {
  number: string;
  issueDate: string;
  dueDate: string;
  billedTo: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  vat: string;
  total: string;
  notes: string;
  terms: string;
  print: string;
  download: string;
}

const DEFAULT_LABELS: InvoiceLabels = {
  number: "N° de facture",
  issueDate: "Date d'émission",
  dueDate: "Échéance",
  billedTo: "Facturé à",
  description: "Désignation",
  quantity: "Qté",
  unitPrice: "Prix unitaire HT",
  lineTotal: "Total HT",
  subtotal: "Sous-total HT",
  vat: "TVA",
  total: "Total TTC",
  notes: "Notes",
  terms: "Conditions",
  print: "Imprimer",
  download: "Télécharger",
};

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const defaultFormatMoney = (amount: number) => euros.format(amount);
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const defaultFormatDate = (date: Date) => dateFormat.format(date);
const percentFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 2 });
/** Espace insécable entre la quantité et son unité. */
const NBSP = String.fromCharCode(160);
const quantityFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

/** `"2026-10-15"` passé à `new Date` est minuit UTC, donc la veille à l'ouest de Greenwich : une
 *  date seule est lue comme une date locale. */
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

/** La date du jour local en `AAAA-MM-JJ`, pour l'attribut `dateTime`. */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Arrondi au centime, sans l'erreur de `0.1 + 0.2`. */
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

/** Facture imprimable : une feuille blanche avec émetteur, client, références, lignes, totaux HT /
 *  TVA / TTC, notes et conditions, et au-dessus une barre « Imprimer / Télécharger » qui disparaît à
 *  l'impression. */
export function InvoicePage({
  number,
  issueDate,
  dueDate,
  issuer,
  client,
  logo,
  lines,
  vatRate = 0.2,
  formatMoney = defaultFormatMoney,
  formatDate = defaultFormatDate,
  title = "Facture",
  status,
  notes,
  terms,
  onPrint = () => window.print(),
  onDownload,
  toolbar,
  labels: labelOverrides,
  fullHeight = false,
  className,
}: InvoicePageProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  // Totaux : la TVA est calculée par taux sur la somme des lignes de ce taux, puis arrondie — comme
  // le veut l'usage, plutôt que ligne par ligne.
  const subtotal = cents(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const byRate = new Map<number, number>();
  for (const line of lines) {
    const rate = line.vatRate ?? vatRate;
    byRate.set(rate, (byRate.get(rate) ?? 0) + line.quantity * line.unitPrice);
  }
  const vatLines = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, base]) => ({ rate, amount: cents(base * rate) }));
  const total = cents(subtotal + vatLines.reduce((sum, v) => sum + v.amount, 0));

  const hasActions = Boolean(toolbar || onPrint || onDownload);

  return (
    <div className={["lq-invoice-page", fullHeight && "lq-invoice-page--full-height", className].filter(Boolean).join(" ")}>
      {hasActions && (
        <div className="lq-invoice-page__toolbar">
          <div className="lq-invoice-page__toolbar-start">{toolbar}</div>
          <div className="lq-invoice-page__toolbar-end">
            {onPrint && (
              <Button onClick={onPrint} icon={<PrintIcon />}>
                {labels.print}
              </Button>
            )}
            {onDownload && (
              <Button onClick={onDownload} icon={<DownloadIcon />}>
                {labels.download}
              </Button>
            )}
          </div>
        </div>
      )}

      <article className="lq-invoice-page__sheet" aria-label={`${title} ${number}`}>
        <header className="lq-invoice-page__head">
          <div className="lq-invoice-page__issuer">
            {logo && <div className="lq-invoice-page__logo">{logo}</div>}
            <p className="lq-invoice-page__party-name">{issuer.name}</p>
            {issuer.details?.map((detail, i) => (
              <p key={i} className="lq-invoice-page__party-line">
                {detail}
              </p>
            ))}
          </div>
          <div className="lq-invoice-page__heading">
            <h1 className="lq-invoice-page__title">{title}</h1>
            {status && <div className="lq-invoice-page__status">{status}</div>}
          </div>
        </header>

        <div className="lq-invoice-page__parties">
          <div className="lq-invoice-page__client">
            <p className="lq-invoice-page__caption">{labels.billedTo}</p>
            <p className="lq-invoice-page__client-name">{client.name}</p>
            {client.details?.map((detail, i) => (
              <p key={i} className="lq-invoice-page__party-line">
                {detail}
              </p>
            ))}
          </div>
          <dl className="lq-invoice-page__refs">
            <div>
              <dt>{labels.number}</dt>
              <dd>{number}</dd>
            </div>
            <div>
              <dt>{labels.issueDate}</dt>
              <dd>
                <time dateTime={isoDay(toDate(issueDate))}>{formatDate(toDate(issueDate))}</time>
              </dd>
            </div>
            {dueDate !== undefined && (
              <div>
                <dt>{labels.dueDate}</dt>
                <dd>
                  <time dateTime={isoDay(toDate(dueDate))}>{formatDate(toDate(dueDate))}</time>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="lq-invoice-page__table-wrap">
          <table className="lq-invoice-page__table">
            <thead>
              <tr>
                <th scope="col">{labels.description}</th>
                <th scope="col" className="lq-invoice-page__num">
                  {labels.quantity}
                </th>
                <th scope="col" className="lq-invoice-page__num">
                  {labels.unitPrice}
                </th>
                <th scope="col" className="lq-invoice-page__num">
                  {labels.lineTotal}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={line.id ?? i}>
                  <td>
                    <span className="lq-invoice-page__line-title">{line.description}</span>
                    {line.detail && <span className="lq-invoice-page__line-detail">{line.detail}</span>}
                  </td>
                  <td className="lq-invoice-page__num">
                    {quantityFormat.format(line.quantity)}
                    {line.unit && `${NBSP}${line.unit}`}
                  </td>
                  <td className="lq-invoice-page__num">{formatMoney(line.unitPrice)}</td>
                  <td className="lq-invoice-page__num">{formatMoney(cents(line.quantity * line.unitPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lq-invoice-page__summary">
          {notes ? (
            <div className="lq-invoice-page__notes">
              <p className="lq-invoice-page__caption">{labels.notes}</p>
              <div>{notes}</div>
            </div>
          ) : (
            <span />
          )}
          <dl className="lq-invoice-page__totals">
            <div>
              <dt>{labels.subtotal}</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            {vatLines.map((v) => (
              <div key={v.rate}>
                <dt>
                  {labels.vat} {percentFormat.format(v.rate)}
                </dt>
                <dd>{formatMoney(v.amount)}</dd>
              </div>
            ))}
            <div className="lq-invoice-page__grand-total">
              <dt>{labels.total}</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
          </dl>
        </div>

        {terms && (
          <footer className="lq-invoice-page__terms">
            <p className="lq-invoice-page__caption">{labels.terms}</p>
            <div>{terms}</div>
          </footer>
        )}
      </article>
    </div>
  );
}
