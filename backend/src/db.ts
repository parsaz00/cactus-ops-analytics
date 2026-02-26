import { Pool } from "pg";

export const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "cactus",
  password: "cactus_pw",
  database: "cactus_ops",
});