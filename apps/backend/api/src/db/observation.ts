import { pool } from "./client";

/**
 * 指定期間の病害の発生記録を取得する
 * @param start 開始日 (YYYY-MM-DD, 含む)
 * @param end 終了日 (YYYY-MM-DD, 含む)
 * @returns { observed_on, disease_id, note }[] 日付・disease_id の昇順
 */
export async function getObservationsByRange(start: string, end: string) {
  const { rows } = await pool.query(
    `SELECT to_char(observed_on, 'YYYY-MM-DD') AS observed_on, disease_id, note
       FROM disease_observations
      WHERE observed_on >= $1 AND observed_on <= $2
      ORDER BY observed_on, disease_id`,
    [start, end],
  );
  return rows;
}

/**
 * 病害の発生を記録する。同じ日・同じ病害の記録があればメモを上書きする
 * @param observedOn 見つけた日 (YYYY-MM-DD)
 * @param diseaseId 病害（diseases.yaml の id）
 * @param note メモ
 */
export async function writeObservation(observedOn: string, diseaseId: string, note: string) {
  await pool.query(
    `INSERT INTO disease_observations (observed_on, disease_id, note)
     VALUES ($1, $2, $3)
     ON CONFLICT (observed_on, disease_id) DO UPDATE
       SET note = EXCLUDED.note`,
    [observedOn, diseaseId, note],
  );
}

/**
 * 病害の発生記録を削除する
 * @param observedOn 見つけた日 (YYYY-MM-DD)
 * @param diseaseId 病害（diseases.yaml の id）
 * @returns 対象が存在したか
 */
export async function deleteObservation(observedOn: string, diseaseId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM disease_observations WHERE observed_on = $1 AND disease_id = $2",
    [observedOn, diseaseId],
  );
  return (rowCount ?? 0) > 0;
}
