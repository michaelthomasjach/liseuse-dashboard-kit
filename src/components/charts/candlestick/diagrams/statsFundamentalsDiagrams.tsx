import { DiagramImage } from "./DiagramPrimitives";
import correlationImg from "./images/correlation.jpg";
import freeCashFlowImg from "./images/freeCashFlow.jpg";
import netIncomeImg from "./images/netIncome.jpg";
import totalRevenueImg from "./images/totalRevenue.jpg";
import netMarginImg from "./images/netMargin.jpg";
import grossMarginImg from "./images/grossMargin.jpg";
import peRatioImg from "./images/peRatio.jpg";
import epsImg from "./images/eps.jpg";
import debtToEquityImg from "./images/debtToEquity.jpg";

export function CorrelationDiagram() {
  return <DiagramImage src={correlationImg} alt="Coefficient de corrélation tracé dans son propre panneau, oscillant entre -1 et +1 face à un second symbole" />;
}

export function FreeCashFlowDiagram() {
  return <DiagramImage src={freeCashFlowImg} alt="Free Cash Flow tracé dans son propre panneau, la trésorerie générée par trimestre sous forme de paliers" />;
}

export function NetIncomeDiagram() {
  return <DiagramImage src={netIncomeImg} alt="Net Income tracé dans son propre panneau, le bénéfice net par trimestre sous forme de paliers" />;
}

export function TotalRevenueDiagram() {
  return <DiagramImage src={totalRevenueImg} alt="Total Revenue tracé dans son propre panneau, le chiffre d'affaires par trimestre sous forme de paliers" />;
}

export function NetMarginDiagram() {
  return <DiagramImage src={netMarginImg} alt="Net Margin tracée dans son propre panneau, la marge nette par trimestre en pourcentage" />;
}

export function GrossMarginDiagram() {
  return <DiagramImage src={grossMarginImg} alt="Gross Margin tracée dans son propre panneau, la marge brute par trimestre en pourcentage" />;
}

export function PeRatioDiagram() {
  return <DiagramImage src={peRatioImg} alt="Price/Earnings (PER) tracé dans son propre panneau, le ratio cours/bénéfice par trimestre" />;
}

export function EpsDiagram() {
  return <DiagramImage src={epsImg} alt="Earnings Per Share (EPS) tracé dans son propre panneau, le bénéfice par action par trimestre" />;
}

export function DebtToEquityDiagram() {
  return <DiagramImage src={debtToEquityImg} alt="Debt/Equity tracé dans son propre panneau, le ratio dette sur capitaux propres par trimestre" />;
}
