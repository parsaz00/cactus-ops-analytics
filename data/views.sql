-- Daily Location Summary (governed metrics)
CREATE OR REPLACE VIEW vw_location_daily_summary AS
SELECT
  s.date_key,
  s.location_id,
  SUM(s.gross_sales)                  AS gross_sales,
  SUM(s.discount_amt)                 AS discounts,
  SUM(s.net_sales)                    AS net_sales,
  SUM(s.covers)                       AS covers,
  CASE WHEN SUM(s.covers) = 0 THEN 0
       ELSE ROUND(SUM(s.net_sales) / SUM(s.covers), 2)
  END                                 AS avg_check
FROM fact_sales s
GROUP BY s.date_key, s.location_id;

-- Daily Labor Summary
CREATE OR REPLACE VIEW vw_labor_daily_summary AS
SELECT
  l.date_key,
  l.location_id,
  SUM(l.labor_hours)                  AS labor_hours,
  SUM(l.labor_cost)                   AS labor_cost
FROM fact_labor l
GROUP BY l.date_key, l.location_id;

-- Combined Daily Performance (this is the core “BI semantic layer” output)
CREATE OR REPLACE VIEW vw_daily_performance AS
SELECT
  d.date_key,
  d.location_id,
  d.net_sales,
  d.gross_sales,
  d.discounts,
  d.covers,
  d.avg_check,
  COALESCE(l.labor_hours, 0)          AS labor_hours,
  COALESCE(l.labor_cost, 0)           AS labor_cost,
  CASE WHEN d.net_sales = 0 THEN 0
       ELSE ROUND(COALESCE(l.labor_cost,0) / d.net_sales, 4)
  END                                 AS labor_pct,
  CASE WHEN COALESCE(l.labor_hours,0) = 0 THEN 0
       ELSE ROUND(d.net_sales / COALESCE(l.labor_hours,0), 2)
  END                                 AS sales_per_labor_hour
FROM vw_location_daily_summary d
LEFT JOIN vw_labor_daily_summary l
  ON l.date_key = d.date_key AND l.location_id = d.location_id;