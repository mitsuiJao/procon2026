import { pool } from "./client";

type sprayRecord = {
  sprayed_on: string,
  pesticide: string,
  dilution?: string,
  amount?: string,
  target?: string,
  note?: string,
}

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

export async function deleteSprayRecord(id: number) {
  await pool.query("DELETE FROM spray_records WHERE id = $1", [id]);
}

export async function deleteSprayRecordsByDate(date: string) {
  await pool.query("DELETE FROM spray_records WHERE sprayed_on = $1", [date]);
}
