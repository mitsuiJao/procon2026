import { pool } from "./client";

/**
 * 観測地点を取得、settingsが空なら環境変数LATITUDE/LONGITUDEへロールバック
 * @returns { latitude, longitude }
 */
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
