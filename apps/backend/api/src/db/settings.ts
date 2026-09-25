import { pool } from "./client";

export async function getPlace() {
  const { rows } = await pool.query(
    `SELECT latitude, longitude
       FROM settings
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  );
  if (rows[0]) return rows[0];
  return {
    latitude: Number(process.env.LATITUDE),
    longitude: Number(process.env.LONGITUDE),
  };
}
