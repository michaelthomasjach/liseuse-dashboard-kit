import { useState, type ReactNode } from "react";
import { Button } from "../components/primitives/Button";
import { Toggle } from "../components/primitives/Toggle";
import { SegmentedControl } from "../components/primitives/SegmentedControl";
import { LevelGauge } from "../components/primitives/LevelGauge";
import { Badge } from "../components/finance/Badge";
import { PriceChangeTag } from "../components/finance/PriceChangeTag";
import { Tag } from "../components/forms/Tag";
import { ProgressBar } from "../components/feedback/ProgressBar";
import { Sparkline } from "../components/charts/Sparkline";
import { DonutChart } from "../components/charts/DonutChart";
import { GaugeChart } from "../components/charts/GaugeChart";
import { StarIcon } from "../components/icons";
import { SAMPLE_ALLOCATION } from "../test-data/financeSampleData";

const UP = [12, 12.4, 12.1, 12.8, 13.2, 13.0, 13.6, 14.1, 13.9, 14.5];
const DOWN = [14.5, 14.2, 14.4, 13.8, 13.5, 13.7, 13.1, 12.6, 12.8, 12.2];

/** One sampler cell: a live component with its name underneath, the name opening its own story.
 *
 *  Only the label is the button — never the whole cell. The samples are the real components and
 *  several of them are interactive (the toggles toggle, the segmented control switches, the Tag
 *  has its own remove button); wrapping those in an outer button would both nest interactive
 *  elements illegally and steal every click meant for the sample itself. */
function Cell({ label, onOpen, children }: { label: string; onOpen: () => void; children: ReactNode }) {
  return (
    <figure className="lqx-cell">
      <span className="lqx-cell__stage">{children}</span>
      <figcaption>
        <button type="button" className="lqx-cell__label" onClick={onOpen}>
          {label}
        </button>
      </figcaption>
    </figure>
  );
}

/** A dense sampler of the smaller primitives — the "what does the rest of it look like" answer,
 *  right after the three big set pieces. Everything here is the real component, live and
 *  interactive: the toggles toggle, the segmented control switches. */
export function CatalogStrip({ open }: { open: (path: string) => void }) {
  const [lightOn, setLightOn] = useState(true);
  const [nightOn, setNightOn] = useState(false);
  const [range, setRange] = useState<"1m" | "6m" | "1a">("6m");

  return (
    <div className="lqx-catalog">
      <Cell label="Button" onOpen={() => open("/docs/primitives-button--docs")}>
        <div className="lqx-cell__row">
          <Button selected icon={<StarIcon size={14} />}>
            Suivre
          </Button>
          <Button>Annuler</Button>
        </div>
      </Cell>

      <Cell label="Toggle" onOpen={() => open("/docs/primitives-toggle--docs")}>
        <div className="lqx-cell__row">
          <Toggle checked={lightOn} onChange={setLightOn} ariaLabel="Lumière du salon" />
          <Toggle checked={nightOn} onChange={setNightOn} ariaLabel="Mode nuit" />
        </div>
      </Cell>

      <Cell label="SegmentedControl" onOpen={() => open("/docs/primitives-segmentedcontrol--docs")}>
        <SegmentedControl
          options={[
            { value: "1m", label: "1 M" },
            { value: "6m", label: "6 M" },
            { value: "1a", label: "1 A" },
          ]}
          value={range}
          onChange={setRange}
        />
      </Cell>

      <Cell label="Badge" onOpen={() => open("/docs/finance-badge--docs")}>
        <div className="lqx-cell__row lqx-cell__row--wrap">
          <Badge tone="up">Achat</Badge>
          <Badge tone="down">Vente</Badge>
          <Badge tone="warning">Alerte</Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </Cell>

      <Cell label="PriceChangeTag" onOpen={() => open("/docs/finance-pricechangetag--docs")}>
        <div className="lqx-cell__row">
          <PriceChangeTag value={2.4} />
          <PriceChangeTag value={-1.8} />
        </div>
      </Cell>

      <Cell label="LevelGauge" onOpen={() => open("/docs/primitives-levelgauge--docs")}>
        <div className="lqx-cell__col">
          <LevelGauge value={76} />
          <LevelGauge value={28} />
        </div>
      </Cell>

      <Cell label="Sparkline" onOpen={() => open("/docs/charts-sparkline--docs")}>
        <div className="lqx-cell__col">
          <Sparkline data={UP} colorByTrend area width={132} height={30} />
          <Sparkline data={DOWN} colorByTrend area width={132} height={30} />
        </div>
      </Cell>

      <Cell label="DonutChart" onOpen={() => open("/docs/charts-donutchart--docs")}>
        {/* Legend off: it is five rows tall and would stretch this row of the grid past every
            other cell. The allocation reads well enough from the ring plus its centre label. */}
        <DonutChart data={SAMPLE_ALLOCATION} size={104} centerValue="48 %" centerCaption="Actions" showLegend={false} />
      </Cell>

      <Cell label="GaugeChart" onOpen={() => open("/docs/charts-gaugechart--docs")}>
        <GaugeChart value={68} size={116} label="RSI" />
      </Cell>

      <Cell label="Tag" onOpen={() => open("/docs/forms-tag--docs")}>
        <div className="lqx-cell__row lqx-cell__row--wrap">
          <Tag>NASDAQ</Tag>
          <Tag onRemove={() => {}}>Dividendes</Tag>
        </div>
      </Cell>

      <Cell label="ProgressBar" onOpen={() => open("/docs/feedback-progressbar--docs")}>
        <div className="lqx-cell__col lqx-cell__col--wide">
          <ProgressBar label="Momentum" value={90} labelPosition="left" showValue />
          <ProgressBar label="Volume" value={52} labelPosition="left" showValue />
        </div>
      </Cell>

      <Cell label="Sparkline en tableau" onOpen={() => open("/docs/charts-sparkline--docs")}>
        <div className="lqx-cell__col lqx-cell__col--wide">
          <div className="lqx-cell__quote">
            <span>AAPL</span>
            <Sparkline data={UP} colorByTrend width={72} height={20} />
            <PriceChangeTag value={1.8} />
          </div>
          <div className="lqx-cell__quote">
            <span>TSLA</span>
            <Sparkline data={DOWN} colorByTrend width={72} height={20} />
            <PriceChangeTag value={-3.2} />
          </div>
        </div>
      </Cell>
    </div>
  );
}
