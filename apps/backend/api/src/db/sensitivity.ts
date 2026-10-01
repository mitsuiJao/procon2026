import { pool } from "./client";

export type SensitivityRow = {
  diseaseId: string;
  level: number;
  /** 今シーズンの発生記録の件数 */
  observed: number;
  /** そのうち、選んだ段階で事前に警告が出ていた件数 */
  caught: number;
  /** 選んだ段階で警告が出た日数 */
  alertDays: number;
  /** シーズン開始から計算した日までの日数 */
  totalDays: number;
};

/**
 * 感度の段階を追記する（上書きせず、履歴として残す）
 * @param season シーズン開始日 (YYYY-MM-DD)
 */
export async function writeSensitivity(season: string, row: SensitivityRow) {
  await pool.query(
    `INSERT INTO disease_sensitivity (disease_id, season, level, observed, caught, alert_days, total_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.diseaseId, season, row.level, row.observed, row.caught, row.alertDays, row.totalDays],
  );
}

/**
 * そのシーズンの、病害ごとの最新の段階を取得する。まだ計算していない病害は含まれない
 * @param season シーズン開始日 (YYYY-MM-DD)
 */
export async function getLatestSensitivity(season: string): Promise<SensitivityRow[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (disease_id)
            disease_id AS "diseaseId", level, observed, caught,
            alert_days AS "alertDays", total_days AS "totalDays"
       FROM disease_sensitivity
      WHERE season = $1
      ORDER BY disease_id, created_at DESC, id DESC`,
    [season],
  );
  return rows;
}
