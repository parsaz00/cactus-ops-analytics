# !/usr/bin/env python3
import csv
import os
import random
import subprocess
from datetime import date, timedelta

# CONFIG
CONTAINER = "cactus_ops_db"
DB_USER = "cactus"
DB_NAME = "cactus_ops"

OUT_DIR = os.path.join("data", "seed", "out")
DAYS_BACK = 180 #~6 months 
NUM_LOCATIONS = 12
NUM_ITEMS = 30

random.seed(42)

# HELPERS

def run_psql(cmd_args, stdin_file=None):
    """
    Runs: docker exec ... psql ...
    cmd_args is a list of psql args AFTER: psql -U <user> -d <db>
    """
    
    base = ["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME]
    full = base + cmd_args
    
    if stdin_file:
        with open(stdin_file, "rb") as f:
            subprocess.run(full, stdin=f, check=True)
    else:
        subprocess.run(full, check=True)

def ensure_out_dir():
    os.makedirs(OUT_DIR, exist_ok=True)

def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)

def day_of_week_1_mon(d: date) -> int:
    return d.weekday() + 1

def week_of_year(d: date) -> int:
    #ISO week num
    return int(d.isocalendar().week)

# Data generation

def gen_dim_date():
    end = date.today()
    start = end - timedelta(days=DAYS_BACK - 1)

    rows = []
    for d in daterange(start, end):
        rows.append({
            "date_key": d.isoformat(),
            "year": d.year,
            "month": d.month,
            "day": d.day,
            "day_of_week": day_of_week_1_mon(d),
            "week_of_year": week_of_year(d),
        })
    return rows

def gen_dim_location():
    # 3 regions, 12 locations
    regions = ["Lower Mainland", "Vancouver Island", "Alberta"]
    cities = {
        "Lower Mainland": ["Vancouver", "Burnaby", "Richmond", "Surrey", "West Van"],
        "Vancouver Island": ["Victoria", "Nanaimo", "Langford"],
        "Alberta": ["Calgary", "Edmonton"],
    }

    rows = []
    for i in range(1, NUM_LOCATIONS + 1):
        region = random.choice(regions)
        city = random.choice(cities[region])
        rows.append({
            "location_id": i,
            "location_name": f"Cactus Location {i}",
            "region": region,
            "city": city,
            "open_date": (date(2015, 1, 1) + timedelta(days=random.randint(0, 3000))).isoformat(),
        })
    return rows

def gen_dim_item():
    categories = ["Mains", "Starters", "Desserts", "Cocktails", "Wine", "Beer", "Non-Alc"]
    rows = []
    for i in range(1, NUM_ITEMS + 1):
        cat = random.choice(categories)

        # Rough price ranges by category
        if cat == "Mains":
            price = round(random.uniform(22, 40), 2)
            cost = round(price * random.uniform(0.28, 0.40), 2)
        elif cat == "Starters":
            price = round(random.uniform(14, 22), 2)
            cost = round(price * random.uniform(0.25, 0.38), 2)
        elif cat == "Desserts":
            price = round(random.uniform(10, 16), 2)
            cost = round(price * random.uniform(0.20, 0.35), 2)
        elif cat == "Cocktails":
            price = round(random.uniform(14, 20), 2)
            cost = round(price * random.uniform(0.18, 0.30), 2)
        elif cat == "Wine":
            price = round(random.uniform(12, 18), 2)
            cost = round(price * random.uniform(0.35, 0.55), 2)
        elif cat == "Beer":
            price = round(random.uniform(8, 11), 2)
            cost = round(price * random.uniform(0.30, 0.45), 2)
        else:  # Non-Alc
            price = round(random.uniform(4, 8), 2)
            cost = round(price * random.uniform(0.15, 0.30), 2)

        rows.append({
            "item_id": i,
            "item_name": f"Item {i}",
            "category": cat,
            "price": f"{price:.2f}",
            "food_cost": f"{cost:.2f}",
        })
    return rows

def gen_fact_sales(dim_dates, dim_locations, dim_items):
    """
    Generate one row per (date, location, item).
    This produces: DAYS_BACK * NUM_LOCATIONS * NUM_ITEMS rows (~65k for 180*12*30).
    """
    # Location "strength" multipliers to create realistic variance
    loc_strength = {loc["location_id"]: random.uniform(0.85, 1.20) for loc in dim_locations}

    # Item popularity weights (skewed)
    item_weight = {}
    for it in dim_items:
        cat = it["category"]
        base = {
            "Mains": 1.8,
            "Starters": 1.2,
            "Desserts": 0.6,
            "Cocktails": 1.4,
            "Wine": 0.9,
            "Beer": 0.8,
            "Non-Alc": 0.7
        }[cat]
        item_weight[it["item_id"]] = base * random.uniform(0.6, 1.6)

    # Normalize weights
    total_w = sum(item_weight.values())
    for k in item_weight:
        item_weight[k] /= total_w

    rows = []
    for d in dim_dates:
        dkey = d["date_key"]
        dow = d["day_of_week"]  # 1..7
        weekend_boost = 1.18 if dow in (5, 6, 7) else 1.0  # Fri/Sat/Sun
        for loc in dim_locations:
            loc_id = loc["location_id"]
            strength = loc_strength[loc_id] * weekend_boost

            # approximate "daily covers" for a location (varies by strength and randomness)
            base_covers = random.randint(180, 320)
            daily_covers = int(base_covers * strength)

            # distribute that "demand" across items using weights
            for it in dim_items:
                item_id = it["item_id"]
                price = float(it["price"])

                # expected item orders = covers * item_weight * category tweaks + noise
                expected_orders = daily_covers * item_weight[item_id] * NUM_ITEMS * 0.045
                orders = max(0, int(random.gauss(expected_orders, expected_orders * 0.35)))

                if orders == 0:
                    covers = 0
                    gross = 0.0
                else:
                    # covers proxy: not perfect; some items are shared.
                    covers = max(0, int(orders * random.uniform(0.35, 0.95)))
                    gross = orders * price

                # discounts higher on slower days
                discount_rate = random.uniform(0.00, 0.06) if dow in (1, 2, 3) else random.uniform(0.00, 0.03)
                discount_amt = round(gross * discount_rate, 2)

                rows.append({
                    "date_key": dkey,
                    "location_id": loc_id,
                    "item_id": item_id,
                    "covers": covers,
                    "gross_sales": f"{gross:.2f}",
                    "discount_amt": f"{discount_amt:.2f}",
                })
    return rows

def gen_fact_labor(dim_dates, dim_locations):
    """
    Generate one row per (date, location).
    Labor cost roughly tracks sales volume, but with noise.
    """
    rows = []
    for d in dim_dates:
        dkey = d["date_key"]
        dow = d["day_of_week"]
        weekend = dow in (5, 6, 7)

        for loc in dim_locations:
            loc_id = loc["location_id"]

            # baseline staffing hours
            base_hours = random.uniform(90, 140) if weekend else random.uniform(70, 120)

            # hourly cost blended (wage + benefits/overhead rough proxy)
            blended_rate = random.uniform(20.0, 27.0)

            labor_hours = round(max(0.0, random.gauss(base_hours, base_hours * 0.08)), 2)
            labor_cost = round(labor_hours * blended_rate, 2)

            rows.append({
                "date_key": dkey,
                "location_id": loc_id,
                "labor_hours": f"{labor_hours:.2f}",
                "labor_cost": f"{labor_cost:.2f}",
            })
    return rows


# CSV writing
def write_csv(path, fieldnames, rows):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
        
        
#load the process

def truncate_all():
    # Truncate all related tables in a single statement to satisfy FK constraints
    sql = """
    TRUNCATE TABLE
      fact_sales,
      fact_labor,
      dim_item,
      dim_location,
      dim_date
    RESTART IDENTITY;
    """
    run_psql(["-c", sql])

def copy_into(table, columns, csv_file):
    cols = ", ".join(columns)
    copy_cmd = f"\\copy {table} ({cols}) FROM STDIN WITH (FORMAT csv, HEADER true)"
    run_psql(["-c", copy_cmd], stdin_file=csv_file)

def main():
    ensure_out_dir()

    dim_dates = gen_dim_date()
    dim_locations = gen_dim_location()
    dim_items = gen_dim_item()

    sales_rows = gen_fact_sales(dim_dates, dim_locations, dim_items)
    labor_rows = gen_fact_labor(dim_dates, dim_locations)

    # Write CSVs
    date_csv = os.path.join(OUT_DIR, "dim_date.csv")
    loc_csv = os.path.join(OUT_DIR, "dim_location.csv")
    item_csv = os.path.join(OUT_DIR, "dim_item.csv")
    sales_csv = os.path.join(OUT_DIR, "fact_sales.csv")
    labor_csv = os.path.join(OUT_DIR, "fact_labor.csv")

    write_csv(date_csv, ["date_key","year","month","day","day_of_week","week_of_year"], dim_dates)
    write_csv(loc_csv, ["location_id","location_name","region","city","open_date"], dim_locations)
    write_csv(item_csv, ["item_id","item_name","category","price","food_cost"], dim_items)
    write_csv(sales_csv, ["date_key","location_id","item_id","covers","gross_sales","discount_amt"], sales_rows)
    write_csv(labor_csv, ["date_key","location_id","labor_hours","labor_cost"], labor_rows)

    # Load into DB
    print("Truncating existing data...")
    truncate_all()

    print("Loading dim tables...")
    copy_into("dim_date", ["date_key","year","month","day","day_of_week","week_of_year"], date_csv)
    copy_into("dim_location", ["location_id","location_name","region","city","open_date"], loc_csv)
    copy_into("dim_item", ["item_id","item_name","category","price","food_cost"], item_csv)

    print("Loading fact tables...")
    copy_into("fact_sales", ["date_key","location_id","item_id","covers","gross_sales","discount_amt"], sales_csv)
    copy_into("fact_labor", ["date_key","location_id","labor_hours","labor_cost"], labor_csv)

    print("Done. Quick row counts:")
    run_psql(["-c", "SELECT 'dim_date' t, COUNT(*) c FROM dim_date UNION ALL SELECT 'dim_location', COUNT(*) FROM dim_location UNION ALL SELECT 'dim_item', COUNT(*) FROM dim_item UNION ALL SELECT 'fact_sales', COUNT(*) FROM fact_sales UNION ALL SELECT 'fact_labor', COUNT(*) FROM fact_labor;"])

    print("\nSample from vw_daily_performance:")
    run_psql(["-c", "SELECT * FROM vw_daily_performance ORDER BY date_key DESC, location_id LIMIT 10;"])

if __name__ == "__main__":
    main()