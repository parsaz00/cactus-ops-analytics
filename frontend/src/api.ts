console.log("api.ts loaded");

type WeeklyRowApi = {
  year: number;
  week_of_year: number;
  location_id: number;
  location_name: string;
  region: string;
  city: string;
  net_sales: string;
  covers: string;
  avg_check: string;
  labor_hours: string;
  labor_cost: string;
  labor_pct: string;
  sales_per_labor_hour: string;
};

// Canadian spelling helper function 
export type WeeklyRow = Omit<
  WeeklyRowApi,
  "labor_hours" | "labor_cost" | "labor_pct" | "sales_per_labor_hour"
> & {
  labour_hours: string;
  labour_cost: string;
  labour_pct: string;
  sales_per_labour_hour: string;
};

const API_BASE = "http://localhost:4000";

export async function fetchWeeklyPerformance(params: {
  year?: number;
  week?: number;
  region?: string;
}) {
  const qs = new URLSearchParams();
  if (params.year) qs.set("year", String(params.year));
  if (params.week) qs.set("week", String(params.week));
  if (params.region) qs.set("region", params.region);

  const res = await fetch(`${API_BASE}/api/weekly-performance?${qs.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  const rows = json.rows as WeeklyRowApi[];

  // Map API fields to UI fields
  return rows.map((r) => ({
    ...r,
    labour_hours: r.labor_hours,
    labour_cost: r.labor_cost,
    labour_pct: r.labor_pct,
    sales_per_labour_hour: r.sales_per_labor_hour,
  })) as WeeklyRow[];
}