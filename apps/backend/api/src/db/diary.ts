import { pool } from "./client";

/**
 * 指定期間の日記を取得する
 * @param start 開始日 (YYYY-MM-DD, 含む)
 * @param end 終了日 (YYYY-MM-DD, 含む)
 * @returns { entry_date, memo }[] 昇順
 */
export async function getDiaryEntriesByRange(start: string, end: string) {
  const { rows } = await pool.query(
    `SELECT to_char(entry_date, 'YYYY-MM-DD') AS entry_date, memo
       FROM diary_entries
      WHERE entry_date >= $1 AND entry_date <= $2
      ORDER BY entry_date`,
    [start, end],
  );
  return rows;
}

/**
 * 日記を保存する。同じ日付があればメモを上書きする
 * @param entryDate 日付 (YYYY-MM-DD)
 * @param memo メモ本文
 */
export async function writeDiaryEntry(entryDate: string, memo: string) {
  await pool.query(
    `INSERT INTO diary_entries (entry_date, memo)
     VALUES ($1, $2)
     ON CONFLICT (entry_date) DO UPDATE
       SET memo = EXCLUDED.memo,
           updated_at = now()`,
    [entryDate, memo],
  );
}

/**
 * 指定日の日記を削除する, 未使用
 * @param entryDate 日付 (YYYY-MM-DD)
 */
export async function deleteDiaryEntry(entryDate: string) {
  await pool.query("DELETE FROM diary_entries WHERE entry_date = $1", [entryDate]);
}
