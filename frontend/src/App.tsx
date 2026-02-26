import { useEffect, useMemo, useState } from "react";
import { fetchWeeklyPerformance, type WeeklyRow } from "./api.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./App.css";

function toNum(x: string) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

function formatPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

export default function App() {
  // Applied filters (drive the API)
  const [year, setYear] = useState(2026);
  const [week, setWeek] = useState(9);
  const [region, setRegion] = useState<string>("");

  // Draft filters (user edits these without triggering refresh)
  const [yearInput, setYearInput] = useState<string>(String(year));
  const [weekInput, setWeekInput] = useState<string>(String(week));
  const [regionInput, setRegionInput] = useState<string>("");

  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  function applyFilters() {
    const y = yearInput.trim();
    const w = weekInput.trim();
    // If empty, don't change applied filters (no weird 0s)
    if (y !== "") {
      const yNum = Number(y);
      if (Number.isFinite(yNum) && yNum >= 2000 && yNum <= 2100) setYear(yNum);
    }

    if (w !== "") {
      const wNum = Number(w);
      if (Number.isFinite(wNum) && wNum >= 1 && wNum <= 53) setWeek(wNum);
    }

    setRegion(regionInput.trim());
  }

  function resetFilters() {
    setYear(2026);
    setWeek(9);
    setRegion("");

    setYearInput("2026");
    setWeekInput("9");
    setRegionInput("");
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");

    fetchWeeklyPerformance({ year, week, region: region || undefined })
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, week, region]);

  const regionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.region));
    return Array.from(set).sort();
  }, [rows]);

  const totals = useMemo(() => {
    const netSales = rows.reduce((a, r) => a + toNum(r.net_sales), 0);
    const covers = rows.reduce((a, r) => a + toNum(r.covers), 0);
    const labourCost = rows.reduce((a, r) => a + toNum(r.labour_cost), 0);
    const labourHours = rows.reduce((a, r) => a + toNum(r.labour_hours), 0);

    const avgCheck = covers === 0 ? 0 : netSales / covers;
    const labourPct = netSales === 0 ? 0 : labourCost / netSales;
    const salesPerLH = labourHours === 0 ? 0 : netSales / labourHours;

    return { netSales, covers, avgCheck, labourPct, salesPerLH };
  }, [rows]);

    const topNetSales = useMemo(() => {
    return [...rows]
      .map((r) => ({
      location_id: r.location_id,
      location_name: r.location_name,
      short_label: `Loc ${r.location_id}`,
      net_sales_num: toNum(r.net_sales),
    }))
      .sort((a, b) => b.net_sales_num - a.net_sales_num)
      .slice(0, 10);
  }, [rows]);

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>Regional Performance Dashboard</h1>
      <div style={{ color: "#555", marginBottom: 18 }}>
        Prototype: Postgres (dims/facts + governed views) → Node API → React.
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}
      >
        <label>
          Year{" "}
          <input
            type="number"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            style={{ width: 90, padding: 6, marginLeft: 6 }}
            />
        </label>

        <label>
          Week{" "}
          <input
            type="number"
            value={weekInput}
            onChange={(e) => setWeekInput(e.target.value)}
            style={{ width: 90, padding: 6, marginLeft: 6 }}
            />
        </label>

        <label>
          Region{" "}
          <select
            value={regionInput}
            onChange={(e) => setRegionInput(e.target.value)}
            style={{ width: 220, padding: 6, marginLeft: 6 }}
          >
            <option value="">All</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #777",
            background: "#222",
            color: "white",
            cursor: "pointer",
          }}
        >
          Apply
        </button>

        <button
          type="button"
          onClick={resetFilters}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #777",
            background: "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          Reset
        </button>

        <div style={{ color: "#777", fontSize: 12, alignSelf: "center" }}>
          Tip: try “Alberta” or “Lower Mainland” (Press Enter to apply)
        </div>
      </form>

      {/* Applied filter indicator */}
      <div style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        Applied: Year {year}, Week {week}, Region {region || "All"}
      </div>

      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 18 }}>
        <KPI title="Net Sales" value={formatMoney(totals.netSales)} />
        <KPI title="Labour %" value={formatPct(totals.labourPct)} />
        <KPI title="Avg Check" value={totals.avgCheck.toFixed(2)} />
        <KPI title="Sales / Labour Hr" value={totals.salesPerLH.toFixed(2)} />
        <KPI title="Locations" value={String(rows.length)} />
      </div>

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
          background: "#111827",
        }}
      >
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Top 10 Locations — Net Sales
      </div>
      
      <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={topNetSales}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
      >
              <CartesianGrid stroke="#333" strokeDasharray="3 3" />
              <XAxis
                dataKey="short_label"
                tick={{ fontSize: 12, fill: "#aaa" }}
                interval={0}
                angle={0}
                height={30}
              />
              <YAxis
                tickFormatter={(v) => formatMoney(Number(v))}
                tick={{ fill: "#aaa", fontSize: 12 }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  background: "#1f2937",
                  border: "1px solid #444",
                  borderRadius: 8,
                  color: "white",
                }}
                labelStyle={{ color: "#aaa" }}
                formatter={(v: any) => formatMoney(Number(v))}
                formatter={(value, name, props) => [
                  formatMoney(Number(value)),
                  "Net Sales",
                  ]}
              />
                <Bar
                dataKey="net_sales_num"
                fill="#4ade80"       // modern green
                radius={[6, 6, 0, 0]} // rounded top corners
                />            
                </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ border: "1px solid #e6e6e6", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", borderBottom: "1px solid #e6e6e6", fontWeight: 600 }}>
          Locations (sorted by Net Sales)
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <Th>Location</Th>
              <Th>Region</Th>
              <Th>City</Th>
              <Th>Net Sales</Th>
              <Th>Labour %</Th>
              <Th>Avg Check</Th>
              <Th>Sales/LH</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.location_id} style={{ borderTop: "1px solid #eee" }}>
                <Td>{r.location_name}</Td>
                <Td>{r.region}</Td>
                <Td>{r.city}</Td>
                <Td>{formatMoney(toNum(r.net_sales))}</Td>
                <Td>{formatPct(toNum(r.labour_pct))}</Td>
                <Td>{toNum(r.avg_check).toFixed(2)}</Td>
                <Td>{toNum(r.sales_per_labour_hour).toFixed(2)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return <th style={{ padding: 10, fontSize: 12, color: "#666" }}>{children}</th>;
}

function Td({ children }: { children: any }) {
  return <td style={{ padding: 10 }}>{children}</td>;
}