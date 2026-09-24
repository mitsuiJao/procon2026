import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "myuser",
  password: process.env.PGPASSWORD ?? "pass",
  database: process.env.PGDATABASE ?? "mydb",
});

pool.on("error", (err) => {
  console.error("[DB] 予期しないエラー:", err.message);
});



