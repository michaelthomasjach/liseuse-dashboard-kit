import { createRoot } from "react-dom/client";
import { LqThemeProvider } from "../../../../../theme";
import { HoverBenchScene } from "../HoverBenchScene";

/* Page autonome du banc de performance du survol : la scène seule, React de production, aucun
 * outil autour (scripts/benchChartHover.cjs). Paramètres dans l'URL :
 * ?panes=5&workspace=1&page=0&candles=600 */
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const flag = (k: string, d: boolean) => (q.has(k) ? q.get(k) === "1" || q.get(k) === "true" : d);

createRoot(document.getElementById("root")!).render(
  <LqThemeProvider palette="eink" surface="light">
    <HoverBenchScene panes={num("panes", 5)} workspace={flag("workspace", true)} candles={num("candles", 600)} page={flag("page", false)} />
  </LqThemeProvider>,
);
