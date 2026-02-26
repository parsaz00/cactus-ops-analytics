-- Dimensions
CREATE TABLE IF NOT EXISTS dim_date (
  date_key        DATE PRIMARY KEY,
  year            INT NOT NULL,
  month           INT NOT NULL,
  day             INT NOT NULL,
  day_of_week     INT NOT NULL, -- 1=Mon ... 7=Sun
  week_of_year    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_location (
  location_id     INT PRIMARY KEY,
  location_name   TEXT NOT NULL,
  region          TEXT NOT NULL,
  city            TEXT NOT NULL,
  open_date       DATE
);

CREATE TABLE IF NOT EXISTS dim_item (
  item_id         INT PRIMARY KEY,
  item_name       TEXT NOT NULL,
  category        TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  food_cost       NUMERIC(10,2) NOT NULL
);

-- Facts
CREATE TABLE IF NOT EXISTS fact_sales (
  sale_id         BIGSERIAL PRIMARY KEY,
  date_key        DATE NOT NULL REFERENCES dim_date(date_key),
  location_id     INT NOT NULL REFERENCES dim_location(location_id),
  item_id         INT NOT NULL REFERENCES dim_item(item_id),
  covers          INT NOT NULL CHECK (covers >= 0),
  gross_sales     NUMERIC(12,2) NOT NULL,
  discount_amt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_sales       NUMERIC(12,2) GENERATED ALWAYS AS (gross_sales - discount_amt) STORED
);

CREATE TABLE IF NOT EXISTS fact_labor (
  labor_id        BIGSERIAL PRIMARY KEY,
  date_key        DATE NOT NULL REFERENCES dim_date(date_key),
  location_id     INT NOT NULL REFERENCES dim_location(location_id),
  labor_hours     NUMERIC(10,2) NOT NULL CHECK (labor_hours >= 0),
  labor_cost      NUMERIC(12,2) NOT NULL CHECK (labor_cost >= 0)
);

-- Helpful indexes 
CREATE INDEX IF NOT EXISTS idx_sales_date_loc ON fact_sales(date_key, location_id);
CREATE INDEX IF NOT EXISTS idx_sales_item ON fact_sales(item_id);
CREATE INDEX IF NOT EXISTS idx_labor_date_loc ON fact_labor(date_key, location_id);