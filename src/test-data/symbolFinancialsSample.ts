import type { SymbolFinancials } from "../components/charts/workspace/SymbolFinancials.interface";

/** One company's financial detail, as `SymbolProfile.financials` expects it — the fixture behind
 *  the tabs in the symbol-details modal, its detached window and the mobile sheet.
 *
 *  Lives here rather than inside one stories file because it is needed by two of them, and it
 *  being local to `ChartWorkspace.stories.tsx` is exactly why the tabs looked unimplemented: the
 *  workspace story showed them for AAPL, and `CandlestickChart.stories.tsx` — the one with the
 *  full-featured demo everybody actually opens — had its own profiles with no financials at all,
 *  so every symbol there opened a details modal with nothing in it.
 *
 *  Fictional figures, shaped like real reported ones. */

export const AAPL_FINANCIALS: SymbolFinancials = {
  overview: {
    keyFacts: [
      { label: "Capitalisation boursière", value: "3 100", unit: "Md USD" },
      { label: "Rendement du dividende", value: "0,44", unit: "%" },
      { label: "PER (TTM)", value: "34,2" },
      { label: "BPA de base (TTM)", value: "6,75", unit: "USD" },
      { label: "Fondée en", value: "1976" },
      { label: "Effectif", value: "161 000" },
      { label: "Direction", value: "Tim Cook" },
      { label: "Site", value: "apple.com", href: "https://www.apple.com" },
    ],
    about:
      "Apple Inc. conçoit, fabrique et commercialise des smartphones, ordinateurs personnels, tablettes, montres connectées et accessoires, et propose une large gamme de services associés. L'entreprise vend ses produits dans le monde entier via ses propres magasins, son site en ligne et un réseau de revendeurs, opérateurs et distributeurs tiers.",
    ownership: {
      title: "Actionnariat",
      shares: [
        { label: "Flottant", value: 14_820, display: "14,82 Md (98,1 %)", color: "#e0a95c" },
        { label: "Détenu en interne", value: 287, display: "287 M (1,9 %)", color: "#6c87c9" },
      ],
    },
    capitalStructure: {
      title: "Structure du capital",
      shares: [
        { label: "Capitalisation", value: 3100, display: "3 100 Md", color: "#4fae8f" },
        { label: "Dette", value: 105, display: "105 Md", color: "#e0a95c" },
        { label: "Trésorerie", value: 62, display: "62 Md", color: "#c96f8f" },
      ],
    },
  },
  statements: [
    {
      id: "income",
      title: "Compte de résultat",
      showGrowth: true,
      periods: [2021, 2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y), sublabel: `Sep ${y}` })),
      rows: [
        {
          key: "revenue",
          label: "Chiffre d'affaires",
          emphasis: true,
          values: { 2021: 365_817, 2022: 394_328, 2023: 383_285, 2024: 391_035, 2025: 416_200 },
          display: { 2021: "365,82 Md", 2022: "394,33 Md", 2023: "383,29 Md", 2024: "391,04 Md", 2025: "416,20 Md" },
          children: [
            {
              key: "products",
              label: "Produits",
              values: { 2021: 297_392, 2022: 316_199, 2023: 298_085, 2024: 294_866, 2025: 305_400 },
              display: { 2021: "297,39 Md", 2022: "316,20 Md", 2023: "298,09 Md", 2024: "294,87 Md", 2025: "305,40 Md" },
            },
            {
              key: "services",
              label: "Services",
              values: { 2021: 68_425, 2022: 78_129, 2023: 85_200, 2024: 96_169, 2025: 110_800 },
              display: { 2021: "68,43 Md", 2022: "78,13 Md", 2023: "85,20 Md", 2024: "96,17 Md", 2025: "110,80 Md" },
            },
          ],
        },
        {
          key: "gross",
          label: "Marge brute",
          emphasis: true,
          values: { 2021: 152_836, 2022: 170_782, 2023: 169_148, 2024: 180_683, 2025: 197_900 },
          display: { 2021: "152,84 Md", 2022: "170,78 Md", 2023: "169,15 Md", 2024: "180,68 Md", 2025: "197,90 Md" },
        },
        {
          key: "net",
          label: "Résultat net",
          emphasis: true,
          values: { 2021: 94_680, 2022: 99_803, 2023: 96_995, 2024: 93_736, 2025: 102_400 },
          display: { 2021: "94,68 Md", 2022: "99,80 Md", 2023: "96,99 Md", 2024: "93,74 Md", 2025: "102,40 Md" },
        },
      ],
    },
    {
      id: "cash",
      title: "Flux de trésorerie",
      showGrowth: true,
      periods: [2021, 2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y), sublabel: `Sep ${y}` })),
      rows: [
        {
          key: "op",
          label: "Flux d'exploitation",
          emphasis: true,
          values: { 2021: 104_038, 2022: 122_151, 2023: 110_543, 2024: 118_254, 2025: 126_900 },
          display: { 2021: "104,04 Md", 2022: "122,15 Md", 2023: "110,54 Md", 2024: "118,25 Md", 2025: "126,90 Md" },
          children: [
            {
              key: "capex",
              label: "Investissements",
              values: { 2021: -11_085, 2022: -10_708, 2023: -10_959, 2024: -9_447, 2025: -11_200 },
              display: { 2021: "−11,09 Md", 2022: "−10,71 Md", 2023: "−10,96 Md", 2024: "−9,45 Md", 2025: "−11,20 Md" },
            },
          ],
        },
        {
          key: "fcf",
          label: "Free cash flow",
          emphasis: true,
          values: { 2021: 92_953, 2022: 111_443, 2023: 99_584, 2024: 108_807, 2025: 115_700 },
          display: { 2021: "92,95 Md", 2022: "111,44 Md", 2023: "99,58 Md", 2024: "108,81 Md", 2025: "115,70 Md" },
        },
      ],
    },
  ],
  statistics: [
    {
      id: "valuation",
      title: "Valorisation",
      periods: [...[2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })), { key: "current", label: "Actuel" }],
      rows: [
        { key: "pe", label: "PER", display: { 2022: "24,4", 2023: "29,8", 2024: "33,1", 2025: "34,2", current: "34,2" } },
        { key: "ps", label: "Prix / ventes", display: { 2022: "6,2", 2023: "7,4", 2024: "8,1", 2025: "7,4", current: "7,5" } },
        { key: "pb", label: "Prix / actif net", display: { 2022: "43,1", 2023: "48,9", 2024: "51,2", 2025: "49,7", current: "50,1" } },
      ],
    },
    {
      id: "margins",
      title: "Marges",
      periods: [...[2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })), { key: "current", label: "Actuel" }],
      rows: [
        { key: "gm", label: "Marge brute %", display: { 2022: "43,3", 2023: "44,1", 2024: "46,2", 2025: "47,5", current: "47,5" } },
        { key: "nm", label: "Marge nette %", display: { 2022: "25,3", 2023: "25,3", 2024: "24,0", 2025: "24,6", current: "24,6" } },
      ],
    },
  ],
  dividends: {
    facts: [
      { label: "Rendement (indiqué)", value: "0,44", unit: "%" },
      { label: "Dernier versement", value: "0,25", unit: "USD" },
    ],
    tables: [
      {
        id: "dividends",
        title: "Historique",
        periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
        rows: [{ key: "dps", label: "Dividende par action", display: { 2022: "0,90", 2023: "0,94", 2024: "0,98", 2025: "1,02" } }],
      },
    ],
  },
  earnings: {
    facts: [
      { label: "Prochaine publication", value: "≈ 30 janv. 2026" },
      { label: "Période", value: "T1 2026" },
      { label: "BPA estimé", value: "2,35", unit: "USD" },
      { label: "CA estimé", value: "124,3", unit: "Md USD" },
    ],
    tables: [
      {
        id: "eps",
        title: "BPA",
        periods: [2022, 2023, 2024, 2025, 2026].map((y) => ({ key: String(y), label: String(y) })),
        rows: [
          { key: "reported", label: "Publié", emphasis: true, display: { 2022: "6,11", 2023: "6,13", 2024: "6,08", 2025: "6,75" } },
          { key: "estimate", label: "Estimé", display: { 2022: "5,98", 2023: "6,05", 2024: "6,12", 2025: "6,60", 2026: "7,40" } },
          {
            key: "surprise",
            label: "Surprise",
            display: { 2022: "+2,17 %", 2023: "+1,32 %", 2024: "−0,65 %", 2025: "+2,27 %" },
          },
        ],
      },
    ],
  },
  segments: [
    {
      id: "by-source",
      title: "Par activité",
      periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
      rows: [
        { key: "iphone", label: "iPhone", accent: "#2f7fe0", display: { 2022: "205,49 Md", 2023: "200,58 Md", 2024: "201,18 Md", 2025: "209,40 Md" } },
        { key: "services", label: "Services", accent: "#38bdd0", display: { 2022: "78,13 Md", 2023: "85,20 Md", 2024: "96,17 Md", 2025: "110,80 Md" } },
        { key: "mac", label: "Mac", accent: "#e8853a", display: { 2022: "40,18 Md", 2023: "29,36 Md", 2024: "29,98 Md", 2025: "32,10 Md" } },
        { key: "wearables", label: "Accessoires", accent: "#9b6cd0", display: { 2022: "41,24 Md", 2023: "39,84 Md", 2024: "37,01 Md", 2025: "38,60 Md" } },
      ],
    },
    {
      id: "by-country",
      title: "Par région",
      periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
      rows: [
        { key: "americas", label: "Amériques", accent: "#2f7fe0", display: { 2022: "169,66 Md", 2023: "162,56 Md", 2024: "167,05 Md", 2025: "178,90 Md" } },
        { key: "europe", label: "Europe", accent: "#38bdd0", display: { 2022: "95,12 Md", 2023: "94,29 Md", 2024: "101,33 Md", 2025: "109,20 Md" } },
        { key: "china", label: "Chine", accent: "#e8853a", display: { 2022: "74,20 Md", 2023: "72,56 Md", 2024: "66,95 Md", 2025: "68,40 Md" } },
      ],
    },
  ],
};
