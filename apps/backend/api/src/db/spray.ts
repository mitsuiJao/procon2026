import { pool } from "./client";

const COLUMNS = `id::int AS id,
            to_char(sprayed_on, 'YYYY-MM-DD') AS sprayed_on,
            pesticide_id, pesticide, dilution, amount, target, note`;

export type sprayRecord = {
  sprayed_on: string,
  pesticide_id?: string | null,
  pesticide: string,
  dilution?: string | null,
  amount?: string | null,
  target?: string | null,
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
    `SELECT ${COLUMNS}
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
    `INSERT INTO spray_records (sprayed_on, pesticide_id, pesticide, dilution, amount, target, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id::int AS id`,
    [
      record.sprayed_on,
      record.pesticide_id ?? null,
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
 * 散布記録をidで上書きする
 * @param id 散布記録の id
 * @param record 散布日・農薬名などの記録
 * @returns 対象が存在したか
 */
export async function updateSprayRecord(id: number, record: sprayRecord): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE spray_records
        SET sprayed_on = $2, pesticide_id = $3, pesticide = $4,
            dilution = $5, amount = $6, target = $7, note = $8
      WHERE id = $1`,
    [
      id,
      record.sprayed_on,
      record.pesticide_id ?? null,
      record.pesticide,
      record.dilution ?? null,
      record.amount ?? null,
      record.target ?? null,
      record.note ?? "",
    ],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * 新しい順に散布記録を取得
 * @param limit 件数
 * @returns 散布記録の配列 日付, id降順
 */
export async function getRecentSprayRecords(limit: number) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS}
       FROM spray_records
      ORDER BY sprayed_on DESC, id DESC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * 散布記録をidで削除する
 * @param id 散布記録の id
 * @returns 対象が存在したか
 */
export async function deleteSprayRecord(id: number): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM spray_records WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * 指定日の散布記録をすべて削除
 * @param date 散布日
 */
export async function deleteSprayRecordsByDate(date: string) {
  await pool.query("DELETE FROM spray_records WHERE sprayed_on = $1", [date]);
}
