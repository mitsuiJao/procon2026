// src/db.ts
import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "myuser",
  password: process.env.PGPASSWORD ?? "pass",
  database: process.env.PGDATABASE ?? "mydb",
});

pool.on("error", (err) => {
  console.error("[DB] 予期しないエラー:", err.message);
});

export async function checkConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("connected");
  } finally {
    client.release();
  }
}

export async function insertReading(topic: string, payload: string): Promise<void> {
  await pool.query(
    "INSERT INTO readings (topic, payload) VALUES ($1, $2)",
    [topic, payload],
  );
}