import { SidebarLayout } from "../components/layout/SidebarLayout";
import { Breadcrumbs } from "../components/finance/Breadcrumbs";
import { UserMenu } from "../components/finance/UserMenu";
import { StatCard } from "../components/finance/StatCard";
import { LineAreaChart } from "../components/charts/LineAreaChart";
import { WatchlistWidget } from "../components/finance-widgets/WatchlistWidget";
import { MarketMoversWidget } from "../components/finance-widgets/MarketMoversWidget";
import { ActivityIcon, HomeIcon, LogoutIcon, SettingsIcon, UserIcon, WatchlistIcon } from "../components/icons";
import { generateSeries, SAMPLE_HOLDINGS } from "../test-data/financeSampleData";
import { BrowserWindow } from "./DeviceFrames";

const EQUITY = generateSeries(150, 40_000, 33);

/** A whole screen assembled out of the library: shell, breadcrumb, user menu, KPI tiles, chart and
 *  two widgets. Nothing here is specific to this page, and nothing is drawn by hand. */
export function AppShowcase() {
  return (
    <BrowserWindow
      address="app.exemple.fr/portefeuille"
      caption="SidebarLayout, Breadcrumbs, UserMenu, StatCard, LineAreaChart, WatchlistWidget et MarketMoversWidget"
    >
      {/* A minimum rather than a fixed height: at 520px the two widgets at the bottom were
          sliced through the middle, which reads as a broken screenshot instead of an app. */}
      <div style={{ minHeight: 560 }}>
        <SidebarLayout
          logo={<strong>Portefeuille</strong>}
          navItems={[
            { id: "overview", label: "Vue d'ensemble", icon: <HomeIcon size={18} />, active: true },
            { id: "positions", label: "Positions", icon: <WatchlistIcon size={18} /> },
            { id: "analyse", label: "Analyse", icon: <ActivityIcon size={18} /> },
            { id: "settings", label: "Paramètres", icon: <SettingsIcon size={18} /> },
          ]}
          header={
            <Breadcrumbs
              items={[
                { id: "home", label: "Accueil" },
                { id: "portfolio", label: "Portefeuille" },
                { id: "overview", label: "Vue d'ensemble" },
              ]}
            />
          }
          footer={
            <UserMenu
              name="Michael Jach"
              items={[
                { id: "profile", label: "Profil", icon: <UserIcon size={16} /> },
                { id: "logout", label: "Déconnexion", icon: <LogoutIcon size={16} />, danger: true },
              ]}
            />
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="lqx-app-row lqx-app-row--three">
              <StatCard label="Valeur totale" value="42 380 €" delta={3.4} sparklineData={[10, 10.4, 10.1, 10.8, 11.2, 11.6, 12.1]} />
              <StatCard label="P&L du jour" value="− 214 €" delta={-1.2} />
              <StatCard label="Liquidités" value="4 210 €" />
            </div>
            <LineAreaChart
              height={190}
              area
              series={[{ id: "equity", label: "Portefeuille", data: EQUITY }]}
              formatY={(v) => `${(v / 1000).toFixed(0)} k€`}
              formatX={(x) => (x as Date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            />
            <div className="lqx-app-row lqx-app-row--two">
              <WatchlistWidget
                items={SAMPLE_HOLDINGS.slice(0, 4).map((h) => ({
                  id: h.id,
                  symbol: h.symbol,
                  name: h.name,
                  quantity: h.quantity,
                  price: h.price,
                  change: h.change,
                }))}
              />
              <MarketMoversWidget
                gainers={[
                  { id: "nvda", symbol: "NVDA", name: "NVIDIA Corp.", change: 4.1 },
                  { id: "amzn", symbol: "AMZN", name: "Amazon.com Inc.", change: 2.4 },
                ]}
                losers={[
                  { id: "tsla", symbol: "TSLA", name: "Tesla Inc.", change: -3.2 },
                  { id: "msft", symbol: "MSFT", name: "Microsoft Corp.", change: -0.6 },
                ]}
              />
            </div>
          </div>
        </SidebarLayout>
      </div>
    </BrowserWindow>
  );
}
