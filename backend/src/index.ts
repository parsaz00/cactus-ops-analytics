import express from "express";
import cors from "cors";
import { pool } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * Weekly performance
 * Filters supported:
 * - year (number) optional
 * - week (number) optional
 * - region (string) optional
 * - location_id (number) optional
 */
app.get("/api/weekly-performance", async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : null;
    const week = req.query.week ? Number(req.query.week) : null;
    const region = req.query.region ? String(req.query.region) : null;
    const locationId = req.query.location_id ? Number(req.query.location_id) : null;

    const where: string[] = [];
    const params: any[] = [];

    const pushCond = (sql: string, val: any) => {
      params.push(val);
      where.push(sql.replace("?", `$${params.length}`));
    };

    if (year !== null && !Number.isNaN(year)) pushCond("year = ?", year);
    if (week !== null && !Number.isNaN(week)) pushCond("week_of_year = ?", week);
    if (region) pushCond("region = ?", region);
    if (locationId !== null && !Number.isNaN(locationId)) pushCond("location_id = ?", locationId);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        year, week_of_year, location_id, location_name, region, city,
        net_sales, covers, avg_check, labor_hours, labor_cost, labor_pct, sales_per_labor_hour
      FROM vw_location_weekly_performance
      ${whereSql}
      ORDER BY year DESC, week_of_year DESC, net_sales DESC
      LIMIT 500;
    `;

    const result = await pool.query(sql, params);
    res.json({ rows: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "unknown error" });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});