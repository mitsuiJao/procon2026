import { pool } from "./client";

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

export async function deleteDiaryEntry(entryDate: string) {
  await pool.query("DELETE FROM diary_entries WHERE entry_date = $1", [entryDate]);
}
