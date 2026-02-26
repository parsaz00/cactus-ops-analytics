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

-- Enriched daily performance (adds region/city/location_name)
CREATE OR REPLACE VIEW vw_daily_performance_enriched AS
SELECT
  p.date_key,
  p.location_id,
  loc.location_name,
  loc.region,
  loc.city,
  p.net_sales,
  p.gross_sales,
  p.discounts,
  p.covers,
  p.avg_check,
  p.labor_hours,
  p.labor_cost,
  p.labor_pct,
  p.sales_per_labor_hour
FROM vw_daily_performance p
JOIN dim_location loc
  ON loc.location_id = p.location_id;


-- Weekly rollup by location (regional-manager friendly)
CREATE OR REPLACE VIEW vw_location_weekly_performance AS
SELECT
  d.year,
  d.week_of_year,
  p.location_id,
  loc.location_name,
  loc.region,
  loc.city,
  SUM(p.net_sales) AS net_sales,
  SUM(p.covers) AS covers,
  CASE WHEN SUM(p.covers) = 0 THEN 0
       ELSE ROUND(SUM(p.net_sales) / SUM(p.covers), 2)
  END AS avg_check,
  SUM(p.labor_hours) AS labor_hours,
  SUM(p.labor_cost) AS labor_cost,
  CASE WHEN SUM(p.net_sales) = 0 THEN 0
       ELSE ROUND(SUM(p.labor_cost) / SUM(p.net_sales), 4)
  END AS labor_pct,
  CASE WHEN SUM(p.labor_hours) = 0 THEN 0
       ELSE ROUND(SUM(p.net_sales) / SUM(p.labor_hours), 2)
  END AS sales_per_labor_hour
FROM vw_daily_performance p
JOIN dim_date d
  ON d.date_key = p.date_key
JOIN dim_location loc
  ON loc.location_id = p.location_id
GROUP BY d.year, d.week_of_year, p.location_id, loc.location_name, loc.region, loc.city;


-- Menu category performance by day and location
CREATE OR REPLACE VIEW vw_menu_category_daily AS
SELECT
  s.date_key,
  s.location_id,
  loc.location_name,
  loc.region,
  i.category,
  SUM(s.net_sales) AS net_sales,
  SUM(s.gross_sales) AS gross_sales,
  SUM(s.covers) AS covers
FROM fact_sales s
JOIN dim_item i
  ON i.item_id = s.item_id
JOIN dim_location loc
  ON loc.location_id = s.location_id
GROUP BY s.date_key, s.location_id, loc.location_name, loc.region, i.category;