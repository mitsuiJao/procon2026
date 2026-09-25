import { pool } from "./client";

type sprayRecord = {
  sprayed_on: string,
  pesticide: string,
  dilution?: string,
  amount?: string,
  target?: string,
  note?: string,
}

/**
 * 指定期間の散布記録を取得
 * @param start 開始日 YYYY-MM-DD 閉区間
 * @param end 終了日 YYYY-MM-DD　閉区間)
 * @returns 散布記録の配列 sprayRecord型 日付, id昇順
 */
export async function getSprayRecordsByRange(start: string, end: string) {
  const { rows } = await pool.query(
    `SELECT id,
            to_char(sprayed_on, 'YYYY-MM-DD') AS sprayed_on,
            pesticide, dilution, amount, target, note
       FROM spray_records
      WHERE sprayed_on >= $1 AND sprayed_on <= $2
      ORDER BY sprayed_on, id`,
    [start, end],
  );
  return rows;
}

/**
 * 散布記録を追加
 * @param record 散布日・農薬名などの記録
 * @returns 記録id
 */
export async function writeSprayRecord(record: sprayRecord): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO spray_records (sprayed_on, pesticide, dilution, amount, target, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      record.sprayed_on,
      record.pesticide,
      record.dilution ?? null,
      record.amount ?? null,
      record.target ?? null,
      record.note ?? "",
    ],
  );
  return rows[0].id;
}

/**
 * 散布記録をidで削除する
 * @param id 散布記録の id
 */
export async function deleteSprayRecord(id: number) {
  await pool.query("DELETE FROM spray_records WHERE id = $1", [id]);
}

/**
 * 指定日の散布記録をすべて削除
 * @param date 散布日
 */
export async function deleteSprayRecordsByDate(date: string) {
  await pool.query("DELETE FROM spray_records WHERE sprayed_on = $1", [date]);
}
